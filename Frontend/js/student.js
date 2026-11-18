/* ==========================================================================
   OSMS - Student Portal Logic
   Handles Dashboard, Transcript, Enrollment, and Payments screens.
   Ensures students only access their own data.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const session = getSession();
  if (!session.userId || session.role !== 'student') {
    return; // guard.js handles redirect
  }

  // Populate shared student header elements
  const nameEl = document.getElementById('student-header-name');
  if (nameEl) nameEl.textContent = session.name || 'Student';

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Identify current page
  const page = window.location.pathname.split('/').pop().toLowerCase();

  if (page === 'student.html' || page === 'student') {
    await initStudentDashboard(session.userId);
  } else if (page === 'student-transcript.html') {
    await initStudentTranscript(session.userId);
  } else if (page === 'student-enrollment.html') {
    await initStudentEnrollment(session.userId);
  } else if (page === 'student-payments.html') {
    await initStudentPayments(session.userId);
  }
});

/* ==========================================================================
   1. STUDENT DASHBOARD
   ========================================================================== */
async function initStudentDashboard(studentId) {
  const container = document.getElementById('student-dashboard-content');
  if (!container) return;

  const res = await getStudentDashboard(studentId);
  if (!res.ok || !res.data) {
    container.innerHTML = `<div class="alert alert--error visible">Failed to load student profile: ${res.error || 'Unknown error'}</div>`;
    return;
  }

  const s = res.data;

  // Academic probation alert
  let probationHtml = '';
  if (s.isProbation) {
    probationHtml = `
      <div class="alert alert--warning visible" style="margin-bottom: var(--space-lg);">
        <strong>⚠️ Academic Probation Warning:</strong> Your cumulative GPA (${s.overallGpa}) is currently below 2.00 (Status: ${s.status}).
        Please contact your academic advisor at the Department of ${s.departmentName} immediately to develop an academic improvement plan.
      </div>
    `;
  }

  // Active enrollments rows
  let activeHtml = '';
  if (s.activeEnrollments && s.activeEnrollments.length > 0) {
    activeHtml = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Name</th>
              <th>Credit Hours</th>
              <th>Instructor</th>
              <th>Semester</th>
            </tr>
          </thead>
          <tbody>
            ${s.activeEnrollments.map(c => `
              <tr>
                <td><strong>${c.courseCode}</strong></td>
                <td>${c.courseName}</td>
                <td>${c.creditHours} cr</td>
                <td>${c.instructor}</td>
                <td>${c.semester}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    activeHtml = `
      <div class="table-empty">
        <p>You have no active course enrollments for this semester.</p>
        <p style="margin-top: 8px;"><a href="student-enrollment.html" class="btn btn--outline btn--sm">Browse Open Courses &rarr;</a></p>
      </div>
    `;
  }

  container.innerHTML = `
    ${probationHtml}

    <div class="info-grid">
      <div class="info-card">
        <div class="label">Major Department</div>
        <div class="value" style="font-size: 1.25rem;">${s.departmentName}</div>
        <div class="subtext">Status: <span class="badge badge--${s.status === 'Active' ? 'success' : 'warning'}">${s.status}</span></div>
      </div>

      <div class="info-card">
        <div class="label">Overall GPA (4.0 Scale)</div>
        <div class="value">${s.overallGpa}</div>
        <div class="subtext">
          Performance: <span class="badge badge--${s.performanceClass}">${s.performanceBand}</span>
        </div>
      </div>

      <div class="info-card">
        <div class="label">Completed Credits</div>
        <div class="value">${s.completedHours} <span style="font-size: 1rem; font-weight: normal; color: var(--color-text-muted);">hrs</span></div>
        <div class="subtext">Toward degree graduation</div>
      </div>

      <div class="info-card">
        <div class="label">Enrolled This Term</div>
        <div class="value">${s.activeEnrollments.length} <span style="font-size: 1rem; font-weight: normal; color: var(--color-text-muted);">courses</span></div>
        <div class="subtext">Spring 2026 Semester</div>
      </div>
    </div>

    <div class="card" style="margin-top: var(--space-lg);">
      <div class="section-header">
        <h3>Current Semester Enrollments</h3>
        <a href="student-enrollment.html" class="btn btn--outline btn--sm">Manage Enrollments</a>
      </div>
      ${activeHtml}
    </div>
  `;
}

/* ==========================================================================
   2. STUDENT TRANSCRIPT (view_student_transcript)
   ========================================================================== */
async function initStudentTranscript(studentId) {
  const container = document.getElementById('student-transcript-content');
  if (!container) return;

  const res = await getStudentTranscript(studentId);
  if (!res.ok || !res.data) {
    container.innerHTML = `<div class="alert alert--error visible">Failed to load academic transcript: ${res.error || 'Unknown error'}</div>`;
    return;
  }

  const data = res.data;
  const semesterNames = Object.keys(data.semesters);

  if (semesterNames.length === 0) {
    container.innerHTML = '<div class="table-empty"><p>No academic records found for this student.</p></div>';
    return;
  }

  let html = `
    <div class="info-grid" style="margin-bottom: var(--space-xl);">
      <div class="info-card">
        <div class="label">Student Name</div>
        <div class="value" style="font-size: 1.25rem;">${data.studentName}</div>
      </div>
      <div class="info-card">
        <div class="label">Cumulative GPA</div>
        <div class="value">${data.overallGpa}</div>
        <div class="subtext">Performance Band: <strong>${data.performanceBand}</strong></div>
      </div>
      <div class="info-card">
        <div class="label">Semesters Recorded</div>
        <div class="value">${semesterNames.length}</div>
      </div>
    </div>
  `;

  for (const semName of semesterNames) {
    const list = data.semesters[semName];

    // Compute semester metrics
    const completedCourses = list.filter(c => c.status === 'completed' && c.gradePoints !== '—');
    let semGpa = '—';
    if (completedCourses.length > 0) {
      let totalPts = 0;
      let totalCr = 0;
      completedCourses.forEach(c => {
        totalPts += Number(c.gradePoints) * c.creditHours;
        totalCr += c.creditHours;
      });
      semGpa = totalCr > 0 ? (totalPts / totalCr).toFixed(2) : '—';
    }

    html += `
      <div class="card" style="margin-bottom: var(--space-lg);">
        <div class="section-header">
          <h3>${semName}</h3>
          <span style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            Semester GPA: <strong>${semGpa}</strong>
          </span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Credit Hours</th>
                <th>Grade Letter</th>
                <th>Grade Points</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(c => `
                <tr>
                  <td><strong>${c.courseCode}</strong></td>
                  <td>${c.courseName}</td>
                  <td>${c.creditHours} cr</td>
                  <td><strong style="color: ${c.gradeLetter === 'F' ? 'var(--color-error)' : 'var(--color-text)'}">${c.gradeLetter}</strong></td>
                  <td>${c.gradePoints}</td>
                  <td>
                    <span class="badge badge--${c.status === 'completed' ? 'success' : 'info'}">
                      ${c.status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

/* ==========================================================================
   3. STUDENT ENROLLMENT (enroll_student & drop_enrollment)
   ========================================================================== */
async function initStudentEnrollment(studentId) {
  const container = document.getElementById('student-enrollment-content');
  const alertEl = document.getElementById('enrollment-feedback-alert');
  const semesterSelect = document.getElementById('enrollment-semester-select');
  if (!container) return;

  async function loadClasses() {
    const semId = semesterSelect ? semesterSelect.value : 2;
    container.innerHTML = '<div class="table-empty"><p>Loading available classes…</p></div>';

    const res = await getEnrollmentClasses(studentId, semId);
    if (!res.ok || !res.data) {
      container.innerHTML = `<div class="alert alert--error visible">Failed to load classes: ${res.error || 'Network error'}</div>`;
      return;
    }

    const classes = res.data;
    if (classes.length === 0) {
      container.innerHTML = '<div class="table-empty"><p>No class sections currently scheduled for this semester.</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Course Name</th>
              <th>Credits</th>
              <th>Instructor</th>
              <th>Enrolled / Capacity</th>
              <th>Status</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${classes.map(c => {
              let actionHtml = '';
              let statusBadge = '<span class="badge badge--neutral">Not Enrolled</span>';

              if (c.enrollmentStatus === 'completed') {
                statusBadge = '<span class="badge badge--success">Completed</span>';
                actionHtml = '<span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Completed</span>';
              } else if (c.enrollmentStatus === 'enrolled') {
                statusBadge = '<span class="badge badge--info">Enrolled</span>';
                actionHtml = `
                  <button
                    class="btn btn--danger btn--sm drop-btn"
                    data-instance-id="${c.classInstanceId}"
                    data-course-name="${c.courseCode}">
                    Drop Course
                  </button>
                `;
              } else {
                if (c.isFull) {
                  statusBadge = '<span class="badge badge--error">Class Full</span>';
                  actionHtml = '<button class="btn btn--outline btn--sm" disabled>Full</button>';
                } else {
                  actionHtml = `
                    <button
                      class="btn btn--primary btn--sm enroll-btn"
                      data-instance-id="${c.classInstanceId}"
                      data-course-name="${c.courseCode}">
                      Enroll
                    </button>
                  `;
                }
              }

              return `
                <tr>
                  <td><strong>${c.courseCode}</strong></td>
                  <td>${c.courseName}</td>
                  <td>${c.creditHours} cr</td>
                  <td>${c.instructorName}</td>
                  <td>
                    <span style="font-weight: 600; color: ${c.isFull ? 'var(--color-error)' : 'var(--color-text)'}">
                      ${c.currentEnrolledCount} / ${c.capacity}
                    </span>
                  </td>
                  <td>${statusBadge}</td>
                  <td style="text-align: right;">${actionHtml}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Attach click events
    container.querySelectorAll('.enroll-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const instId = e.currentTarget.dataset.instanceId;
        const cName = e.currentTarget.dataset.courseName;
        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = '<span class="spinner"></span>';

        const result = await enroll_student(studentId, instId);
        handleProcedureFeedback(result, alertEl);
        await loadClasses();
      });
    });

    container.querySelectorAll('.drop-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const instId = e.currentTarget.dataset.instanceId;
        const cName = e.currentTarget.dataset.courseName;
        if (!confirm(`Are you sure you want to drop ${cName}?`)) return;

        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = '<span class="spinner"></span>';

        const result = await drop_enrollment(studentId, instId);
        handleProcedureFeedback(result, alertEl);
        await loadClasses();
      });
    });
  }

  if (semesterSelect) {
    semesterSelect.addEventListener('change', loadClasses);
  }

  await loadClasses();
}

/**
 * Handle SUCCESS: / ERROR: stored procedure message banners
 */
function handleProcedureFeedback(result, alertEl) {
  if (!alertEl) return;
  const msg = result.message || (result.ok ? 'SUCCESS: Operation completed.' : 'ERROR: Operation failed.');

  if (msg.startsWith('SUCCESS:')) {
    showAlert(alertEl, msg, 'success');
  } else {
    showAlert(alertEl, msg, 'error');
  }

  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ==========================================================================
   4. STUDENT PAYMENTS (calculate_tuition & pay_tuition)
   ========================================================================== */
async function initStudentPayments(studentId) {
  const container = document.getElementById('student-payments-content');
  const alertEl = document.getElementById('payments-alert');
  if (!container) return;

  async function loadTuition() {
    container.innerHTML = '<div class="table-empty"><p>Calculating semester tuition…</p></div>';

    const semId = 2; // Active Spring 2026 semester
    const res = await calculate_tuition(studentId, semId);

    if (!res.ok || !res.data) {
      container.innerHTML = `<div class="alert alert--error visible">Failed to load tuition calculations: ${res.error || 'Network error'}</div>`;
      return;
    }

    const t = res.data;
    const isPaid = t.paymentStatus === 'paid';

    let breakdownHtml = '';
    if (t.breakdown && t.breakdown.length > 0) {
      breakdownHtml = `
        <div class="table-wrapper" style="margin-top: var(--space-md);">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Name</th>
                <th>Credit Hours</th>
                <th>Rate / Hour</th>
                <th style="text-align: right;">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              ${t.breakdown.map(b => `
                <tr>
                  <td><strong>${b.courseCode}</strong></td>
                  <td>${b.courseName}</td>
                  <td>${b.creditHours} cr</td>
                  <td>$${b.ratePerHour.toFixed(2)}</td>
                  <td style="text-align: right; font-weight: 600;">$${b.cost.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      breakdownHtml = `
        <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--space-sm);">
          No enrolled courses yet. Base semester tuition deposit applies.
        </p>
      `;
    }

    container.innerHTML = `
      <div class="alert alert--info visible" style="margin-bottom: var(--space-lg);">
        <strong>📌 Institution Policy:</strong> Semester tuition must be paid in full prior to enrolling in course sections.
        Payment verification is enforced by the database enrollment procedure.
      </div>

      <div class="info-grid">
        <div class="info-card">
          <div class="label">Term</div>
          <div class="value" style="font-size: 1.25rem;">Spring 2026</div>
          <div class="subtext">Academic Year 2025/2026</div>
        </div>

        <div class="info-card">
          <div class="label">Tuition Balance</div>
          <div class="value">$${t.totalAmount.toFixed(2)}</div>
          <div class="subtext">Calculated via credit-hour pricing rules</div>
        </div>

        <div class="info-card">
          <div class="label">Payment Status</div>
          <div class="value" style="font-size: 1.25rem;">
            <span class="badge badge--${isPaid ? 'success' : 'warning'}" style="font-size: 1rem; padding: 4px 12px;">
              ${isPaid ? 'Paid in Full' : 'Pending Payment'}
            </span>
          </div>
          <div class="subtext">${isPaid ? `Cleared on ${t.paidAt || 'Spring Term'}` : 'Payment required to enable enrollment'}</div>
        </div>
      </div>

      <div class="card" style="margin-top: var(--space-lg);">
        <div class="section-header">
          <h3>Tuition Assessment Breakdown</h3>
          ${!isPaid ? `
            <button id="pay-tuition-btn" class="btn btn--success btn--sm">
              Pay Tuition ($${t.totalAmount.toFixed(2)})
            </button>
          ` : `
            <span class="badge badge--success" style="font-size: var(--font-size-sm);">Account in Good Standing</span>
          `}
        </div>

        ${breakdownHtml}
      </div>
    `;

    const payBtn = document.getElementById('pay-tuition-btn');
    if (payBtn) {
      payBtn.addEventListener('click', async () => {
        payBtn.disabled = true;
        payBtn.innerHTML = '<span class="spinner"></span> Processing…';

        const payRes = await pay_tuition(studentId, semId, t.totalAmount);
        if (payRes.ok) {
          showAlert(alertEl, payRes.message, 'success');
        } else {
          showAlert(alertEl, payRes.message || 'Payment failed.', 'error');
        }
        await loadTuition();
      });
    }
  }

  await loadTuition();
}
