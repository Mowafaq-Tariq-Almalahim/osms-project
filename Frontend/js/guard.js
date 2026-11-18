/* ===== Role-Based Page Guard ===== */
(function () {
  const session = getSession();

  // If not logged in, redirect to login page
  if (!session.token || !session.role || !session.userId) {
    window.location.href = 'login.html';
    return;
  }

  // Map pages to required roles
  const page = window.location.pathname.split('/').pop().toLowerCase() || 'index.html';

  const roleDashboardMap = {
    admin: 'admin.html',
    instructor: 'instructor.html',
    student: 'student.html',
  };

  const pageAllowedRoles = {
    // Admin
    'admin.html': ['admin'],
    'admin-reports.html': ['admin'],

    // Instructor
    'instructor.html': ['instructor'],

    // Student
    'student.html': ['student'],
    'student-transcript.html': ['student'],
    'student-enrollment.html': ['student'],
    'student-payments.html': ['student'],
  };

  const allowed = pageAllowedRoles[page];
  if (allowed && !allowed.includes(session.role)) {
    // Role not authorized for this page -> redirect to their own dashboard
    const targetDashboard = roleDashboardMap[session.role] || 'login.html';
    window.location.href = targetDashboard;
  }
})();
