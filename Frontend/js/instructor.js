/* ==========================================================================
   OSMS - Instructor Portal Logic
   Handles My Classes, Class Roster, and Student Grading (4.0 Scale).
   Instructors can only UPDATE grades; they cannot add or delete students.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const session = getSession();
  if (!session.userId || session.role !== 'instructor') {
    return; // guard.js handles redirect
  }

  // Populate header
  const nameEl = document.getElementById('instructor-header-name');
  if (nameEl) nameEl.textContent = session.name || 'Instructor';

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  await initInstructorClasses(session.userId);
});

async function initInstructorClasses(instructorId) {
  const classesContainer = document.getElementById('instructor-classes-tbody');
  const rosterSection = document.getElementById('roster-section');
  const rosterTitle = document.getElementById('roster-title');
  const rosterTbody = document.getElementById('roster-tbody');
  const gradingAlert = document.getElementById('grading-alert');

  if (!classesContainer) return;

  const res = await getInstructorClasses(instructorId);
  if (!res.ok || !res.data) {
    classesContainer.innerHTML = `<tr><td colspan="6" class="table-empty">Failed to load classes: ${res.error || 'Network error'}</td></tr>`;
    return;
  }

  const classes = res.data;
  if (classes.length === 0) {
    classesContainer.innerHTML = '<tr><td colspan="6" class="table-empty">You have no class sections assigned.</td></tr>';
    return;
  }

  // Render classes table
  classesContainer.innerHTML = classes.map((c, idx) => `
    <tr>
      <td><strong>${c.courseCode}</strong></td>
      <td>${c.courseName}</td>
      <td>${c.semesterName}</td>
      <td>${c.creditHours} cr</td>
      <td>
        <span style="font-weight: 600;">${c.currentEnrolledCount}</span> / ${c.capacity}
      </td>
      <td style="text-align: right;">
        <button
          class="btn btn--outline btn--sm view-roster-btn"
          data-instance-id="${c.id}"
          data-course-info="${c.courseCode} — ${c.courseName} (${c.semesterName})">
          Open Roster &amp; Grading &rarr;
        </button>
      </td>
    </tr>
  `).join('');

  // Attach button events to load class roster
  classesContainer.querySelectorAll('.view-roster-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const instId = e.currentTarget.dataset.instanceId;
      const info = e.currentTarget.dataset.courseInfo;

      // Highlight active row
      classesContainer.querySelectorAll('tr').forEach(r => r.style.background = '');
      e.currentTarget.closest('tr').style.background = '#FAF5EC';

      await loadRoster(instId, info);
    });
  });

  // Automatically open first class roster on initial load
  if (classes.length > 0) {
    const first = classes[0];
    await loadRoster(first.id, `${first.courseCode} — ${first.courseName} (${first.semesterName})`);
  }

  async function loadRoster(classInstanceId, courseInfo) {
    rosterSection.style.display = 'block';
    rosterTitle.textContent = courseInfo;
    rosterTbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading student roster…</td></tr>';
    hideAlert(gradingAlert);

    rosterSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const rosterRes = await getClassRoster(classInstanceId);
    if (!rosterRes.ok || !rosterRes.data) {
      rosterTbody.innerHTML = `<tr><td colspan="6" class="table-empty">Failed to load roster: ${rosterRes.error || 'Network error'}</td></tr>`;
      return;
    }

    const students = rosterRes.data.students;
    if (students.length === 0) {
      rosterTbody.innerHTML = '<tr><td colspan="6" class="table-empty">No students are currently enrolled in this section.</td></tr>';
      return;
    }

    const gradeLetters = Object.keys(GRADE_SCALE);

    rosterTbody.innerHTML = students.map(s => {
      const optionsHtml = gradeLetters.map(g => {
        const isSelected = s.gradeLetter === g;
        return `<option value="${g}" ${isSelected ? 'selected' : ''}>${g} (${GRADE_SCALE[g].toFixed(2)} pts)</option>`;
      }).join('');

      return `
        <tr id="row-enrollment-${s.enrollmentId}">
          <td><strong>#${s.studentId}</strong></td>
          <td>
            <strong>${s.studentName}</strong>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">${s.studentEmail}</div>
          </td>
          <td>${s.departmentName}</td>
          <td>
            <span class="badge badge--${s.status === 'completed' ? 'success' : 'info'}">
              ${s.status}
            </span>
          </td>
          <td>
            <select class="select grade-select" style="padding: 6px 30px 6px 10px; font-size: var(--font-size-sm); min-width: 140px;">
              <option value="" ${!s.gradeLetter ? 'selected' : ''}>— Unassigned —</option>
              ${optionsHtml}
            </select>
          </td>
          <td style="text-align: right;">
            <button
              class="btn btn--primary btn--sm save-grade-btn"
              data-enrollment-id="${s.enrollmentId}"
              data-student-name="${s.studentName}">
              Save Grade
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach grade save listeners
    rosterTbody.querySelectorAll('.save-grade-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const enrollmentId = e.currentTarget.dataset.enrollmentId;
        const studentName = e.currentTarget.dataset.studentName;
        const row = document.getElementById(`row-enrollment-${enrollmentId}`);
        const select = row.querySelector('.grade-select');
        const selectedGrade = select.value;

        if (!selectedGrade) {
          showAlert(gradingAlert, 'Please select a letter grade before saving.', 'warning');
          return;
        }

        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = '<span class="spinner"></span> Saving…';

        const updateRes = await updateGrade(enrollmentId, selectedGrade);

        e.currentTarget.disabled = false;
        e.currentTarget.textContent = 'Save Grade';

        if (updateRes.ok) {
          showAlert(gradingAlert, `${updateRes.message} for ${studentName}.`, 'success');
          // Update status badge in row
          const badge = row.querySelector('.badge');
          if (badge) {
            badge.className = 'badge badge--success';
            badge.textContent = 'completed';
          }
        } else {
          showAlert(gradingAlert, updateRes.message || 'Failed to update grade.', 'error');
        }
      });
    });
  }
}
