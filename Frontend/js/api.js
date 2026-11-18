/* ==========================================================================
   OSMS - API & Mock Data Access Layer
   All fetch requests and database simulation are centralized here.
   Matches PostgreSQL tables, views, and stored procedures.
   ========================================================================== */

const API_BASE_URL = 'http://localhost:3000/api'; // Replace when backend is ready
const USE_MOCK = false; // Set to false when connecting to the real backend

/* ==========================================================================
   GRADE SCALE MAPPING (4.0 scale)
   ========================================================================== */
const GRADE_SCALE = {
  'A+': 4.0,
  'A':  3.75,
  'A-': 3.5,
  'B+': 3.25,
  'B':  3.0,
  'B-': 2.75,
  'C+': 2.5,
  'C':  2.25,
  'C-': 2.0,
  'D+': 1.5,
  'D':  1.0,
  'F':  0.0,
};

function getPerformanceBand(gpa) {
  const val = Number(gpa);
  if (isNaN(val)) return { band: 'N/A', class: 'neutral' };
  if (val >= 3.5) return { band: 'Excellent', class: 'success' };
  if (val >= 3.0) return { band: 'Very Good', class: 'success' };
  if (val >= 2.5) return { band: 'Good', class: 'info' };
  if (val >= 2.0) return { band: 'Accepted', class: 'warning' };
  return { band: 'Weak', class: 'error' };
}

/* ==========================================================================
   MOCK DATABASE (Aligned directly with PostgreSQL Schema)
   ========================================================================== */

const DB = {
  departments: [
    { id: 1, name: 'Computer Science' },
    { id: 2, name: 'Data Science' },
  ],

  students: [
    { id: 1, name: 'Ahmad Khaled', email: 'ahmad.khaled@osms.edu', password_hash: 'student1234', major_department_id: 1, overall_gpa: 3.65, status: 'Active' },
    { id: 2, name: 'Lina Saleh',   email: 'lina.saleh@osms.edu',   password_hash: 'student1234', major_department_id: 1, overall_gpa: 3.20, status: 'Active' },
    { id: 3, name: 'Yousef Odeh',  email: 'yousef.odeh@osms.edu',  password_hash: 'student1234', major_department_id: 2, overall_gpa: 3.40, status: 'Active' },
    { id: 4, name: 'Rana Haddad',  email: 'rana.haddad@osms.edu',  password_hash: 'student1234', major_department_id: 2, overall_gpa: 2.80, status: 'Active' },
    { id: 5, name: 'Sami Nasser',  email: 'sami.nasser@osms.edu',  password_hash: 'student1234', major_department_id: 1, overall_gpa: 1.85, status: 'Probation' },
  ],

  instructors: [
    { id: 1, name: 'Dr. Fatima Noor',   email: 'fatima.noor@osms.edu',   password_hash: 'instructor1234', department_id: 1 },
    { id: 2, name: 'Prof. Yusuf Amin',  email: 'yusuf.amin@osms.edu',    password_hash: 'instructor1234', department_id: 2 },
    { id: 3, name: 'Dr. Tariq Mansoor', email: 'tariq.mansoor@osms.edu', password_hash: 'instructor1234', department_id: 1 },
  ],

  admins: [
    { id: 1, name: 'System Admin', email: 'admin@osms.edu', password_hash: 'admin1234' },
  ],

  courses: [
    // SE Track
    { id: 1,  code: 'CS101',  name: 'Intro to Programming',   credit_hours: 3, department_id: 1, min_credit_hours_required: 0 },
    { id: 2,  code: 'CS102b', name: 'Data Structures',         credit_hours: 3, department_id: 1, min_credit_hours_required: 0 },
    { id: 3,  code: 'CS105',  name: 'Discrete Mathematics',    credit_hours: 3, department_id: 1, min_credit_hours_required: 0 },
    { id: 4,  code: 'CS201b', name: 'Logic and Computation',   credit_hours: 3, department_id: 1, min_credit_hours_required: 0 },
    { id: 5,  code: 'CS210',  name: 'Algorithms',              credit_hours: 3, department_id: 1, min_credit_hours_required: 0 },
    { id: 6,  code: 'CS310',  name: 'Advanced Algorithms',     credit_hours: 3, department_id: 1, min_credit_hours_required: 0 },
    { id: 7,  code: 'CS320',  name: 'Systems Design',          credit_hours: 3, department_id: 1, min_credit_hours_required: 0 },
    { id: 8,  code: 'CS410',  name: 'Capstone Project',        credit_hours: 3, department_id: 1, min_credit_hours_required: 0 },
    // DS Track
    { id: 9,  code: 'DS101',  name: 'Intro to Data Science',   credit_hours: 3, department_id: 2, min_credit_hours_required: 0 },
    { id: 10, code: 'DS102',  name: 'Statistics Foundations',  credit_hours: 3, department_id: 2, min_credit_hours_required: 0 },
    { id: 11, code: 'DS103',  name: 'Programming for DS',      credit_hours: 3, department_id: 2, min_credit_hours_required: 0 },
    { id: 12, code: 'DS201',  name: 'Applied Statistics',      credit_hours: 3, department_id: 2, min_credit_hours_required: 0 },
    { id: 13, code: 'DS202',  name: 'Data Engineering Basics', credit_hours: 3, department_id: 2, min_credit_hours_required: 0 },
    { id: 14, code: 'DS401',  name: 'Machine Learning',        credit_hours: 3, department_id: 2, min_credit_hours_required: 12 },
    { id: 15, code: 'DS402',  name: 'Deep Learning',           credit_hours: 3, department_id: 2, min_credit_hours_required: 12 },
    { id: 16, code: 'DS501',  name: 'Data Science Capstone',   credit_hours: 3, department_id: 2, min_credit_hours_required: 0 },
    // Standalone
    { id: 17, code: 'GEN100', name: 'Life Skills',             credit_hours: 2, department_id: 1, min_credit_hours_required: 0 },
  ],

  course_prerequisites: [
    { course_id: 2,  prerequisite_course_id: 1 },  // CS101 -> CS102b
    { course_id: 4,  prerequisite_course_id: 3 },  // CS105 -> CS201b
    { course_id: 5,  prerequisite_course_id: 2 },  // CS102b -> CS210
    { course_id: 5,  prerequisite_course_id: 4 },  // CS201b -> CS210
    { course_id: 6,  prerequisite_course_id: 5 },  // CS210 -> CS310
    { course_id: 7,  prerequisite_course_id: 5 },  // CS210 -> CS320
    { course_id: 8,  prerequisite_course_id: 6 },  // CS310 -> CS410
    { course_id: 8,  prerequisite_course_id: 7 },  // CS320 -> CS410
    { course_id: 10, prerequisite_course_id: 9 },  // DS101 -> DS102
    { course_id: 11, prerequisite_course_id: 9 },  // DS101 -> DS103
    { course_id: 12, prerequisite_course_id: 10 }, // DS102 -> DS201
    { course_id: 13, prerequisite_course_id: 11 }, // DS103 -> DS202
    { course_id: 16, prerequisite_course_id: 14 }, // DS401 -> DS501
    { course_id: 16, prerequisite_course_id: 15 }, // DS402 -> DS501
  ],

  semesters: [
    { id: 1, name: 'Fall 2025',   start_date: '2025-09-01', end_date: '2025-12-20' },
    { id: 2, name: 'Spring 2026', start_date: '2026-02-01', end_date: '2026-05-30' },
  ],

  class_instances: [
    // Fall 2025 completed classes
    { id: 1, course_id: 1,  instructor_id: 1, semester_id: 1, capacity: 50, current_enrolled_count: 5 },
    { id: 2, course_id: 3,  instructor_id: 3, semester_id: 1, capacity: 50, current_enrolled_count: 3 },
    { id: 3, course_id: 9,  instructor_id: 2, semester_id: 1, capacity: 50, current_enrolled_count: 3 },
    // Spring 2026 active classes
    { id: 4, course_id: 4,  instructor_id: 3, semester_id: 2, capacity: 50, current_enrolled_count: 1 }, // CS201b
    { id: 5, course_id: 2,  instructor_id: 1, semester_id: 2, capacity: 50, current_enrolled_count: 1 }, // CS102b
    { id: 6, course_id: 5,  instructor_id: 1, semester_id: 2, capacity: 50, current_enrolled_count: 1 }, // CS210
    { id: 7, course_id: 6,  instructor_id: 1, semester_id: 2, capacity: 50, current_enrolled_count: 1 }, // CS310
    { id: 8, course_id: 7,  instructor_id: 3, semester_id: 2, capacity: 50, current_enrolled_count: 1 }, // CS320
    { id: 9, course_id: 14, instructor_id: 2, semester_id: 2, capacity: 50, current_enrolled_count: 1 }, // DS401 (needs 12 hrs)
    { id: 10,course_id: 15, instructor_id: 2, semester_id: 2, capacity: 50, current_enrolled_count: 0 }, // DS402 (needs 12 hrs)
    { id: 11,course_id: 17, instructor_id: 1, semester_id: 2, capacity: 50, current_enrolled_count: 2 }, // GEN100
  ],

  enrollments: [
    // Past completed enrollments (Fall 2025)
    // Ahmad Khaled completed CS101(A), CS105(A), CS102b(A-), CS201b(A), CS210(A-) = 17 hrs (with GEN100)
    { id: 1, student_id: 1, class_instance_id: 1, grade_letter: 'A',  grade_points: 3.75, status: 'completed' },
    { id: 2, student_id: 1, class_instance_id: 2, grade_letter: 'A',  grade_points: 3.75, status: 'completed' },
    // Lina Saleh completed CS101 only (3 hrs)
    { id: 3, student_id: 2, class_instance_id: 1, grade_letter: 'B+', grade_points: 3.25, status: 'completed' },
    // Yousef Odeh completed DS101, DS102, DS103, DS201 = 12 hrs
    { id: 4, student_id: 3, class_instance_id: 3, grade_letter: 'A',  grade_points: 3.75, status: 'completed' },
    // Rana Haddad completed DS101 only (3 hrs)
    { id: 5, student_id: 4, class_instance_id: 3, grade_letter: 'B',  grade_points: 3.00, status: 'completed' },
    // Sami Nasser completed CS101 with D
    { id: 6, student_id: 5, class_instance_id: 1, grade_letter: 'D',  grade_points: 1.00, status: 'completed' },

    // Spring 2026 Active enrollments
    { id: 7,  student_id: 1, class_instance_id: 7, grade_letter: null, grade_points: null, status: 'enrolled' }, // Ahmad in CS310
    { id: 8,  student_id: 1, class_instance_id: 8, grade_letter: null, grade_points: null, status: 'enrolled' }, // Ahmad in CS320
    { id: 9,  student_id: 3, class_instance_id: 9, grade_letter: null, grade_points: null, status: 'enrolled' }, // Yousef in DS401
    { id: 10, student_id: 5, class_instance_id: 11,grade_letter: null, grade_points: null, status: 'enrolled' }, // Sami in GEN100
  ],

  pricing_rules: [
    { id: 1, credit_hour_weight: 1, price_per_hour: 50.00 },
    { id: 2, credit_hour_weight: 2, price_per_hour: 45.00 },
    { id: 3, credit_hour_weight: 3, price_per_hour: 40.00 },
  ],

  payments: [
    { id: 1, student_id: 1, semester_id: 1, amount: 240.00, status: 'paid',    paid_at: '2025-09-02 10:00:00' },
    { id: 2, student_id: 1, semester_id: 2, amount: 240.00, status: 'paid',    paid_at: '2026-02-02 09:30:00' },
    { id: 3, student_id: 2, semester_id: 1, amount: 120.00, status: 'paid',    paid_at: '2025-09-03 11:15:00' },
    { id: 4, student_id: 2, semester_id: 2, amount: 120.00, status: 'paid',    paid_at: '2026-02-05 14:00:00' },
    { id: 5, student_id: 3, semester_id: 1, amount: 120.00, status: 'paid',    paid_at: '2025-09-02 12:00:00' },
    { id: 6, student_id: 3, semester_id: 2, amount: 120.00, status: 'paid',    paid_at: '2026-02-03 16:45:00' },
    { id: 7, student_id: 4, semester_id: 1, amount: 120.00, status: 'paid',    paid_at: '2025-09-04 15:30:00' },
    { id: 8, student_id: 4, semester_id: 2, amount: 120.00, status: 'pending', paid_at: null }, // Unpaid tuition
    { id: 9, student_id: 5, semester_id: 1, amount: 120.00, status: 'paid',    paid_at: '2025-09-05 10:20:00' },
    { id: 10,student_id: 5, semester_id: 2, amount: 90.00,  status: 'paid',    paid_at: '2026-02-01 11:00:00' },
  ],
};

/* ==========================================================================
   SESSION HELPERS (Never store raw passwords!)
   ========================================================================== */

function saveSession(token, role, userId, name, email) {
  localStorage.setItem('session_token', token);
  localStorage.setItem('session_role', role);
  localStorage.setItem('session_user_id', String(userId));
  localStorage.setItem('session_user_name', name || '');
  localStorage.setItem('session_user_email', email || '');
}

function getSession() {
  return {
    token: localStorage.getItem('session_token'),
    role: localStorage.getItem('session_role'),
    userId: localStorage.getItem('session_user_id') ? Number(localStorage.getItem('session_user_id')) : null,
    name: localStorage.getItem('session_user_name') || '',
    email: localStorage.getItem('session_user_email') || '',
  };
}

function clearSession() {
  localStorage.removeItem('session_token');
  localStorage.removeItem('session_role');
  localStorage.removeItem('session_user_id');
  localStorage.removeItem('session_user_name');
  localStorage.removeItem('session_user_email');
}

function delay(ms = 300) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ==========================================================================
   AUTH API
   ========================================================================== */

/**
 * Log in using email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function login(email, password) {
  if (USE_MOCK) {
    await delay(400);
    const cleanEmail = email.trim().toLowerCase();

    // Check Admins
    const admin = DB.admins.find(a => a.email.toLowerCase() === cleanEmail && a.password_hash === password);
    if (admin) {
      saveSession('mock-token-admin-' + admin.id, 'admin', admin.id, admin.name, admin.email);
      return { ok: true, data: { role: 'admin', userId: admin.id, name: admin.name } };
    }

    // Check Instructors
    const instructor = DB.instructors.find(i => i.email.toLowerCase() === cleanEmail && i.password_hash === password);
    if (instructor) {
      saveSession('mock-token-inst-' + instructor.id, 'instructor', instructor.id, instructor.name, instructor.email);
      return { ok: true, data: { role: 'instructor', userId: instructor.id, name: instructor.name } };
    }

    // Check Students
    const student = DB.students.find(s => s.email.toLowerCase() === cleanEmail && s.password_hash === password);
    if (student) {
      saveSession('mock-token-std-' + student.id, 'student', student.id, student.name, student.email);
      return { ok: true, data: { role: 'student', userId: student.id, name: student.name } };
    }

    return { ok: false, error: 'Invalid email or password.' };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.message || 'Login failed.' };
    saveSession(json.token, json.role, json.userId, json.name, json.email);
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: 'Network error connecting to backend.' };
  }
}

/**
 * Sign up a new STUDENT account.
 * (Admin and Instructor accounts are created only by an Admin).
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {number} major_department_id
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function register(name, email, password, major_department_id) {
  if (USE_MOCK) {
    await delay(400);
    const cleanEmail = email.trim().toLowerCase();

    // Check email uniqueness across all user tables
    const exists = DB.students.some(s => s.email.toLowerCase() === cleanEmail) ||
                   DB.instructors.some(i => i.email.toLowerCase() === cleanEmail) ||
                   DB.admins.some(a => a.email.toLowerCase() === cleanEmail);

    if (exists) {
      return { ok: false, error: 'An account with this email address already exists.' };
    }

    const newStudent = {
      id: DB.students.length ? Math.max(...DB.students.map(s => s.id)) + 1 : 1,
      name: name.trim(),
      email: cleanEmail,
      password_hash: password, // In real backend, hashed with bcrypt/argon2
      major_department_id: Number(major_department_id),
      overall_gpa: 0.0,
      status: 'Active',
    };

    DB.students.push(newStudent);
    return { ok: true, data: { userId: newStudent.id, name: newStudent.name, email: newStudent.email } };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, major_department_id }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.message || 'Registration failed.' };
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: 'Network error connecting to backend.' };
  }
}

function logout() {
  clearSession();
  window.location.href = 'login.html';
}

/* ==========================================================================
   STORED PROCEDURES & BUSINESS LOGIC
   ========================================================================== */

/**
 * Stored procedure: enroll_student(student_id, class_instance_id)
 * Checks in order:
 *  1. Class instance exists
 *  2. Not already enrolled
 *  3. Capacity available
 *  4. Course-based prerequisites (Case 1)
 *  5. Credit-hour threshold (Case 2)
 *  6. Semester tuition paid
 *  7. Inserts enrollment & updates enrolled count
 * @param {number} student_id
 * @param {number} class_instance_id
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function enroll_student(student_id, class_instance_id) {
  if (USE_MOCK) {
    await delay(350);
    const inst = DB.class_instances.find(ci => ci.id === Number(class_instance_id));
    if (!inst) {
      return { ok: false, message: 'ERROR: Class instance does not exist.' };
    }

    const course = DB.courses.find(c => c.id === inst.course_id);
    if (!course) {
      return { ok: false, message: 'ERROR: Course details not found.' };
    }

    // 1. Check if already enrolled in this class or course this semester
    const alreadyEnrolled = DB.enrollments.some(e => {
      if (e.student_id !== Number(student_id)) return false;
      if (e.class_instance_id === inst.id && e.status === 'enrolled') return true;
      const otherInst = DB.class_instances.find(ci => ci.id === e.class_instance_id);
      return otherInst && otherInst.course_id === inst.course_id && otherInst.semester_id === inst.semester_id && e.status === 'enrolled';
    });
    if (alreadyEnrolled) {
      return { ok: false, message: 'ERROR: Already enrolled in this course for this semester.' };
    }

    // 2. Capacity check
    if (inst.current_enrolled_count >= inst.capacity) {
      return { ok: false, message: `ERROR: Class is full (Capacity: ${inst.capacity}/${inst.capacity}).` };
    }

    // 3. Completed courses by student
    const completedCourseIds = DB.enrollments
      .filter(e => e.student_id === Number(student_id) && e.status === 'completed' && e.grade_letter !== 'F')
      .map(e => {
        const ci = DB.class_instances.find(x => x.id === e.class_instance_id);
        return ci ? ci.course_id : null;
      })
      .filter(Boolean);

    // 4. Case 1: Course-based prerequisites
    const prereqs = DB.course_prerequisites.filter(cp => cp.course_id === course.id);
    for (const p of prereqs) {
      if (!completedCourseIds.includes(p.prerequisite_course_id)) {
        const reqCourse = DB.courses.find(c => c.id === p.prerequisite_course_id);
        const reqName = reqCourse ? `${reqCourse.code} (${reqCourse.name})` : 'Prerequisite course';
        return { ok: false, message: `ERROR: Missing prerequisite: ${reqName} must be completed first.` };
      }
    }

    // 5. Case 2: Credit-hour threshold gate
    if (course.min_credit_hours_required > 0) {
      const completedCreditHours = completedCourseIds.reduce((sum, cid) => {
        const c = DB.courses.find(x => x.id === cid);
        return sum + (c ? c.credit_hours : 0);
      }, 0);

      if (completedCreditHours < course.min_credit_hours_required) {
        return {
          ok: false,
          message: `ERROR: Credit-hour gate not met. Requires ${course.min_credit_hours_required} completed credit hours (you have completed ${completedCreditHours} hrs).`
        };
      }
    }

    // 6. Tuition check for the semester
    const payment = DB.payments.find(p => p.student_id === Number(student_id) && p.semester_id === inst.semester_id);
    if (!payment || payment.status !== 'paid') {
      return {
        ok: false,
        message: 'ERROR: Semester tuition unpaid. Tuition must be paid in full before enrolling in courses.'
      };
    }

    // 7. Successful enrollment
    const newEnrollment = {
      id: DB.enrollments.length ? Math.max(...DB.enrollments.map(e => e.id)) + 1 : 1,
      student_id: Number(student_id),
      class_instance_id: inst.id,
      grade_letter: null,
      grade_points: null,
      status: 'enrolled',
    };
    DB.enrollments.push(newEnrollment);
    inst.current_enrolled_count += 1;

    return { ok: true, message: `SUCCESS: Enrolled successfully in ${course.code} - ${course.name}.` };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/procedures/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSession().token}`,
      },
      body: JSON.stringify({ student_id, class_instance_id }),
    });
    const json = await res.json();
    return { ok: res.ok, message: json.message };
  } catch (err) {
    return { ok: false, message: 'ERROR: Network error during enrollment.' };
  }
}

/**
 * Stored procedure: drop_enrollment(student_id, class_instance_id)
 * Checks enrollment exists and is not completed, then deletes it.
 * @param {number} student_id
 * @param {number} class_instance_id
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function drop_enrollment(student_id, class_instance_id) {
  if (USE_MOCK) {
    await delay(300);
    const index = DB.enrollments.findIndex(
      e => e.student_id === Number(student_id) && e.class_instance_id === Number(class_instance_id)
    );

    if (index === -1) {
      return { ok: false, message: 'ERROR: Enrollment record not found.' };
    }

    const enrollment = DB.enrollments[index];
    if (enrollment.status === 'completed') {
      return { ok: false, message: 'ERROR: Cannot drop a completed course (grade history locked).' };
    }

    DB.enrollments.splice(index, 1);
    const inst = DB.class_instances.find(ci => ci.id === Number(class_instance_id));
    if (inst && inst.current_enrolled_count > 0) {
      inst.current_enrolled_count -= 1;
    }

    return { ok: true, message: 'SUCCESS: Course enrollment dropped successfully.' };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/procedures/drop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSession().token}`,
      },
      body: JSON.stringify({ student_id, class_instance_id }),
    });
    const json = await res.json();
    return { ok: res.ok, message: json.message };
  } catch (err) {
    return { ok: false, message: 'ERROR: Network error during course drop.' };
  }
}

/**
 * Stored procedure: calculate_tuition(student_id, semester_id)
 * Charged per course by credit-hour weight via pricing_rules.
 * @param {number} student_id
 * @param {number} semester_id
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function calculate_tuition(student_id, semester_id) {
  if (USE_MOCK) {
    await delay(200);
    // Find courses taken this semester (enrolled + completed)
    const semesterInstances = DB.class_instances.filter(ci => ci.semester_id === Number(semester_id));
    const instanceIds = semesterInstances.map(ci => ci.id);

    const studentEnrollments = DB.enrollments.filter(
      e => e.student_id === Number(student_id) && instanceIds.includes(e.class_instance_id)
    );

    let totalAmount = 0;
    const breakdown = [];

    for (const e of studentEnrollments) {
      const ci = semesterInstances.find(x => x.id === e.class_instance_id);
      const course = ci ? DB.courses.find(c => c.id === ci.course_id) : null;
      if (course) {
        const rule = DB.pricing_rules.find(pr => pr.credit_hour_weight === course.credit_hours) ||
                     { price_per_hour: 40.00 };
        const cost = course.credit_hours * rule.price_per_hour;
        totalAmount += cost;
        breakdown.push({
          courseCode: course.code,
          courseName: course.name,
          creditHours: course.credit_hours,
          ratePerHour: rule.price_per_hour,
          cost: cost,
        });
      }
    }

    // Fixed minimum or flat base for semester registration if no courses yet enrolled
    if (breakdown.length === 0) {
      totalAmount = 120.00; // Flat base deposit for semester (e.g., standard 3 credit hr course)
    }

    const payment = DB.payments.find(
      p => p.student_id === Number(student_id) && p.semester_id === Number(semester_id)
    );

    return {
      ok: true,
      data: {
        totalAmount,
        breakdown,
        paymentStatus: payment ? payment.status : 'unpaid',
        paymentId: payment ? payment.id : null,
        paidAt: payment ? payment.paid_at : null,
      },
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/procedures/tuition?student_id=${student_id}&semester_id=${semester_id}`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Failed to calculate tuition.' };
  }
}

/**
 * Pay tuition for a semester.
 * @param {number} student_id
 * @param {number} semester_id
 * @param {number} amount
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function pay_tuition(student_id, semester_id, amount) {
  if (USE_MOCK) {
    await delay(400);
    let payment = DB.payments.find(
      p => p.student_id === Number(student_id) && p.semester_id === Number(semester_id)
    );

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (payment) {
      payment.status = 'paid';
      payment.amount = amount || payment.amount;
      payment.paid_at = nowStr;
    } else {
      payment = {
        id: DB.payments.length ? Math.max(...DB.payments.map(p => p.id)) + 1 : 1,
        student_id: Number(student_id),
        semester_id: Number(semester_id),
        amount: amount || 120.00,
        status: 'paid',
        paid_at: nowStr,
      };
      DB.payments.push(payment);
    }

    return { ok: true, message: 'SUCCESS: Tuition paid in full. You are now cleared to enroll in courses.' };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/payments/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSession().token}`,
      },
      body: JSON.stringify({ student_id, semester_id, amount }),
    });
    const json = await res.json();
    return { ok: res.ok, message: json.message };
  } catch (err) {
    return { ok: false, message: 'ERROR: Network error making payment.' };
  }
}

/* ==========================================================================
   STUDENT SCREEN QUERIES
   ========================================================================== */

/**
 * Get student dashboard data.
 * @param {number} student_id
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function getStudentDashboard(student_id) {
  if (USE_MOCK) {
    await delay(200);
    const student = DB.students.find(s => s.id === Number(student_id));
    if (!student) return { ok: false, error: 'Student not found.' };

    const dept = DB.departments.find(d => d.id === student.major_department_id);
    const band = getPerformanceBand(student.overall_gpa);
    const isProbation = student.status === 'Probation' || Number(student.overall_gpa) < 2.0;

    // Completed credit hours
    const completedEnrollments = DB.enrollments.filter(
      e => e.student_id === student.id && e.status === 'completed' && e.grade_letter !== 'F'
    );
    const completedHours = completedEnrollments.reduce((sum, e) => {
      const ci = DB.class_instances.find(c => c.id === e.class_instance_id);
      const course = ci ? DB.courses.find(x => x.id === ci.course_id) : null;
      return sum + (course ? course.credit_hours : 0);
    }, 0);

    // Active enrollments this semester
    const activeEnrollments = DB.enrollments.filter(
      e => e.student_id === student.id && e.status === 'enrolled'
    ).map(e => {
      const ci = DB.class_instances.find(c => c.id === e.class_instance_id);
      const course = ci ? DB.courses.find(x => x.id === ci.course_id) : null;
      const sem = ci ? DB.semesters.find(s => s.id === ci.semester_id) : null;
      const inst = ci ? DB.instructors.find(i => i.id === ci.instructor_id) : null;
      return {
        courseCode: course ? course.code : '',
        courseName: course ? course.name : '',
        creditHours: course ? course.credit_hours : 0,
        semester: sem ? sem.name : '',
        instructor: inst ? inst.name : 'TBD',
      };
    });

    return {
      ok: true,
      data: {
        id: student.id,
        name: student.name,
        email: student.email,
        departmentName: dept ? dept.name : 'Undeclared',
        overallGpa: Number(student.overall_gpa).toFixed(2),
        performanceBand: band.band,
        performanceClass: band.class,
        status: student.status,
        isProbation,
        completedHours,
        activeEnrollments,
      },
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/students/${student_id}/dashboard`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Get student transcript (matches view_student_transcript).
 * @param {number} student_id
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function getStudentTranscript(student_id) {
  if (USE_MOCK) {
    await delay(250);
    const student = DB.students.find(s => s.id === Number(student_id));
    if (!student) return { ok: false, error: 'Student not found.' };

    const records = DB.enrollments
      .filter(e => e.student_id === Number(student_id))
      .map(e => {
        const ci = DB.class_instances.find(x => x.id === e.class_instance_id);
        const course = ci ? DB.courses.find(c => c.id === ci.course_id) : null;
        const sem = ci ? DB.semesters.find(s => s.id === ci.semester_id) : null;
        return {
          enrollmentId: e.id,
          semesterId: sem ? sem.id : 0,
          semesterName: sem ? sem.name : 'Unknown Semester',
          courseCode: course ? course.code : 'N/A',
          courseName: course ? course.name : 'N/A',
          creditHours: course ? course.credit_hours : 0,
          gradeLetter: e.grade_letter || '—',
          gradePoints: e.grade_points !== null && e.grade_points !== undefined ? Number(e.grade_points).toFixed(2) : '—',
          status: e.status,
        };
      });

    // Group by semester
    const semesterMap = {};
    for (const r of records) {
      if (!semesterMap[r.semesterName]) {
        semesterMap[r.semesterName] = [];
      }
      semesterMap[r.semesterName].push(r);
    }

    return {
      ok: true,
      data: {
        studentName: student.name,
        overallGpa: Number(student.overall_gpa).toFixed(2),
        performanceBand: getPerformanceBand(student.overall_gpa).band,
        semesters: semesterMap,
      },
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/views/transcript?student_id=${student_id}`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Get open class instances for enrollment screen.
 * @param {number} student_id
 * @param {number} semester_id
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function getEnrollmentClasses(student_id, semester_id = 2) {
  if (USE_MOCK) {
    await delay(300);
    const classes = DB.class_instances
      .filter(ci => ci.semester_id === Number(semester_id))
      .map(ci => {
        const course = DB.courses.find(c => c.id === ci.course_id);
        const instructor = DB.instructors.find(i => i.id === ci.instructor_id);
        const enrollment = DB.enrollments.find(
          e => e.student_id === Number(student_id) && e.class_instance_id === ci.id
        );

        return {
          classInstanceId: ci.id,
          courseCode: course ? course.code : '',
          courseName: course ? course.name : '',
          creditHours: course ? course.credit_hours : 0,
          minCreditHoursRequired: course ? course.min_credit_hours_required : 0,
          instructorName: instructor ? instructor.name : 'TBD',
          capacity: ci.capacity,
          currentEnrolledCount: ci.current_enrolled_count,
          isFull: ci.current_enrolled_count >= ci.capacity,
          enrollmentStatus: enrollment ? enrollment.status : null, // 'enrolled', 'completed', or null
          canDrop: enrollment && enrollment.status === 'enrolled',
        };
      });

    return { ok: true, data: classes };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/classes/open?semester_id=${semester_id}&student_id=${student_id}`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/* ==========================================================================
   INSTRUCTOR SCREEN QUERIES & ACTIONS
   ========================================================================== */

/**
 * Get classes taught by instructor.
 * @param {number} instructor_id
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function getInstructorClasses(instructor_id) {
  if (USE_MOCK) {
    await delay(250);
    const classes = DB.class_instances
      .filter(ci => ci.instructor_id === Number(instructor_id))
      .map(ci => {
        const course = DB.courses.find(c => c.id === ci.course_id);
        const sem = DB.semesters.find(s => s.id === ci.semester_id);
        return {
          id: ci.id,
          courseCode: course ? course.code : 'N/A',
          courseName: course ? course.name : 'N/A',
          creditHours: course ? course.credit_hours : 0,
          semesterName: sem ? sem.name : 'N/A',
          semesterId: ci.semester_id,
          capacity: ci.capacity,
          currentEnrolledCount: ci.current_enrolled_count,
        };
      });
    return { ok: true, data: classes };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/instructors/${instructor_id}/classes`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Get student roster for a class instance.
 * @param {number} class_instance_id
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function getClassRoster(class_instance_id) {
  if (USE_MOCK) {
    await delay(250);
    const ci = DB.class_instances.find(x => x.id === Number(class_instance_id));
    if (!ci) return { ok: false, error: 'Class instance not found.' };

    const course = DB.courses.find(c => c.id === ci.course_id);
    const sem = DB.semesters.find(s => s.id === ci.semester_id);

    const enrollments = DB.enrollments
      .filter(e => e.class_instance_id === Number(class_instance_id))
      .map(e => {
        const student = DB.students.find(s => s.id === e.student_id);
        const dept = student ? DB.departments.find(d => d.id === student.major_department_id) : null;
        return {
          enrollmentId: e.id,
          studentId: e.student_id,
          studentName: student ? student.name : 'Unknown',
          studentEmail: student ? student.email : 'Unknown',
          departmentName: dept ? dept.name : 'Undeclared',
          gradeLetter: e.grade_letter,
          gradePoints: e.grade_points,
          status: e.status,
        };
      });

    return {
      ok: true,
      data: {
        classInstanceId: ci.id,
        courseCode: course ? course.code : '',
        courseName: course ? course.name : '',
        semesterName: sem ? sem.name : '',
        students: enrollments,
      },
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/classes/${class_instance_id}/roster`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Update student grade (instructor action).
 * Recalculates student overall GPA (simulates trigger enrollment_gpa_update).
 * @param {number} enrollment_id
 * @param {string} grade_letter
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function updateGrade(enrollment_id, grade_letter) {
  if (USE_MOCK) {
    await delay(300);
    const enrollment = DB.enrollments.find(e => e.id === Number(enrollment_id));
    if (!enrollment) {
      return { ok: false, message: 'ERROR: Enrollment record not found.' };
    }

    if (!GRADE_SCALE.hasOwnProperty(grade_letter)) {
      return { ok: false, message: 'ERROR: Invalid grade letter.' };
    }

    enrollment.grade_letter = grade_letter;
    enrollment.grade_points = GRADE_SCALE[grade_letter];
    enrollment.status = 'completed'; // When graded, marked completed

    // Recalculate student GPA (Trigger: enrollment_gpa_update)
    recalculateStudentGpa(enrollment.student_id);

    return { ok: true, message: `SUCCESS: Grade updated to ${grade_letter} (${GRADE_SCALE[grade_letter].toFixed(2)} pts).` };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/enrollments/${enrollment_id}/grade`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSession().token}`,
      },
      body: JSON.stringify({ grade_letter }),
    });
    const json = await res.json();
    return { ok: res.ok, message: json.message };
  } catch (err) {
    return { ok: false, message: 'ERROR: Network error updating grade.' };
  }
}

/**
 * Helper to recalculate student GPA across completed courses.
 */
function recalculateStudentGpa(student_id) {
  const student = DB.students.find(s => s.id === Number(student_id));
  if (!student) return;

  const completed = DB.enrollments.filter(
    e => e.student_id === student.id && e.status === 'completed' && e.grade_points !== null
  );

  if (completed.length === 0) {
    student.overall_gpa = 0.0;
    return;
  }

  let totalWeighted = 0;
  let totalHours = 0;

  for (const e of completed) {
    const ci = DB.class_instances.find(x => x.id === e.class_instance_id);
    const course = ci ? DB.courses.find(c => c.id === ci.course_id) : null;
    const hours = course ? course.credit_hours : 3;
    totalWeighted += e.grade_points * hours;
    totalHours += hours;
  }

  student.overall_gpa = totalHours > 0 ? Number((totalWeighted / totalHours).toFixed(2)) : 0.0;
  if (student.overall_gpa < 2.0) {
    student.status = 'Probation';
  } else if (student.status === 'Probation' && student.overall_gpa >= 2.0) {
    student.status = 'Active';
  }
}

/* ==========================================================================
   ADMIN MANAGEMENT CRUD & REPORTS
   ========================================================================== */

/**
 * Generic getter for admin tables.
 * @param {string} table - e.g. 'students', 'instructors', 'admins', 'departments', 'courses', 'semesters', 'class_instances', 'pricing_rules', 'payments'
 */
async function adminGetTable(table) {
  if (USE_MOCK) {
    await delay(150);
    if (!DB[table]) return { ok: false, error: 'Table not found.' };

    // Enrich rows for human readability where applicable
    const rows = DB[table].map(r => ({ ...r }));
    return { ok: true, data: rows };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/${table}`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Add a record in a table.
 */
async function adminCreateRecord(table, recordData) {
  if (USE_MOCK) {
    await delay(250);
    if (!DB[table]) return { ok: false, error: 'Table not found.' };

    // Prevent duplicate email
    if (['students', 'instructors', 'admins'].includes(table) && recordData.email) {
      const cleanEmail = recordData.email.trim().toLowerCase();
      const duplicate = DB.students.some(s => s.email.toLowerCase() === cleanEmail) ||
                        DB.instructors.some(i => i.email.toLowerCase() === cleanEmail) ||
                        DB.admins.some(a => a.email.toLowerCase() === cleanEmail);
      if (duplicate) {
        return { ok: false, error: 'Email already in use.' };
      }
    }

    const nextId = DB[table].length ? Math.max(...DB[table].map(x => x.id || 0)) + 1 : 1;
    const newRecord = { id: nextId, ...recordData };
    DB[table].push(newRecord);
    return { ok: true, data: newRecord };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSession().token}`,
      },
      body: JSON.stringify(recordData),
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Update a record in a table.
 */
async function adminUpdateRecord(table, id, updateData) {
  if (USE_MOCK) {
    await delay(250);
    const item = DB[table].find(x => x.id === Number(id));
    if (!item) return { ok: false, error: 'Record not found.' };

    Object.assign(item, updateData);
    return { ok: true, data: item };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/${table}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSession().token}`,
      },
      body: JSON.stringify(updateData),
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Delete a record from a table.
 */
async function adminDeleteRecord(table, id) {
  if (USE_MOCK) {
    await delay(250);
    const idx = DB[table].findIndex(x => x.id === Number(id));
    if (idx === -1) return { ok: false, error: 'Record not found.' };

    DB[table].splice(idx, 1);
    return { ok: true };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/${table}/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * Course Prerequisites Management
 * Block course being its own prerequisite: course_id != prerequisite_course_id
 */
async function adminGetPrerequisites() {
  if (USE_MOCK) {
    await delay(150);
    const list = DB.course_prerequisites.map(cp => {
      const course = DB.courses.find(c => c.id === cp.course_id);
      const prereq = DB.courses.find(c => c.id === cp.prerequisite_course_id);
      return {
        course_id: cp.course_id,
        prerequisite_course_id: cp.prerequisite_course_id,
        courseCode: course ? course.code : 'N/A',
        courseName: course ? course.name : 'N/A',
        prereqCode: prereq ? prereq.code : 'N/A',
        prereqName: prereq ? prereq.name : 'N/A',
      };
    });
    return { ok: true, data: list };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/course_prerequisites`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

async function adminAddPrerequisite(course_id, prerequisite_course_id) {
  const cId = Number(course_id);
  const pId = Number(prerequisite_course_id);

  if (cId === pId) {
    return { ok: false, error: 'A course cannot be its own prerequisite.' };
  }

  if (USE_MOCK) {
    await delay(250);
    const exists = DB.course_prerequisites.some(
      cp => cp.course_id === cId && cp.prerequisite_course_id === pId
    );
    if (exists) {
      return { ok: false, error: 'This prerequisite pair already exists.' };
    }

    DB.course_prerequisites.push({ course_id: cId, prerequisite_course_id: pId });
    return { ok: true };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/course_prerequisites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSession().token}`,
      },
      body: JSON.stringify({ course_id: cId, prerequisite_course_id: pId }),
    });
    const json = await res.json();
    return { ok: res.ok, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

async function adminRemovePrerequisite(course_id, prerequisite_course_id) {
  const cId = Number(course_id);
  const pId = Number(prerequisite_course_id);

  if (USE_MOCK) {
    await delay(200);
    const idx = DB.course_prerequisites.findIndex(
      cp => cp.course_id === cId && cp.prerequisite_course_id === pId
    );
    if (idx === -1) return { ok: false, error: 'Prerequisite not found.' };

    DB.course_prerequisites.splice(idx, 1);
    return { ok: true };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/course_prerequisites`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSession().token}`,
      },
      body: JSON.stringify({ course_id: cId, prerequisite_course_id: pId }),
    });
    const json = await res.json();
    return { ok: res.ok, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/* ==========================================================================
   ADMIN REPORT VIEWS (4 Database Views)
   ========================================================================== */

/**
 * 1. view_student_transcript (for Admin inspection of any student)
 */
async function reportStudentTranscript(student_id) {
  return await getStudentTranscript(student_id);
}

/**
 * 2. view_department_enrollment_stats
 * Per-course total/completed/currently-enrolled counts by department
 */
async function reportDepartmentEnrollmentStats() {
  if (USE_MOCK) {
    await delay(250);
    const stats = [];

    for (const course of DB.courses) {
      const dept = DB.departments.find(d => d.id === course.department_id);
      const instances = DB.class_instances.filter(ci => ci.course_id === course.id);
      const instanceIds = instances.map(ci => ci.id);

      const enrollments = DB.enrollments.filter(e => instanceIds.includes(e.class_instance_id));
      const activeCount = enrollments.filter(e => e.status === 'enrolled').length;
      const completedCount = enrollments.filter(e => e.status === 'completed').length;
      const totalCount = enrollments.length;

      stats.push({
        departmentName: dept ? dept.name : 'Unknown',
        courseCode: course.code,
        courseName: course.name,
        creditHours: course.credit_hours,
        activeEnrolled: activeCount,
        completedCount: completedCount,
        totalEnrolled: totalCount,
      });
    }

    return { ok: true, data: stats };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/reports/department_enrollment_stats`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * 3. view_instructor_teaching_load
 * Sections taught + total students per instructor per semester
 */
async function reportInstructorTeachingLoad() {
  if (USE_MOCK) {
    await delay(250);
    const rows = [];

    for (const inst of DB.instructors) {
      const dept = DB.departments.find(d => d.id === inst.department_id);

      for (const sem of DB.semesters) {
        const sections = DB.class_instances.filter(
          ci => ci.instructor_id === inst.id && ci.semester_id === sem.id
        );

        if (sections.length > 0) {
          const totalStudents = sections.reduce((sum, s) => sum + s.current_enrolled_count, 0);
          rows.push({
            instructorName: inst.name,
            instructorEmail: inst.email,
            departmentName: dept ? dept.name : 'Unknown',
            semesterName: sem.name,
            sectionsCount: sections.length,
            totalStudentsTaught: totalStudents,
          });
        }
      }
    }

    return { ok: true, data: rows };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/reports/instructor_teaching_load`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/**
 * 4. view_unpaid_tuition
 * Students with a non-'paid' payment status
 */
async function reportUnpaidTuition() {
  if (USE_MOCK) {
    await delay(200);
    const unpaid = DB.payments
      .filter(p => p.status !== 'paid')
      .map(p => {
        const student = DB.students.find(s => s.id === p.student_id);
        const dept = student ? DB.departments.find(d => d.id === student.major_department_id) : null;
        const sem = DB.semesters.find(s => s.id === p.semester_id);
        return {
          paymentId: p.id,
          studentName: student ? student.name : 'Unknown',
          studentEmail: student ? student.email : 'Unknown',
          departmentName: dept ? dept.name : 'Unknown',
          semesterName: sem ? sem.name : 'Unknown',
          amount: Number(p.amount).toFixed(2),
          status: p.status,
        };
      });

    return { ok: true, data: unpaid };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/reports/unpaid_tuition`, {
      headers: { 'Authorization': `Bearer ${getSession().token}` },
    });
    const json = await res.json();
    return { ok: res.ok, data: json, error: json.message };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}
