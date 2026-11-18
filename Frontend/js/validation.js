/* ===== Validation ===== */

/**
 * Validate a username field.
 * @param {string} value
 * @returns {{ valid: boolean, message: string }}
 */
function validateUsername(value) {
  if (!value || !value.trim()) {
    return { valid: false, message: 'Username is required.' };
  }
  return { valid: true, message: '' };
}

/**
 * Validate a password field.
 * @param {string} value
 * @returns {{ valid: boolean, message: string }}
 */
function validatePassword(value) {
  if (!value) {
    return { valid: false, message: 'Password is required.' };
  }
  if (value.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters.' };
  }
  return { valid: true, message: '' };
}

/**
 * Validate role selection.
 * @param {string} value
 * @returns {{ valid: boolean, message: string }}
 */
function validateRole(value) {
  if (!value) {
    return { valid: false, message: 'Please select a role.' };
  }
  return { valid: true, message: '' };
}

/**
 * Show or clear an error on a field.
 * @param {HTMLInputElement} input
 * @param {string} message  - empty string clears the error
 */
function showFieldError(input, message) {
  const group = input.closest('.form-group');
  if (!group) return;
  let errorEl = group.querySelector('.field-error');
  if (!errorEl) {
    errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.setAttribute('role', 'alert');
    group.appendChild(errorEl);
  }
  errorEl.textContent = message;
  if (message) {
    input.classList.add('input--error');
  } else {
    input.classList.remove('input--error');
  }
}

/**
 * Show a general alert message.
 * @param {HTMLElement} alertEl
 * @param {string} message
 * @param {'error'|'success'} type
 */
function showAlert(alertEl, message, type) {
  alertEl.textContent = message;
  alertEl.className = 'alert alert--' + type + ' visible';
}

/**
 * Hide the general alert.
 * @param {HTMLElement} alertEl
 */
function hideAlert(alertEl) {
  alertEl.className = 'alert';
  alertEl.textContent = '';
}
