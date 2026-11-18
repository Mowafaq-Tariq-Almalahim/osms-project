/* ===== API Layer ===== */

const API_BASE_URL = 'http://localhost:3000/api'; // Change once backend is ready

const USE_MOCK = true; // Set to false when backend is ready

/* ---------- Mock data ---------- */
const MOCK_USERS = [
  { id: 1, username: 'admin',   password: 'admin1234',   role: 'admin',   token: 'mock-token-admin' },
  { id: 2, username: 'teacher', password: 'teacher1234', role: 'teacher', token: 'mock-token-teacher' },
  { id: 3, username: 'student', password: 'student1234', role: 'student', token: 'mock-token-student' },
];

const MOCK_STUDENTS = [
  { id: 1, name: 'Ali Hassan',    marks: 85 },
  { id: 2, name: 'Sara Ahmad',    marks: 92 },
  { id: 3, name: 'Omar Khalil',   marks: 78 },
];

/* ---------- Helpers ---------- */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveSession(token, role, username) {
  localStorage.setItem('session_token', token);
  localStorage.setItem('session_role', role);
  localStorage.setItem('session_username', username);
}

function getSession() {
  return {
    token: localStorage.getItem('session_token'),
    role: localStorage.getItem('session_role'),
    username: localStorage.getItem('session_username'),
  };
}

function clearSession() {
  localStorage.removeItem('session_token');
  localStorage.removeItem('session_role');
  localStorage.removeItem('session_username');
}

/* ---------- API functions ---------- */

/**
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function login(username, password) {
  if (USE_MOCK) {
    await delay(600); // simulate latency
    const user = MOCK_USERS.find(
      u => u.username === username && u.password === password
    );
    if (!user) {
      return { ok: false, error: 'Invalid username or password.' };
    }
    saveSession(user.token, user.role, user.username);
    return { ok: true, data: { role: user.role, username: user.username } };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.message || 'Login failed.' };
    saveSession(json.token, json.role, json.username);
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

/**
 * @param {string} username
 * @param {string} password
 * @param {string} role - 'student' or 'teacher'
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function register(username, password, role) {
  if (USE_MOCK) {
    await delay(600);
    const exists = MOCK_USERS.find(u => u.username === username);
    if (exists) {
      return { ok: false, error: 'Username is already taken.' };
    }
    // In mock mode we add to the array for the session
    const newUser = {
      id: MOCK_USERS.length + 1,
      username,
      password,
      role,
      token: 'mock-token-' + Date.now(),
    };
    MOCK_USERS.push(newUser);
    return { ok: true, data: { username: newUser.username, role: newUser.role } };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.message || 'Registration failed.' };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

function logout() {
  clearSession();
  window.location.href = 'login.html';
}

/**
 * Get mock students (for dashboard pages)
 */
async function getStudents() {
  if (USE_MOCK) {
    await delay(300);
    return { ok: true, data: [...MOCK_STUDENTS] };
  }
  try {
    const session = getSession();
    const res = await fetch(`${API_BASE_URL}/students`, {
      headers: { 'Authorization': `Bearer ${session.token}` },
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.message || 'Failed to load students.' };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Get mock teachers (for admin dashboard)
 */
async function getTeachers() {
  if (USE_MOCK) {
    await delay(300);
    return {
      ok: true,
      data: [
        { id: 1, name: 'Dr. Fatima Noor',   subject: 'Mathematics' },
        { id: 2, name: 'Prof. Yusuf Amin',  subject: 'Physics' },
      ],
    };
  }
  try {
    const session = getSession();
    const res = await fetch(`${API_BASE_URL}/teachers`, {
      headers: { 'Authorization': `Bearer ${session.token}` },
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.message || 'Failed to load teachers.' };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Get own info for student dashboard
 */
async function getOwnInfo() {
  if (USE_MOCK) {
    await delay(300);
    const session = getSession();
    return {
      ok: true,
      data: {
        username: session.username,
        role: 'Student',
        fullName: session.username.charAt(0).toUpperCase() + session.username.slice(1),
        marks: 85,
        grade: 'A',
        courses: ['Database Systems', 'Data Structures', 'Web Development'],
      },
    };
  }
  try {
    const session = getSession();
    const res = await fetch(`${API_BASE_URL}/students/me`, {
      headers: { 'Authorization': `Bearer ${session.token}` },
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.message || 'Failed to load info.' };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: 'Network error.' };
  }
}
