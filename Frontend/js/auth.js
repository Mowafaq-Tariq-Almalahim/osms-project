/* ===== Authentication Logic (Login & Student Sign-up) ===== */

document.addEventListener('DOMContentLoaded', async () => {
  // If already logged in, redirect to respective dashboard
  const session = getSession();
  if (session.token && session.role && session.userId) {
    const roleMap = {
      admin: 'admin.html',
      instructor: 'instructor.html',
      student: 'student.html',
    };
    window.location.href = roleMap[session.role] || 'student.html';
    return;
  }

  /* ----- DOM Elements ----- */
  const loginSection    = document.getElementById('login-section');
  const registerSection = document.getElementById('register-section');

  // Login form elements
  const loginForm     = document.getElementById('login-form');
  const loginEmail    = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginBtn      = document.getElementById('login-btn');
  const loginAlert    = document.getElementById('login-alert');
  const loginTogglePw = document.getElementById('login-toggle-pw');

  // Register form elements (Student-only)
  const registerForm  = document.getElementById('register-form');
  const regName       = document.getElementById('reg-name');
  const regEmail      = document.getElementById('reg-email');
  const regPassword   = document.getElementById('reg-password');
  const regDept       = document.getElementById('reg-department');
  const regBtn        = document.getElementById('reg-btn');
  const regAlert      = document.getElementById('reg-alert');
  const regTogglePw   = document.getElementById('reg-toggle-pw');

  // Switch links
  const showRegister = document.getElementById('show-register');
  const showLogin    = document.getElementById('show-login');

  /* ----- Populate Departments in Register Form ----- */
  if (regDept) {
    const deptRes = await adminGetTable('departments');
    if (deptRes.ok && deptRes.data) {
      regDept.innerHTML = '<option value="" disabled selected>Select your major department</option>' +
        deptRes.data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    }
  }

  /* ----- Toggle Login / Register View ----- */
  showRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginSection.classList.add('hidden');
    registerSection.classList.add('active');
    hideAlert(loginAlert);
    hideAlert(regAlert);
  });

  showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerSection.classList.remove('active');
    loginSection.classList.remove('hidden');
    hideAlert(loginAlert);
    hideAlert(regAlert);
  });

  /* ----- Password Show/Hide Toggle ----- */
  function setupPasswordToggle(toggleBtn, inputEl) {
    if (!toggleBtn || !inputEl) return;
    toggleBtn.addEventListener('click', () => {
      const isPassword = inputEl.type === 'password';
      inputEl.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
      inputEl.focus();
    });
  }

  setupPasswordToggle(loginTogglePw, loginPassword);
  setupPasswordToggle(regTogglePw, regPassword);

  /* ----- Form Validation on Input ----- */
  function checkLoginFormValidity() {
    const e = validateEmail(loginEmail.value);
    const p = validatePassword(loginPassword.value);
    loginBtn.disabled = !(e.valid && p.valid);
    return { e, p };
  }

  function checkRegFormValidity() {
    const n = validateRequired(regName.value, 'Full Name');
    const e = validateEmail(regEmail.value);
    const p = validatePassword(regPassword.value);
    const d = validateRequired(regDept.value, 'Department');
    regBtn.disabled = !(n.valid && e.valid && p.valid && d.valid);
    return { n, e, p, d };
  }

  loginEmail.addEventListener('input', () => {
    const { e } = checkLoginFormValidity();
    showFieldError(loginEmail, loginEmail.value ? (e.valid ? '' : e.message) : '');
  });

  loginPassword.addEventListener('input', () => {
    const { p } = checkLoginFormValidity();
    showFieldError(loginPassword, loginPassword.value ? (p.valid ? '' : p.message) : '');
  });

  regName.addEventListener('input', () => {
    const { n } = checkRegFormValidity();
    showFieldError(regName, regName.value ? (n.valid ? '' : n.message) : '');
  });

  regEmail.addEventListener('input', () => {
    const { e } = checkRegFormValidity();
    showFieldError(regEmail, regEmail.value ? (e.valid ? '' : e.message) : '');
  });

  regPassword.addEventListener('input', () => {
    const { p } = checkRegFormValidity();
    showFieldError(regPassword, regPassword.value ? (p.valid ? '' : p.message) : '');
  });

  regDept.addEventListener('change', () => {
    const { d } = checkRegFormValidity();
    showFieldError(regDept, regDept.value ? (d.valid ? '' : d.message) : '');
  });

  // Initial state
  loginBtn.disabled = true;
  regBtn.disabled = true;

  /* ----- Loading State Helper ----- */
  function setButtonLoading(btn, isLoading, defaultText) {
    if (isLoading) {
      btn.dataset.original = btn.textContent;
      btn.innerHTML = '<span class="spinner"></span> Please wait…';
      btn.disabled = true;
    } else {
      btn.innerHTML = defaultText || btn.dataset.original || 'Submit';
      btn.disabled = false;
    }
  }

  /* ----- Login Submit ----- */
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(loginAlert);

    const emailCheck = validateEmail(loginEmail.value);
    const passCheck = validatePassword(loginPassword.value);
    showFieldError(loginEmail, emailCheck.message);
    showFieldError(loginPassword, passCheck.message);

    if (!emailCheck.valid || !passCheck.valid) return;

    setButtonLoading(loginBtn, true);

    const res = await login(loginEmail.value, loginPassword.value);

    if (res.ok) {
      const role = res.data.role;
      if (role === 'admin') {
        window.location.href = 'admin.html';
      } else if (role === 'instructor') {
        window.location.href = 'instructor.html';
      } else {
        window.location.href = 'student.html';
      }
    } else {
      setButtonLoading(loginBtn, false, 'Sign In');
      showAlert(loginAlert, res.error || 'Login failed.', 'error');
    }
  });

  /* ----- Student Registration Submit ----- */
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(regAlert);

    const n = validateRequired(regName.value, 'Full Name');
    const em = validateEmail(regEmail.value);
    const p = validatePassword(regPassword.value);
    const d = validateRequired(regDept.value, 'Department');

    showFieldError(regName, n.message);
    showFieldError(regEmail, em.message);
    showFieldError(regPassword, p.message);
    showFieldError(regDept, d.message);

    if (!n.valid || !em.valid || !p.valid || !d.valid) return;

    setButtonLoading(regBtn, true);

    const res = await register(
      regName.value,
      regEmail.value,
      regPassword.value,
      Number(regDept.value)
    );

    setButtonLoading(regBtn, false, 'Create Student Account');

    if (res.ok) {
      // Clear registration form and switch back to login
      registerForm.reset();
      registerSection.classList.remove('active');
      loginSection.classList.remove('hidden');

      // Pre-fill email in login form
      loginEmail.value = regEmail.value;
      showAlert(loginAlert, 'Student account created successfully! Please sign in with your email and password.', 'success');
    } else {
      showAlert(regAlert, res.error || 'Registration failed.', 'error');
    }
  });
});
