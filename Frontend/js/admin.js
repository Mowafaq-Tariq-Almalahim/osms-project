/* ==========================================================================
   OSMS - Admin Portal Logic
   Full CRUD management across all PostgreSQL schema tables +
   4 Analytical Report Views.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const session = getSession();
  if (!session.userId || session.role !== 'admin') {
    return; // guard.js handles redirect
  }

  // Populate admin header
  const nameEl = document.getElementById('admin-header-name');
  if (nameEl) nameEl.textContent = session.name || 'System Administrator';

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Setup main tabs if present
  setupTabs();

  // Identify page
  const page = window.location.pathname.split('/').pop().toLowerCase();
  if (page === 'admin-reports.html') {
    await initAdminReports();
  } else {
    await initAdminManagement();
  }
});

/* ==========================================================================
   TAB SWITCHING LOGIC
   ========================================================================== */
function setupTabs() {
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    const buttons = tabGroup.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.tab;
        const container = tabGroup.parentElement;

        // Toggle buttons
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle panes
        container.querySelectorAll('.tab-pane').forEach(p => {
          if (p.id === targetId) {
            p.classList.add('active');
          } else {
            p.classList.remove('active');
          }
        });
      });
    });
  });
}

/* ==========================================================================
   MODAL CONTROLLER
   ========================================================================== */
const Modal = {
  open(title, bodyHtml, onSave) {
    let overlay = document.getElementById('admin-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'admin-modal-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3 id="admin-modal-title"></h3>
            <button class="modal-close" id="admin-modal-close" aria-label="Close modal">&times;</button>
          </div>
          <div id="admin-modal-alert" class="alert"></div>
          <div id="admin-modal-body"></div>
          <div class="modal-actions">
            <button class="btn btn--outline btn--sm" id="admin-modal-cancel">Cancel</button>
            <button class="btn btn--primary btn--sm" id="admin-modal-save">Save Changes</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#admin-modal-close').addEventListener('click', Modal.close);
      overlay.querySelector('#admin-modal-cancel').addEventListener('click', Modal.close);
    }

    document.getElementById('admin-modal-title').textContent = title;
    document.getElementById('admin-modal-body').innerHTML = bodyHtml;
    hideAlert(document.getElementById('admin-modal-alert'));

    const saveBtn = document.getElementById('admin-modal-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', async () => {
      newSaveBtn.disabled = true;
      newSaveBtn.innerHTML = '<span class="spinner"></span> Saving…';
      const success = await onSave();
      newSaveBtn.disabled = false;
      newSaveBtn.innerHTML = 'Save Changes';
      if (success) {
        Modal.close();
      }
    });

    overlay.classList.add('active');
  },

  close() {
    const overlay = document.getElementById('admin-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  showError(msg) {
    const el = document.getElementById('admin-modal-alert');
    if (el) showAlert(el, msg, 'error');
  }
};

/* ==========================================================================
   1. ADMIN MANAGEMENT (CRUD)
   ========================================================================== */
async function initAdminManagement() {
  await Promise.all([
    renderStudentsTable(),
    renderInstructorsTable(),
    renderAdminsTable(),
    renderDepartmentsTable(),
    renderSemestersTable(),
    renderCoursesTable(),
    renderPrerequisitesManager(),
    renderClassInstancesTable(),
    renderPricingRulesTable(),
    renderPaymentsTable(),
  ]);
}

/* ---------- 1.1 Students Table ---------- */
async function renderStudentsTable() {
  const tbody = document.getElementById('table-students-tbody');
  if (!tbody) return;

  const [res, deptRes] = await Promise.all([
    adminGetTable('students'),
    adminGetTable('departments'),
  ]);

  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Error loading students: ${res.error}</td></tr>`;
    return;
  }

  const depts = deptRes.ok ? deptRes.data : [];
  const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]));

  tbody.innerHTML = res.data.map(s => `
    <tr>
      <td><strong>#${s.id}</strong></td>
      <td><strong>${s.name}</strong></td>
      <td>${s.email}</td>
      <td>${deptMap[s.major_department_id] || 'N/A'}</td>
      <td><strong>${Number(s.overall_gpa).toFixed(2)}</strong></td>
      <td><span class="badge badge--${s.status === 'Active' ? 'success' : 'warning'}">${s.status}</span></td>
      <td style="text-align: right;">
        <button class="btn btn--outline btn--sm edit-student-btn" data-id="${s.id}">Edit</button>
        <button class="btn btn--danger btn--sm del-student-btn" data-id="${s.id}" style="margin-left:4px;">Delete</button>
      </td>
    </tr>
  `).join('');

  // Add Student
  document.getElementById('add-student-btn')?.addEventListener('click', () => {
    Modal.open(
      'Add New Student',
      `
        <div class="form-group">
          <label>Full Name</label>
          <input id="m-name" class="input" type="text" placeholder="e.g. Maya Zaid" required>
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input id="m-email" class="input" type="email" placeholder="e.g. maya@osms.edu" required>
        </div>
        <div class="form-group">
          <label>Initial Password</label>
          <input id="m-pass" class="input" type="password" placeholder="Min 8 characters" required>
        </div>
        <div class="form-group">
          <label>Major Department</label>
          <select id="m-dept" class="select" required>
            ${depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Academic Status</label>
          <select id="m-status" class="select">
            <option value="Active" selected>Active</option>
            <option value="Probation">Probation</option>
          </select>
        </div>
      `,
      async () => {
        const name = document.getElementById('m-name').value.trim();
        const email = document.getElementById('m-email').value.trim();
        const pass = document.getElementById('m-pass').value;
        const deptId = Number(document.getElementById('m-dept').value);
        const status = document.getElementById('m-status').value;

        if (!name) { Modal.showError('Name is required.'); return false; }
        if (!validateEmail(email).valid) { Modal.showError('Valid email is required.'); return false; }
        if (pass.length < 8) { Modal.showError('Password must be at least 8 characters.'); return false; }

        const r = await adminCreateRecord('students', {
          name,
          email,
          password_hash: pass,
          major_department_id: deptId,
          overall_gpa: 0.0,
          status,
        });

        if (!r.ok) { Modal.showError(r.error || 'Failed to add student.'); return false; }
        await renderStudentsTable();
        return true;
      }
    );
  });

  // Edit / Delete Listeners
  tbody.querySelectorAll('.edit-student-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const student = res.data.find(s => s.id === id);
      if (!student) return;

      Modal.open(
        `Edit Student #${student.id}`,
        `
          <div class="form-group">
            <label>Full Name</label>
            <input id="m-name" class="input" type="text" value="${student.name}" required>
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input id="m-email" class="input" type="email" value="${student.email}" required>
          </div>
          <div class="form-group">
            <label>Major Department</label>
            <select id="m-dept" class="select">
              ${depts.map(d => `<option value="${d.id}" ${d.id === student.major_department_id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Overall GPA</label>
            <input id="m-gpa" class="input" type="number" step="0.01" min="0" max="4.0" value="${student.overall_gpa}">
          </div>
          <div class="form-group">
            <label>Academic Status</label>
            <select id="m-status" class="select">
              <option value="Active" ${student.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Probation" ${student.status === 'Probation' ? 'selected' : ''}>Probation</option>
            </select>
          </div>
        `,
        async () => {
          const name = document.getElementById('m-name').value.trim();
          const email = document.getElementById('m-email').value.trim();
          const deptId = Number(document.getElementById('m-dept').value);
          const gpa = Number(document.getElementById('m-gpa').value);
          const status = document.getElementById('m-status').value;

          if (!name) { Modal.showError('Name is required.'); return false; }
          if (!validateEmail(email).valid) { Modal.showError('Valid email is required.'); return false; }

          const up = await adminUpdateRecord('students', id, {
            name,
            email,
            major_department_id: deptId,
            overall_gpa: gpa,
            status,
          });

          if (!up.ok) { Modal.showError(up.error || 'Update failed.'); return false; }
          await renderStudentsTable();
          return true;
        }
      );
    });
  });

  tbody.querySelectorAll('.del-student-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (!confirm(`Delete student #${id}? All associated enrollments will be affected.`)) return;
      await adminDeleteRecord('students', id);
      await renderStudentsTable();
    });
  });
}

/* ---------- 1.2 Instructors Table ---------- */
async function renderInstructorsTable() {
  const tbody = document.getElementById('table-instructors-tbody');
  if (!tbody) return;

  const [res, deptRes] = await Promise.all([
    adminGetTable('instructors'),
    adminGetTable('departments'),
  ]);

  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Error: ${res.error}</td></tr>`;
    return;
  }

  const depts = deptRes.ok ? deptRes.data : [];
  const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]));

  tbody.innerHTML = res.data.map(i => `
    <tr>
      <td><strong>#${i.id}</strong></td>
      <td><strong>${i.name}</strong></td>
      <td>${i.email}</td>
      <td>${deptMap[i.department_id] || 'N/A'}</td>
      <td style="text-align: right;">
        <button class="btn btn--outline btn--sm edit-inst-btn" data-id="${i.id}">Edit</button>
        <button class="btn btn--danger btn--sm del-inst-btn" data-id="${i.id}" style="margin-left:4px;">Delete</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('add-instructor-btn')?.addEventListener('click', () => {
    Modal.open(
      'Add New Instructor',
      `
        <div class="form-group">
          <label>Full Name</label>
          <input id="m-name" class="input" type="text" placeholder="e.g. Dr. Hani Qasim" required>
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input id="m-email" class="input" type="email" placeholder="e.g. hani.qasim@osms.edu" required>
        </div>
        <div class="form-group">
          <label>Initial Password</label>
          <input id="m-pass" class="input" type="password" placeholder="Min 8 characters" required>
        </div>
        <div class="form-group">
          <label>Faculty Department</label>
          <select id="m-dept" class="select" required>
            ${depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
          </select>
        </div>
      `,
      async () => {
        const name = document.getElementById('m-name').value.trim();
        const email = document.getElementById('m-email').value.trim();
        const pass = document.getElementById('m-pass').value;
        const deptId = Number(document.getElementById('m-dept').value);

        if (!name || pass.length < 8 || !validateEmail(email).valid) {
          Modal.showError('Please check name, valid email, and password length (min 8 chars).');
          return false;
        }

        const r = await adminCreateRecord('instructors', {
          name,
          email,
          password_hash: pass,
          department_id: deptId,
        });

        if (!r.ok) { Modal.showError(r.error || 'Failed to add instructor.'); return false; }
        await renderInstructorsTable();
        return true;
      }
    );
  });

  tbody.querySelectorAll('.edit-inst-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const inst = res.data.find(x => x.id === id);
      if (!inst) return;

      Modal.open(
        `Edit Instructor #${inst.id}`,
        `
          <div class="form-group">
            <label>Full Name</label>
            <input id="m-name" class="input" type="text" value="${inst.name}" required>
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input id="m-email" class="input" type="email" value="${inst.email}" required>
          </div>
          <div class="form-group">
            <label>Department</label>
            <select id="m-dept" class="select">
              ${depts.map(d => `<option value="${d.id}" ${d.id === inst.department_id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
        `,
        async () => {
          const name = document.getElementById('m-name').value.trim();
          const email = document.getElementById('m-email').value.trim();
          const deptId = Number(document.getElementById('m-dept').value);

          const up = await adminUpdateRecord('instructors', id, { name, email, department_id: deptId });
          if (!up.ok) { Modal.showError(up.error || 'Failed to update.'); return false; }
          await renderInstructorsTable();
          return true;
        }
      );
    });
  });

  tbody.querySelectorAll('.del-inst-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (!confirm(`Delete instructor #${id}?`)) return;
      await adminDeleteRecord('instructors', id);
      await renderInstructorsTable();
    });
  });
}

/* ---------- 1.3 Admins Table ---------- */
async function renderAdminsTable() {
  const tbody = document.getElementById('table-admins-tbody');
  if (!tbody) return;

  const res = await adminGetTable('admins');
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Error: ${res.error}</td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(a => `
    <tr>
      <td><strong>#${a.id}</strong></td>
      <td><strong>${a.name}</strong></td>
      <td>${a.email}</td>
      <td style="text-align: right;">
        <button class="btn btn--outline btn--sm edit-admin-btn" data-id="${a.id}">Edit</button>
        <button class="btn btn--danger btn--sm del-admin-btn" data-id="${a.id}" style="margin-left:4px;" ${res.data.length <= 1 ? 'disabled title="Cannot delete sole admin"' : ''}>Delete</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('add-admin-btn')?.addEventListener('click', () => {
    Modal.open(
      'Add New Administrator',
      `
        <div class="form-group">
          <label>Full Name</label>
          <input id="m-name" class="input" type="text" placeholder="e.g. Operations Admin" required>
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input id="m-email" class="input" type="email" placeholder="e.g. ops@osms.edu" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input id="m-pass" class="input" type="password" placeholder="Min 8 characters" required>
        </div>
      `,
      async () => {
        const name = document.getElementById('m-name').value.trim();
        const email = document.getElementById('m-email').value.trim();
        const pass = document.getElementById('m-pass').value;

        if (!name || pass.length < 8 || !validateEmail(email).valid) {
          Modal.showError('Valid name, email and 8+ char password required.');
          return false;
        }

        const r = await adminCreateRecord('admins', { name, email, password_hash: pass });
        if (!r.ok) { Modal.showError(r.error || 'Failed to add admin.'); return false; }
        await renderAdminsTable();
        return true;
      }
    );
  });

  tbody.querySelectorAll('.edit-admin-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const a = res.data.find(x => x.id === id);
      if (!a) return;

      Modal.open(
        `Edit Administrator #${a.id}`,
        `
          <div class="form-group">
            <label>Full Name</label>
            <input id="m-name" class="input" type="text" value="${a.name}" required>
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input id="m-email" class="input" type="email" value="${a.email}" required>
          </div>
        `,
        async () => {
          const name = document.getElementById('m-name').value.trim();
          const email = document.getElementById('m-email').value.trim();
          const up = await adminUpdateRecord('admins', id, { name, email });
          if (!up.ok) { Modal.showError(up.error || 'Update failed.'); return false; }
          await renderAdminsTable();
          return true;
        }
      );
    });
  });

  tbody.querySelectorAll('.del-admin-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (!confirm(`Delete admin #${id}?`)) return;
      await adminDeleteRecord('admins', id);
      await renderAdminsTable();
    });
  });
}

/* ---------- 1.4 Departments Table ---------- */
async function renderDepartmentsTable() {
  const tbody = document.getElementById('table-departments-tbody');
  if (!tbody) return;

  const res = await adminGetTable('departments');
  if (!res.ok) return;

  tbody.innerHTML = res.data.map(d => `
    <tr>
      <td><strong>#${d.id}</strong></td>
      <td><strong>${d.name}</strong></td>
      <td style="text-align: right;">
        <button class="btn btn--outline btn--sm edit-dept-btn" data-id="${d.id}">Edit</button>
        <button class="btn btn--danger btn--sm del-dept-btn" data-id="${d.id}" style="margin-left:4px;">Delete</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('add-department-btn')?.addEventListener('click', () => {
    Modal.open(
      'Add New Department',
      `
        <div class="form-group">
          <label>Department Name</label>
          <input id="m-name" class="input" type="text" placeholder="e.g. Cybersecurity" required>
        </div>
      `,
      async () => {
        const name = document.getElementById('m-name').value.trim();
        if (!name) { Modal.showError('Name is required.'); return false; }
        const r = await adminCreateRecord('departments', { name });
        if (!r.ok) { Modal.showError(r.error || 'Failed.'); return false; }
        await renderDepartmentsTable();
        return true;
      }
    );
  });

  tbody.querySelectorAll('.edit-dept-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const item = res.data.find(x => x.id === id);
      if (!item) return;

      Modal.open(
        `Edit Department #${item.id}`,
        `
          <div class="form-group">
            <label>Department Name</label>
            <input id="m-name" class="input" type="text" value="${item.name}" required>
          </div>
        `,
        async () => {
          const name = document.getElementById('m-name').value.trim();
          const up = await adminUpdateRecord('departments', id, { name });
          if (!up.ok) { Modal.showError(up.error || 'Failed.'); return false; }
          await renderDepartmentsTable();
          return true;
        }
      );
    });
  });

  tbody.querySelectorAll('.del-dept-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (!confirm(`Delete department #${id}?`)) return;
      await adminDeleteRecord('departments', id);
      await renderDepartmentsTable();
    });
  });
}

/* ---------- 1.5 Semesters Table ---------- */
async function renderSemestersTable() {
  const tbody = document.getElementById('table-semesters-tbody');
  if (!tbody) return;

  const res = await adminGetTable('semesters');
  if (!res.ok) return;

  tbody.innerHTML = res.data.map(s => `
    <tr>
      <td><strong>#${s.id}</strong></td>
      <td><strong>${s.name}</strong></td>
      <td>${s.start_date}</td>
      <td>${s.end_date}</td>
      <td style="text-align: right;">
        <button class="btn btn--outline btn--sm edit-sem-btn" data-id="${s.id}">Edit</button>
        <button class="btn btn--danger btn--sm del-sem-btn" data-id="${s.id}" style="margin-left:4px;">Delete</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('add-semester-btn')?.addEventListener('click', () => {
    Modal.open(
      'Add New Semester',
      `
        <div class="form-group">
          <label>Semester Name</label>
          <input id="m-name" class="input" type="text" placeholder="e.g. Fall 2026" required>
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input id="m-start" class="input" type="date" required>
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input id="m-end" class="input" type="date" required>
        </div>
      `,
      async () => {
        const name = document.getElementById('m-name').value.trim();
        const start = document.getElementById('m-start').value;
        const end = document.getElementById('m-end').value;
        if (!name || !start || !end) { Modal.showError('All fields required.'); return false; }
        const r = await adminCreateRecord('semesters', { name, start_date: start, end_date: end });
        if (!r.ok) { Modal.showError(r.error || 'Failed.'); return false; }
        await renderSemestersTable();
        return true;
      }
    );
  });

  tbody.querySelectorAll('.edit-sem-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const item = res.data.find(x => x.id === id);
      if (!item) return;

      Modal.open(
        `Edit Semester #${item.id}`,
        `
          <div class="form-group">
            <label>Semester Name</label>
            <input id="m-name" class="input" type="text" value="${item.name}" required>
          </div>
          <div class="form-group">
            <label>Start Date</label>
            <input id="m-start" class="input" type="date" value="${item.start_date}" required>
          </div>
          <div class="form-group">
            <label>End Date</label>
            <input id="m-end" class="input" type="date" value="${item.end_date}" required>
          </div>
        `,
        async () => {
          const name = document.getElementById('m-name').value.trim();
          const start = document.getElementById('m-start').value;
          const end = document.getElementById('m-end').value;
          const up = await adminUpdateRecord('semesters', id, { name, start_date: start, end_date: end });
          if (!up.ok) { Modal.showError(up.error || 'Failed.'); return false; }
          await renderSemestersTable();
          return true;
        }
      );
    });
  });

  tbody.querySelectorAll('.del-sem-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (!confirm(`Delete semester #${id}?`)) return;
      await adminDeleteRecord('semesters', id);
      await renderSemestersTable();
    });
  });
}

/* ---------- 1.6 Courses Table ---------- */
async function renderCoursesTable() {
  const tbody = document.getElementById('table-courses-tbody');
  if (!tbody) return;

  const [res, deptRes] = await Promise.all([
    adminGetTable('courses'),
    adminGetTable('departments'),
  ]);

  if (!res.ok) return;
  const depts = deptRes.ok ? deptRes.data : [];
  const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]));

  tbody.innerHTML = res.data.map(c => `
    <tr>
      <td><strong>${c.code}</strong></td>
      <td>${c.name}</td>
      <td>${c.credit_hours} cr</td>
      <td>${deptMap[c.department_id] || 'N/A'}</td>
      <td>${c.min_credit_hours_required ? `${c.min_credit_hours_required} hrs` : 'None (0)'}</td>
      <td style="text-align: right;">
        <button class="btn btn--outline btn--sm edit-course-btn" data-id="${c.id}">Edit</button>
        <button class="btn btn--danger btn--sm del-course-btn" data-id="${c.id}" style="margin-left:4px;">Delete</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('add-course-btn')?.addEventListener('click', () => {
    Modal.open(
      'Add New Course',
      `
        <div class="form-group">
          <label>Course Code</label>
          <input id="m-code" class="input" type="text" placeholder="e.g. CS250" required>
        </div>
        <div class="form-group">
          <label>Course Name</label>
          <input id="m-name" class="input" type="text" placeholder="e.g. Computer Architecture" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Credit Hours</label>
            <input id="m-credits" class="input" type="number" min="1" max="6" value="3" required>
          </div>
          <div class="form-group">
            <label>Min Completed Credits (Case 2 Gate)</label>
            <input id="m-min-cr" class="input" type="number" min="0" value="0">
          </div>
        </div>
        <div class="form-group">
          <label>Department</label>
          <select id="m-dept" class="select" required>
            ${depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
          </select>
        </div>
      `,
      async () => {
        const code = document.getElementById('m-code').value.trim();
        const name = document.getElementById('m-name').value.trim();
        const credit_hours = Number(document.getElementById('m-credits').value);
        const min_credit_hours_required = Number(document.getElementById('m-min-cr').value || 0);
        const department_id = Number(document.getElementById('m-dept').value);

        if (!code || !name) { Modal.showError('Code and Name are required.'); return false; }
        const r = await adminCreateRecord('courses', {
          code,
          name,
          credit_hours,
          department_id,
          min_credit_hours_required,
        });

        if (!r.ok) { Modal.showError(r.error || 'Failed.'); return false; }
        await renderCoursesTable();
        await renderPrerequisitesManager();
        return true;
      }
    );
  });

  tbody.querySelectorAll('.edit-course-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const c = res.data.find(x => x.id === id);
      if (!c) return;

      Modal.open(
        `Edit Course ${c.code}`,
        `
          <div class="form-group">
            <label>Course Code</label>
            <input id="m-code" class="input" type="text" value="${c.code}" required>
          </div>
          <div class="form-group">
            <label>Course Name</label>
            <input id="m-name" class="input" type="text" value="${c.name}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Credit Hours</label>
              <input id="m-credits" class="input" type="number" min="1" max="6" value="${c.credit_hours}" required>
            </div>
            <div class="form-group">
              <label>Min Completed Credits (Case 2 Gate)</label>
              <input id="m-min-cr" class="input" type="number" min="0" value="${c.min_credit_hours_required}">
            </div>
          </div>
          <div class="form-group">
            <label>Department</label>
            <select id="m-dept" class="select">
              ${depts.map(d => `<option value="${d.id}" ${d.id === c.department_id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
        `,
        async () => {
          const code = document.getElementById('m-code').value.trim();
          const name = document.getElementById('m-name').value.trim();
          const credit_hours = Number(document.getElementById('m-credits').value);
          const min_credit_hours_required = Number(document.getElementById('m-min-cr').value || 0);
          const department_id = Number(document.getElementById('m-dept').value);

          const up = await adminUpdateRecord('courses', id, {
            code,
            name,
            credit_hours,
            department_id,
            min_credit_hours_required,
          });

          if (!up.ok) { Modal.showError(up.error || 'Failed.'); return false; }
          await renderCoursesTable();
          await renderPrerequisitesManager();
          return true;
        }
      );
    });
  });

  tbody.querySelectorAll('.del-course-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (!confirm(`Delete course #${id}?`)) return;
      await adminDeleteRecord('courses', id);
      await renderCoursesTable();
      await renderPrerequisitesManager();
    });
  });
}

/* ---------- 1.7 Course Prerequisites Manager ---------- */
async function renderPrerequisitesManager() {
  const tbody = document.getElementById('table-prereqs-tbody');
  const courseSelect = document.getElementById('prereq-course-select');
  const targetPrereqSelect = document.getElementById('prereq-target-select');
  const addBtn = document.getElementById('add-prereq-pair-btn');
  const alertEl = document.getElementById('prereq-alert');
  if (!tbody) return;

  const [pRes, cRes] = await Promise.all([
    adminGetPrerequisites(),
    adminGetTable('courses'),
  ]);

  if (!pRes.ok || !cRes.ok) return;

  // Populate dropdowns
  const courses = cRes.data;
  if (courseSelect && targetPrereqSelect) {
    const opts = courses.map(c => `<option value="${c.id}">${c.code} — ${c.name}</option>`).join('');
    courseSelect.innerHTML = opts;
    targetPrereqSelect.innerHTML = opts;
  }

  tbody.innerHTML = pRes.data.map(p => `
    <tr>
      <td><strong>${p.courseCode}</strong> (${p.courseName})</td>
      <td>&larr; requires</td>
      <td><strong>${p.prereqCode}</strong> (${p.prereqName})</td>
      <td style="text-align: right;">
        <button
          class="btn btn--danger btn--sm remove-prereq-btn"
          data-course-id="${p.course_id}"
          data-prereq-id="${p.prerequisite_course_id}">
          Remove Pair
        </button>
      </td>
    </tr>
  `).join('');

  // Add pair handler
  if (addBtn) {
    addBtn.onclick = async () => {
      hideAlert(alertEl);
      const cId = Number(courseSelect.value);
      const pId = Number(targetPrereqSelect.value);

      if (cId === pId) {
        showAlert(alertEl, 'ERROR: A course cannot be its own prerequisite (CHECK constraint course_id != prerequisite_course_id).', 'error');
        return;
      }

      const res = await adminAddPrerequisite(cId, pId);
      if (res.ok) {
        showAlert(alertEl, 'SUCCESS: Prerequisite rule added.', 'success');
        await renderPrerequisitesManager();
      } else {
        showAlert(alertEl, res.error || 'Failed to add prerequisite.', 'error');
      }
    };
  }

  tbody.querySelectorAll('.remove-prereq-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const cId = Number(e.currentTarget.dataset.courseId);
      const pId = Number(e.currentTarget.dataset.prereqId);
      if (!confirm('Remove this prerequisite relationship?')) return;
      await adminRemovePrerequisite(cId, pId);
      await renderPrerequisitesManager();
    });
  });
}

/* ---------- 1.8 Class Instances Table ---------- */
async function renderClassInstancesTable() {
  const tbody = document.getElementById('table-instances-tbody');
  if (!tbody) return;

  const [res, cRes, iRes, sRes] = await Promise.all([
    adminGetTable('class_instances'),
    adminGetTable('courses'),
    adminGetTable('instructors'),
    adminGetTable('semesters'),
  ]);

  if (!res.ok) return;

  const courseMap = Object.fromEntries(cRes.ok ? cRes.data.map(c => [c.id, c]) : []);
  const instMap = Object.fromEntries(iRes.ok ? iRes.data.map(i => [i.id, i.name]) : []);
  const semMap = Object.fromEntries(sRes.ok ? sRes.data.map(s => [s.id, s.name]) : []);

  tbody.innerHTML = res.data.map(ci => {
    const course = courseMap[ci.course_id] || { code: 'N/A', name: 'N/A' };
    return `
      <tr>
        <td><strong>#${ci.id}</strong></td>
        <td><strong>${course.code}</strong> — ${course.name}</td>
        <td>${instMap[ci.instructor_id] || 'TBD'}</td>
        <td>${semMap[ci.semester_id] || 'N/A'}</td>
        <td>${ci.current_enrolled_count} / <strong>${ci.capacity}</strong></td>
        <td style="text-align: right;">
          <button class="btn btn--outline btn--sm edit-instance-btn" data-id="${ci.id}">Edit</button>
          <button class="btn btn--danger btn--sm del-instance-btn" data-id="${ci.id}" style="margin-left:4px;">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('add-instance-btn')?.addEventListener('click', () => {
    Modal.open(
      'Schedule New Class Section',
      `
        <div class="form-group">
          <label>Course</label>
          <select id="m-course" class="select" required>
            ${(cRes.ok ? cRes.data : []).map(c => `<option value="${c.id}">${c.code} — ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Assigned Instructor</label>
          <select id="m-inst" class="select" required>
            ${(iRes.ok ? iRes.data : []).map(i => `<option value="${i.id}">${i.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Semester</label>
          <select id="m-sem" class="select" required>
            ${(sRes.ok ? sRes.data : []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Classroom Capacity (Standard: 45–60 seats)</label>
          <input id="m-cap" class="input" type="number" min="1" max="100" value="50" required>
        </div>
      `,
      async () => {
        const course_id = Number(document.getElementById('m-course').value);
        const instructor_id = Number(document.getElementById('m-inst').value);
        const semester_id = Number(document.getElementById('m-sem').value);
        const capacity = Number(document.getElementById('m-cap').value);

        const r = await adminCreateRecord('class_instances', {
          course_id,
          instructor_id,
          semester_id,
          capacity,
          current_enrolled_count: 0,
        });

        if (!r.ok) { Modal.showError(r.error || 'Failed.'); return false; }
        await renderClassInstancesTable();
        return true;
      }
    );
  });

  tbody.querySelectorAll('.edit-instance-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const ci = res.data.find(x => x.id === id);
      if (!ci) return;

      Modal.open(
        `Edit Class Section #${ci.id}`,
        `
          <div class="form-group">
            <label>Instructor</label>
            <select id="m-inst" class="select">
              ${(iRes.ok ? iRes.data : []).map(i => `<option value="${i.id}" ${i.id === ci.instructor_id ? 'selected' : ''}>${i.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Capacity</label>
            <input id="m-cap" class="input" type="number" min="1" value="${ci.capacity}">
          </div>
        `,
        async () => {
          const instructor_id = Number(document.getElementById('m-inst').value);
          const capacity = Number(document.getElementById('m-cap').value);

          const up = await adminUpdateRecord('class_instances', id, { instructor_id, capacity });
          if (!up.ok) { Modal.showError(up.error || 'Failed.'); return false; }
          await renderClassInstancesTable();
          return true;
        }
      );
    });
  });

  tbody.querySelectorAll('.del-instance-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (!confirm(`Delete class instance #${id}?`)) return;
      await adminDeleteRecord('class_instances', id);
      await renderClassInstancesTable();
    });
  });
}

/* ---------- 1.9 Pricing Rules Table ---------- */
async function renderPricingRulesTable() {
  const tbody = document.getElementById('table-pricing-tbody');
  if (!tbody) return;

  const res = await adminGetTable('pricing_rules');
  if (!res.ok) return;

  tbody.innerHTML = res.data.map(p => `
    <tr>
      <td><strong>#${p.id}</strong></td>
      <td><strong>${p.credit_hour_weight} Credit Hour(s)</strong></td>
      <td><strong>$${Number(p.price_per_hour).toFixed(2)}</strong> / hr</td>
      <td style="text-align: right;">
        <button class="btn btn--outline btn--sm edit-pricing-btn" data-id="${p.id}">Edit</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.edit-pricing-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const item = res.data.find(x => x.id === id);
      if (!item) return;

      Modal.open(
        `Edit Pricing Rule #${item.id}`,
        `
          <div class="form-group">
            <label>Credit Hour Weight</label>
            <input id="m-weight" class="input" type="number" min="1" max="10" value="${item.credit_hour_weight}">
          </div>
          <div class="form-group">
            <label>Price Per Hour ($)</label>
            <input id="m-price" class="input" type="number" step="0.5" min="1" value="${item.price_per_hour}">
          </div>
        `,
        async () => {
          const weight = Number(document.getElementById('m-weight').value);
          const price = Number(document.getElementById('m-price').value);
          const up = await adminUpdateRecord('pricing_rules', id, { credit_hour_weight: weight, price_per_hour: price });
          if (!up.ok) { Modal.showError(up.error || 'Failed.'); return false; }
          await renderPricingRulesTable();
          return true;
        }
      );
    });
  });
}

/* ---------- 1.10 Payments Table ---------- */
async function renderPaymentsTable() {
  const tbody = document.getElementById('table-payments-tbody');
  if (!tbody) return;

  const [res, sRes, semRes] = await Promise.all([
    adminGetTable('payments'),
    adminGetTable('students'),
    adminGetTable('semesters'),
  ]);

  if (!res.ok) return;

  const studentMap = Object.fromEntries(sRes.ok ? sRes.data.map(s => [s.id, s.name]) : []);
  const semMap = Object.fromEntries(semRes.ok ? semRes.data.map(s => [s.id, s.name]) : []);

  tbody.innerHTML = res.data.map(p => `
    <tr>
      <td><strong>#${p.id}</strong></td>
      <td>${studentMap[p.student_id] || `Student #${p.student_id}`}</td>
      <td>${semMap[p.semester_id] || 'N/A'}</td>
      <td><strong>$${Number(p.amount).toFixed(2)}</strong></td>
      <td><span class="badge badge--${p.status === 'paid' ? 'success' : 'warning'}">${p.status}</span></td>
      <td>${p.paid_at || '—'}</td>
      <td style="text-align: right;">
        <button class="btn btn--outline btn--sm edit-payment-btn" data-id="${p.id}">Edit</button>
        <button class="btn btn--danger btn--sm del-payment-btn" data-id="${p.id}" style="margin-left:4px;">Delete</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('add-payment-btn')?.addEventListener('click', () => {
    Modal.open(
      'Record New Student Payment',
      `
        <div class="form-group">
          <label>Student</label>
          <select id="m-std" class="select" required>
            ${(sRes.ok ? sRes.data : []).map(s => `<option value="${s.id}">${s.name} (${s.email})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Semester</label>
          <select id="m-sem" class="select" required>
            ${(semRes.ok ? semRes.data : []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Amount ($)</label>
          <input id="m-amt" class="input" type="number" step="1" min="1" value="120" required>
        </div>
        <div class="form-group">
          <label>Payment Status</label>
          <select id="m-stat" class="select">
            <option value="paid" selected>paid</option>
            <option value="pending">pending</option>
          </select>
        </div>
      `,
      async () => {
        const student_id = Number(document.getElementById('m-std').value);
        const semester_id = Number(document.getElementById('m-sem').value);
        const amount = Number(document.getElementById('m-amt').value);
        const status = document.getElementById('m-stat').value;
        const paid_at = status === 'paid' ? new Date().toISOString().replace('T', ' ').substring(0, 19) : null;

        const r = await adminCreateRecord('payments', { student_id, semester_id, amount, status, paid_at });
        if (!r.ok) { Modal.showError(r.error || 'Failed.'); return false; }
        await renderPaymentsTable();
        return true;
      }
    );
  });

  tbody.querySelectorAll('.edit-payment-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const item = res.data.find(x => x.id === id);
      if (!item) return;

      Modal.open(
        `Edit Payment #${item.id}`,
        `
          <div class="form-group">
            <label>Amount ($)</label>
            <input id="m-amt" class="input" type="number" step="1" value="${item.amount}">
          </div>
          <div class="form-group">
            <label>Payment Status</label>
            <select id="m-stat" class="select">
              <option value="paid" ${item.status === 'paid' ? 'selected' : ''}>paid</option>
              <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>pending</option>
            </select>
          </div>
        `,
        async () => {
          const amount = Number(document.getElementById('m-amt').value);
          const status = document.getElementById('m-stat').value;
          const paid_at = status === 'paid' ? (item.paid_at || new Date().toISOString().replace('T', ' ').substring(0, 19)) : null;

          const up = await adminUpdateRecord('payments', id, { amount, status, paid_at });
          if (!up.ok) { Modal.showError(up.error || 'Failed.'); return false; }
          await renderPaymentsTable();
          return true;
        }
      );
    });
  });

  tbody.querySelectorAll('.del-payment-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (!confirm(`Delete payment record #${id}?`)) return;
      await adminDeleteRecord('payments', id);
      await renderPaymentsTable();
    });
  });
}

/* ==========================================================================
   2. ADMIN REPORTS (4 Views)
   ========================================================================== */
async function initAdminReports() {
  await Promise.all([
    initReportTranscript(),
    initReportDeptEnrollment(),
    initReportTeachingLoad(),
    initReportUnpaidTuition(),
  ]);
}

/**
 * 2.1 View: Student Transcript
 */
async function initReportTranscript() {
  const select = document.getElementById('report-student-select');
  const container = document.getElementById('report-transcript-output');
  if (!select || !container) return;

  const stdRes = await adminGetTable('students');
  if (!stdRes.ok) return;

  select.innerHTML = '<option value="" disabled selected>Choose a student to view official transcript</option>' +
    stdRes.data.map(s => `<option value="${s.id}">#${s.id} — ${s.name} (${s.email})</option>`).join('');

  select.addEventListener('change', async () => {
    const studentId = Number(select.value);
    container.innerHTML = '<div class="table-empty"><p>Loading student transcript view…</p></div>';

    const res = await reportStudentTranscript(studentId);
    if (!res.ok || !res.data) {
      container.innerHTML = `<div class="alert alert--error visible">Error loading transcript view: ${res.error}</div>`;
      return;
    }

    const d = res.data;
    const semesters = Object.keys(d.semesters);

    let html = `
      <div class="info-grid" style="margin-top: var(--space-md); margin-bottom: var(--space-lg);">
        <div class="info-card">
          <div class="label">Student</div>
          <div class="value" style="font-size: 1.25rem;">${d.studentName}</div>
        </div>
        <div class="info-card">
          <div class="label">Overall GPA</div>
          <div class="value">${d.overallGpa}</div>
          <div class="subtext">Performance Band: <strong>${d.performanceBand}</strong></div>
        </div>
      </div>
    `;

    for (const sem of semesters) {
      const list = d.semesters[sem];
      html += `
        <div class="card" style="margin-bottom: var(--space-md); border: 1px solid var(--color-border); box-shadow: none;">
          <h4>${sem}</h4>
          <div class="table-wrapper" style="margin-top: var(--space-sm);">
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
                    <td><strong>${c.gradeLetter}</strong></td>
                    <td>${c.gradePoints}</td>
                    <td><span class="badge badge--${c.status === 'completed' ? 'success' : 'info'}">${c.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  });
}

/**
 * 2.2 View: Department Enrollment Stats
 */
async function initReportDeptEnrollment() {
  const tbody = document.getElementById('report-dept-tbody');
  if (!tbody) return;

  const res = await reportDepartmentEnrollmentStats();
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Error: ${res.error}</td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(r => `
    <tr>
      <td><strong>${r.departmentName}</strong></td>
      <td><strong>${r.courseCode}</strong></td>
      <td>${r.courseName}</td>
      <td>${r.creditHours} cr</td>
      <td><span class="badge badge--info">${r.activeEnrolled} active</span></td>
      <td><span class="badge badge--success">${r.completedCount} completed</span></td>
      <td><strong>${r.totalEnrolled} total</strong></td>
    </tr>
  `).join('');
}

/**
 * 2.3 View: Instructor Teaching Load
 */
async function initReportTeachingLoad() {
  const tbody = document.getElementById('report-load-tbody');
  if (!tbody) return;

  const res = await reportInstructorTeachingLoad();
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Error: ${res.error}</td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(r => `
    <tr>
      <td><strong>${r.instructorName}</strong></td>
      <td>${r.instructorEmail}</td>
      <td>${r.departmentName}</td>
      <td>${r.semesterName}</td>
      <td><strong>${r.sectionsCount} section(s)</strong></td>
      <td><span class="badge badge--neutral">${r.totalStudentsTaught} students</span></td>
    </tr>
  `).join('');
}

/**
 * 2.4 View: Unpaid Tuition
 */
async function initReportUnpaidTuition() {
  const tbody = document.getElementById('report-unpaid-tbody');
  if (!tbody) return;

  const res = await reportUnpaidTuition();
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Error: ${res.error}</td></tr>`;
    return;
  }

  if (res.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No unpaid tuition records found. All accounts clear!</td></tr>';
    return;
  }

  tbody.innerHTML = res.data.map(r => `
    <tr>
      <td><strong>${r.studentName}</strong></td>
      <td>${r.studentEmail}</td>
      <td>${r.departmentName}</td>
      <td>${r.semesterName}</td>
      <td><strong style="color: var(--color-error);">$${r.amount}</strong></td>
      <td><span class="badge badge--warning">${r.status}</span></td>
    </tr>
  `).join('');
}
