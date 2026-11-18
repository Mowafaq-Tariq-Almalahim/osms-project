/* ===== Auth Flow ===== */
document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect to dashboard
  const session = getSession();
  if (session.token && session.role) {
    window.location.href = session.role + '.html';
    return;
  }

  /* ----- DOM refs ----- */
  const loginSection    = document.getElementById('login-section');
  const registerSection = document.getElementById('register-section');

  // Login form
  const loginForm       = document.getElementById('login-form');
  const loginUsername    = document.getElementById('login-username');
  const loginPassword   = document.getElementById('login-password');
  const loginBtn        = document.getElementById('login-btn');
  const loginAlert      = document.getElementById('login-alert');
  const loginTogglePw   = document.getElementById('login-toggle-pw');

  // Register form
  const registerForm    = document.getElementById('register-form');
  const regUsername      = document.getElementById('reg-username');
  const regPassword      = document.getElementById('reg-password');
  const regRole          = document.getElementById('reg-role');
  const regBtn           = document.getElementById('reg-btn');
  const regAlert         = document.getElementById('reg-alert');
  const regTogglePw      = document.getElementById('reg-toggle-pw');

  // Switch links
  const showRegister    = document.getElementById('show-register');
  const showLogin       = document.getElementById('show-login');

  /* ----- Toggle login/register ----- */
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

  /* ----- Password show/hide toggle ----- */
  function setupToggle(toggleBtn, inputEl) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = inputEl.type === 'password';
      inputEl.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
      inputEl.focus();
    });
  }

  setupToggle(loginTogglePw, loginPassword);
  setupToggle(regTogglePw, regPassword);

  /* ----- Validate on input ----- */
  function validateLoginForm() {
    const u = validateUsername(loginUsername.value);
    const p = validatePassword(loginPassword.value);
    loginBtn.disabled = !(u.valid && p.valid);
    return { u, p };
  }

  function validateRegForm() {
    const u = validateUsername(regUsername.value);
    const p = validatePassword(regPassword.value);
    const r = validateRole(regRole.value);
    regBtn.disabled = !(u.valid && p.valid && r.valid);
    return { u, p, r };
  }

  loginUsername.addEventListener('input', () => {
    const { u } = validateLoginForm();
    showFieldError(loginUsername, loginUsername.value ? (u.valid ? '' : u.message) : '');
  });
  loginPassword.addEventListener('input', () => {
    const { p } = validateLoginForm();
    showFieldError(loginPassword, loginPassword.value ? (p.valid ? '' : p.message) : '');
  });

  regUsername.addEventListener('input', () => {
    const { u } = validateRegForm();
    showFieldError(regUsername, regUsername.value ? (u.valid ? '' : u.message) : '');
  });
  regPassword.addEventListener('input', () => {
    const { p } = validateRegForm();
    showFieldError(regPassword, regPassword.value ? (p.valid ? '' : p.message) : '');
  });
  regRole.addEventListener('change', () => {
    validateRegForm();
  });

  // Initial state: buttons disabled
  loginBtn.disabled = true;
  regBtn.disabled = true;

  /* ----- Set loading state ----- */
  function setLoading(btn, loading) {
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.innerHTML = '<span class="spinner"></span> Please wait…';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.originalText || 'Submit';
      btn.disabled = false;
    }
  }

  /* ----- Login submit ----- */
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(loginAlert);

    // Final validation
    const u = validateUsername(loginUsername.value);
    const p = validatePassword(loginPassword.value);
    showFieldError(loginUsername, u.message);
    showFieldError(loginPassword, p.message);
    if (!u.valid || !p.valid) return;

    setLoading(loginBtn, true);

    const result = await login(loginUsername.value.trim(), loginPassword.value);

    if (result.ok) {
      // Redirect based on role
      window.location.href = result.data.role + '.html';
    } else {
      setLoading(loginBtn, false);
      showAlert(loginAlert, result.error, 'error');
    }
  });

  /* ----- Register submit ----- */
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(regAlert);

    const u = validateUsername(regUsername.value);
    const p = validatePassword(regPassword.value);
    const r = validateRole(regRole.value);
    showFieldError(regUsername, u.message);
    showFieldError(regPassword, p.message);
    if (!u.valid || !p.valid || !r.valid) return;

    setLoading(regBtn, true);

    const result = await register(regUsername.value.trim(), regPassword.value, regRole.value);

    setLoading(regBtn, false);

    if (result.ok) {
      // Switch back to login with success message
      registerSection.classList.remove('active');
      loginSection.classList.remove('hidden');
      regUsername.value = '';
      regPassword.value = '';
      regRole.value = '';
      showAlert(loginAlert, 'Account created successfully! Please log in.', 'success');
    } else {
      showAlert(regAlert, result.error, 'error');
    }
  });
});
