# OSMS — Online School Management System (Frontend)

Modern, accessible, responsive frontend built exclusively with **vanilla HTML, CSS, and JavaScript** (no external frameworks, build tools, or npm packages). Fully aligned with the PostgreSQL institutional database schema.

---

## 1. Quick Start & How to Open

1. Navigate to the `Frontend/` folder.
2. Double-click `index.html` (or `login.html`) to open in any web browser (Chrome, Edge, Firefox, Safari).
3. The application runs immediately with client-side mock data simulating PostgreSQL tables, stored procedures, triggers, and views.

### Demo Credentials (Password is min. 8 characters)

| Role | Email Address | Password | Landing Page |
|---|---|---|---|
| **System Admin** | `admin@osms.edu` | `admin1234` | `admin.html` |
| **Instructor** | `fatima.noor@osms.edu` | `instructor1234` | `instructor.html` |
| **Instructor** | `yusuf.amin@osms.edu` | `instructor1234` | `instructor.html` |
| **Student (Active, High GPA)** | `ahmad.khaled@osms.edu` | `student1234` | `student.html` |
| **Student (Active, DS Track)** | `yousef.odeh@osms.edu` | `student1234` | `student.html` |
| **Student (Unpaid Tuition)** | `rana.haddad@osms.edu` | `student1234` | `student.html` |
| **Student (Academic Probation)** | `sami.nasser@osms.edu` | `student1234` | `student.html` |

*Note: New students can register themselves via the "Create student account" form on `login.html`. Faculty and Admin accounts can only be provisioned by an administrator.*

---

## 2. Connecting to the Backend

All backend communication and mock data live in a single file: `js/api.js`.

To connect the frontend to the real backend:
1. Open `Frontend/js/api.js`.
2. Update **Line 7**:
   ```javascript
   const API_BASE_URL = 'http://localhost:8000/api'; // Replace with your backend URL
   ```
3. Update **Line 8**:
   ```javascript
   const USE_MOCK = false; // Set to false to hit the live backend API
   ```

---

## 3. Folder & Screen Structure

```
Frontend/
├── index.html                   (Redirects to login.html)
├── login.html                   (Login with Email/Password & Student Registration)
├── student.html                 (Student Dashboard: GPA, probation alert, term overview)
├── student-transcript.html      (Student Academic Transcript by semester)
├── student-enrollment.html      (Student Registration: open sections, enroll/drop)
├── student-payments.html        (Student Financials: tuition calculation & pay button)
├── instructor.html              (Instructor Portal: assigned classes, roster & 4.0 grading)
├── admin.html                   (Admin Portal: CRUD for users, courses, sections, rules, payments)
├── admin-reports.html           (Admin Reports: 4 view tabs matching DB views)
├── css/
│   ├── variables.css            (Design tokens: cream #F5F0E6, white card, grey palette)
│   ├── base.css                 (CSS reset, typography, focus outlines)
│   ├── components.css           (Cards, tables, modals, badges, inputs, buttons, tabs)
│   └── auth.css                 (Authentication screen specific layout)
├── js/
│   ├── api.js                   (API fetch layer + PostgreSQL mock database)
│   ├── auth.js                  (Login & Student registration form controller)
│   ├── guard.js                 (Role-based page guard & route protection)
│   ├── validation.js            (Input validation helpers: email format, 8-char password)
│   ├── student.js               (Student portal logic: dashboard, transcript, enrollment, tuition)
│   ├── instructor.js            (Instructor portal logic: roster & 4.0 grade updates)
│   └── admin.js                 (Admin management CRUD + dynamic modals + analytical reports)
└── assets/                      (Icons & imagery)
```

---

## 4. Backend API Specification & Stored Procedure Mapping

The backend engineering team can implement the endpoints listed below. Every function in `js/api.js` directly maps to these endpoints and PostgreSQL database objects:

### A. Authentication
| Frontend Function | HTTP Method & Path | PostgreSQL Table / Logic | Description |
|---|---|---|---|
| `login(email, password)` | `POST /api/auth/login` | `admins`, `instructors`, `students` | Authenticates email & password hash; returns JWT token, user role, and user ID. |
| `register(name, email, password, major_department_id)` | `POST /api/auth/register` | `students` | Registers a new student account (students only). |
| `logout()` | Client-side only | `localStorage` | Clears session token, role, and user ID, then redirects to `login.html`. |

### B. Stored Procedures & Business Logic
| Frontend Function | HTTP Method & Path | PostgreSQL Procedure / Function | Description |
|---|---|---|---|
| `enroll_student(student_id, class_instance_id)` | `POST /api/procedures/enroll` | `SELECT enroll_student(p_student_id, p_class_instance_id);` | Validates section capacity, Case 1 prerequisites, Case 2 credit gates, and paid tuition. Returns `'SUCCESS: ...'` or `'ERROR: ...'`. |
| `drop_enrollment(student_id, class_instance_id)` | `POST /api/procedures/drop` | `SELECT drop_enrollment(p_student_id, p_class_instance_id);` | Drops an active enrollment and decrements section enrolled count. Blocks dropping completed courses. |
| `calculate_tuition(student_id, semester_id)` | `GET /api/procedures/tuition` | `SELECT calculate_tuition(p_student_id, p_semester_id);` | Computes tuition based on credit hours and `pricing_rules`. Returns total and breakdown. |
| `pay_tuition(student_id, semester_id, amount)` | `POST /api/payments/pay` | `payments` table | Inserts or updates payment record with status `'paid'` and sets `paid_at = NOW()`. |

### C. Student Views & Queries
| Frontend Function | HTTP Method & Path | PostgreSQL Source | Description |
|---|---|---|---|
| `getStudentDashboard(student_id)` | `GET /api/students/{id}/dashboard` | `students` joined with `departments` & `enrollments` | Returns student info, major, overall GPA, performance band, probation status, and active courses. |
| `getStudentTranscript(student_id)` | `GET /api/views/transcript?student_id={id}` | `view_student_transcript` | Returns courses, letter grades, 4.0 grade points, and completion status grouped by semester. |
| `getEnrollmentClasses(student_id, semester_id)` | `GET /api/classes/open` | `class_instances` joined with `courses` & `instructors` | Returns scheduled sections, current enrolled count vs capacity, and student's enrollment status. |

### D. Instructor Portal
| Frontend Function | HTTP Method & Path | PostgreSQL Source | Description |
|---|---|---|---|
| `getInstructorClasses(instructor_id)` | `GET /api/instructors/{id}/classes` | `class_instances` | Returns class sections assigned to the faculty member. |
| `getClassRoster(class_instance_id)` | `GET /api/classes/{id}/roster` | `enrollments` joined with `students` | Returns enrolled students for section (instructors have read-only access to roster). |
| `updateGrade(enrollment_id, grade_letter)` | `PUT /api/enrollments/{id}/grade` | `UPDATE enrollments SET grade_letter=..., grade_points=..., status='completed'` | Updates grade on the 4.0 scale (A+ 4.0 down to F 0.0). Automatically triggers `enrollment_gpa_update` to recalculate student GPA. |

### E. Admin Management (CRUD)
| Frontend Function | HTTP Method & Path | PostgreSQL Table | Description |
|---|---|---|---|
| `adminGetTable(table)` | `GET /api/admin/{table}` | `students`, `instructors`, `admins`, `departments`, `courses`, `semesters`, `class_instances`, `pricing_rules`, `payments` | Returns all records for administrative tables. |
| `adminCreateRecord(table, data)` | `POST /api/admin/{table}` | Target table | Inserts a new record into table. |
| `adminUpdateRecord(table, id, data)` | `PUT /api/admin/{table}/{id}` | Target table | Updates an existing record. |
| `adminDeleteRecord(table, id)` | `DELETE /api/admin/{table}/{id}` | Target table | Deletes a record from table. |
| `adminGetPrerequisites()` | `GET /api/admin/course_prerequisites` | `course_prerequisites` joined with `courses` | Returns course prerequisite relationships. |
| `adminAddPrerequisite(course_id, prereq_id)` | `POST /api/admin/course_prerequisites` | `course_prerequisites` | Adds prerequisite rule; blocks `course_id == prerequisite_course_id`. |
| `adminRemovePrerequisite(course_id, prereq_id)` | `DELETE /api/admin/course_prerequisites` | `course_prerequisites` | Removes prerequisite rule. |

### F. Admin Institutional Reports (Database Views)
| Frontend Function | HTTP Method & Path | PostgreSQL View | Description |
|---|---|---|---|
| `reportStudentTranscript(student_id)` | `GET /api/views/transcript?student_id={id}` | `view_student_transcript` | Full academic history and GPA for any student. |
| `reportDepartmentEnrollmentStats()` | `GET /api/reports/department_enrollment_stats` | `view_department_enrollment_stats` | Active, completed, and total course enrollment numbers by department. |
| `reportInstructorTeachingLoad()` | `GET /api/reports/instructor_teaching_load` | `view_instructor_teaching_load` | Sections taught and total students per instructor per semester. |
| `reportUnpaidTuition()` | `GET /api/reports/unpaid_tuition` | `view_unpaid_tuition` | Students with pending/unpaid tuition balances. |

---

## 5. Security & Session Handling

- **No Passwords Stored in Browser**: LocalStorage only preserves `session_token`, `session_role`, and `session_user_id`. Passwords are submitted solely over POST during authentication.
- **Client Route Guard (`js/guard.js`)**: Evaluates role authorization on page load. Redirects unauthenticated visitors to `login.html` and restricts student, instructor, and admin routes to authorized roles.
- **Database Alignment**: All table names, column names, constraints, and stored procedure behaviors replicate PostgreSQL 17 definitions documented in `osms_project_summary.md`.
