/* ===== Validation Helpers ===== */

/**
 * Validate email address format.
 * @param {string} value
 * @returns {{ valid: boolean, message: string }}
 */
function validateEmail(value) {
  if (!value || !value.trim()) {
    return { valid: false, message: 'Email address is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.trim())) {
    return { valid: false, message: 'Please enter a valid email address.' };
  }
  return { valid: true, message: '' };
}

/**
 * Validate a password field (at least 8 characters).
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
 * Validate a generic required text field.
 * @param {string} value
 * @param {string} fieldName
 * @returns {{ valid: boolean, message: string }}
 */
function validateRequired(value, fieldName = 'This field') {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { valid: false, message: `${fieldName} is required.` };
  }
  return { valid: true, message: '' };
}

/**
 * Validate positive number.
 * @param {number|string} value
 * @param {number} min
 * @param {number} max
 * @param {string} fieldName
 * @returns {{ valid: boolean, message: string }}
 */
function validateNumber(value, min = 0, max = Infinity, fieldName = 'Value') {
  if (value === '' || value === null || value === undefined) {
    return { valid: false, message: `${fieldName} is required.` };
  }
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, message: `${fieldName} must be a valid number.` };
  }
  if (num < min) {
    return { valid: false, message: `${fieldName} must be at least ${min}.` };
  }
  if (num > max) {
    return { valid: false, message: `${fieldName} must be at most ${max}.` };
  }
  return { valid: true, message: '' };
}

/**
 * Show or clear an error message on a form input element.
 * @param {HTMLElement} input
 * @param {string} message - empty string clears the error
 */
function showFieldError(input, message) {
  if (!input) return;
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
 * Show a general alert banner.
 * @param {HTMLElement} alertEl
 * @param {string} message
 * @param {'error'|'success'|'warning'|'info'} type
 */
function showAlert(alertEl, message, type = 'error') {
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.className = `alert alert--${type} visible`;
}

/**
 * Hide general alert.
 * @param {HTMLElement} alertEl
 */
function hideAlert(alertEl) {
  if (!alertEl) return;
  alertEl.className = 'alert';
  alertEl.textContent = '';
}
