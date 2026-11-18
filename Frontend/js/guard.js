/* ===== Role Guard ===== */
(function () {
  const session = getSession();

  // If no session, go to login
  if (!session.token || !session.role) {
    window.location.href = 'login.html';
    return;
  }

  // Determine which role this page requires based on file name
  const page = window.location.pathname.split('/').pop();
  const pageRoleMap = {
    'admin.html': 'admin',
    'teacher.html': 'teacher',
    'student.html': 'student',
  };

  const requiredRole = pageRoleMap[page];

  // If the user's role doesn't match, redirect to their own dashboard
  if (requiredRole && session.role !== requiredRole) {
    window.location.href = session.role + '.html';
    return;
  }
})();
