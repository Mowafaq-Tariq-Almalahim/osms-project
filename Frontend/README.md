# School Management System — Frontend

A clean, responsive frontend for a school management system with three user roles: **Admin**, **Teacher**, and **Student**. Built with plain HTML, CSS, and vanilla JavaScript — no frameworks or build tools.

## Quick Start

1. Open `Frontend/index.html` (or `login.html`) in any modern browser.
2. The app runs entirely client-side with mock data — no server required.

## Mock Accounts (for testing)

| Username  | Password       | Role    |
|-----------|----------------|---------|
| `admin`   | `admin1234`    | Admin   |
| `teacher` | `teacher1234`  | Teacher |
| `student` | `student1234`  | Student |

You can also register new Student or Teacher accounts via the Sign Up form.

## Folder Structure

```
Frontend/
  index.html              → redirects to login.html
  login.html              → login / register page
  admin.html              → admin dashboard
  teacher.html            → teacher dashboard
  student.html            → student dashboard (read-only)
  css/
    variables.css          → design tokens (colors, spacing, radius)
    base.css               → reset and typography
    components.css         → reusable UI components
    auth.css               → auth page specific styles
  js/
    api.js                 → API calls + mock data layer
    auth.js                → login / register flow
    guard.js               → role-based page protection
    validation.js          → form validation helpers
  assets/                  → images and icons (empty for now)
```

## Connecting to the Backend

When the backend REST API is ready:

1. Open `js/api.js`.
2. Set `API_BASE_URL` to your backend URL (e.g. `http://localhost:3000/api`).
3. Set `USE_MOCK = false`.
4. The fetch calls in `login()`, `register()`, `getStudents()`, `getTeachers()`, and `getOwnInfo()` will hit the real endpoints.

## Design

- **Background:** cream `#F5F0E6`
- **Cards:** white, 16 px rounded corners, soft shadow
- **Primary color:** dark grey `#2F2F2F`
- Responsive down to mobile. Keyboard accessible with visible focus states.
