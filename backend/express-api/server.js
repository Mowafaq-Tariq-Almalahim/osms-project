const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
app.use(require("cors")({ origin: "http://127.0.0.1:5500" }));
app.use(express.json());
const { Pool } = require("pg");
const pool = new Pool();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/db-health", async (req, res) => {
  try {
    const result = await pool.query("SELECT current_database() AS database");
    res.json({ status: "ok", database: result.rows[0].database });
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    res.status(500).json({ status: "error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, username, password } = req.body ?? {};
  const loginEmail = email ?? username;

  if (
    typeof loginEmail !== "string" ||
    !loginEmail.trim() ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({ message: "Enter a valid email and password." });
  }

    try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, 'student' AS role
       FROM public.students WHERE email = $1
       UNION ALL
       SELECT id, name, email, password_hash, 'admin' AS role
       FROM public.admins WHERE email = $1
       UNION ALL
       SELECT id, name, email, password_hash, 'instructor' AS role
       FROM public.instructors WHERE email = $1`,
      [loginEmail.trim()]
    );
    const [account] = rows;

    if (
      rows.length !== 1 ||
      !(await bcrypt.compare(password, account.password_hash))
    ) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { sub: String(account.id), role: account.role },
      process.env.OSMS_JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    return res.json({
      token,
      role: account.role,
      userId: account.id,
      name: account.name,
      email: account.email,
      username: account.email,
    });
  } catch (error) {
    console.error("Login failed:", error.message);
    return res.status(500).json({ message: "Login failed." });
  }
});

app.get("/api/students/me", async (req, res) => {
  const authorization = req.get("Authorization") || "";
  const match = /^Bearer (\S+)$/i.exec(authorization);
  if (!match) {
    return res.status(401).json({ message: "Please sign in." });
  }

  let account;
  try {
    account = jwt.verify(match[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  if (account.role !== "student" || !/^[1-9]\d*$/.test(account.sub)) {
    return res.status(403).json({ message: "Student access required." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT s.name, s.email, s.overall_gpa,
              ARRAY(
                SELECT DISTINCT c.name
                FROM public.enrollments AS e
                JOIN public.class_instances AS ci ON ci.id = e.class_instance_id
                JOIN public.courses AS c ON c.id = ci.course_id
                WHERE e.student_id = s.id
                ORDER BY c.name
              ) AS courses
       FROM public.students AS s
       WHERE s.id = $1`,
      [account.sub]
    );

    const student = rows[0];
    if (!student) {
      return res.status(404).json({ message: "Student account not found." });
    }

    return res.json({
      fullName: student.name,
      username: student.email,
      role: "Student",
      gpa: student.overall_gpa,
      courses: student.courses,
    });
  } catch (error) {
    console.error("Student dashboard failed:", error.message);
    return res.status(500).json({ message: "Failed to load student information." });
  }
});

app.get("/api/students/:studentId/dashboard", async (req, res) => {
  const bearer = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  let account;
  try {
    account = jwt.verify(bearer?.[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  if (account.role !== "student" || account.sub !== req.params.studentId) {
    return res.status(403).json({ message: "Student access required." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.email, s.status,
              d.name AS "departmentName", s.overall_gpa AS "overallGpa",
              COALESCE(SUM(c.credit_hours) FILTER (
                WHERE e.status = 'completed' AND e.grade_letter <> 'F'
              ), 0)::int AS "completedHours",
              COALESCE(json_agg(json_build_object(
                'courseCode', c.code,
                'courseName', c.name,
                'creditHours', c.credit_hours,
                'instructor', i.name,
                'semester', sem.name
              ) ORDER BY c.code) FILTER (
                WHERE e.status = 'enrolled' AND ci.semester_id = $2
              ), '[]'::json) AS "activeEnrollments"
       FROM public.students s
       JOIN public.departments d ON d.id = s.major_department_id
       LEFT JOIN public.enrollments e ON e.student_id = s.id
       LEFT JOIN public.class_instances ci ON ci.id = e.class_instance_id
       LEFT JOIN public.courses c ON c.id = ci.course_id
       LEFT JOIN public.instructors i ON i.id = ci.instructor_id
       LEFT JOIN public.semesters sem ON sem.id = ci.semester_id
       WHERE s.id = $1
       GROUP BY s.id, d.name`,
      [account.sub, 2]
    );

    const student = rows[0];
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    const gpa = student.overallGpa === null ? null : Number(student.overallGpa);
    const bands = [
      [3.5, "Excellent", "success"],
      [3.0, "Very Good", "success"],
      [2.5, "Good", "info"],
      [2.0, "Accepted", "warning"],
      [0, "Weak", "error"],
    ];
    const [, performanceBand, performanceClass] =
      bands.find(([minimum]) => gpa !== null && gpa >= minimum) ??
      [null, "N/A", "neutral"];

    return res.json({
      ...student,
      status: student.status?.toLowerCase() === "active" ? "Active" : student.status,
      overallGpa: gpa === null ? "—" : gpa.toFixed(2),
      performanceBand,
      performanceClass,
      isProbation: student.status?.toLowerCase() === "probation" ||
        (gpa !== null && gpa < 2),
    });
  } catch (error) {
    console.error("Student dashboard failed:", error.message);
    return res.status(500).json({ message: "Failed to load student profile." });
  }
});
app.get("/api/classes/open", async (req, res) => {
  const bearer = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  let account;
  try {
    account = jwt.verify(bearer?.[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  const { student_id, semester_id } = req.query;
  if (account.role !== "student" || account.sub !== student_id) {
    return res.status(403).json({ message: "Student access required." });
  }

  const semesterId = Number(semester_id);
  if (
    typeof semester_id !== "string" ||
    !/^[1-9]\d*$/.test(semester_id) ||
    semesterId > 2147483647
  ) {
    return res.status(400).json({ message: "Invalid semester ID." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ci.id AS "classInstanceId",
              c.code AS "courseCode",
              c.name AS "courseName",
              c.credit_hours AS "creditHours",
              COALESCE(c.min_credit_hours_required, 0) AS "minCreditHoursRequired",
              i.name AS "instructorName",
              ci.capacity,
              ci.current_enrolled_count AS "currentEnrolledCount",
              ci.current_enrolled_count >= ci.capacity AS "isFull",
              e.status AS "enrollmentStatus",
              COALESCE(e.status = 'enrolled', false) AS "canDrop"
       FROM public.class_instances AS ci
       JOIN public.courses AS c ON c.id = ci.course_id
       JOIN public.instructors AS i ON i.id = ci.instructor_id
       LEFT JOIN public.enrollments AS e
         ON e.class_instance_id = ci.id AND e.student_id = $1
       WHERE ci.semester_id = $2
       ORDER BY c.code, ci.id`,
      [account.sub, semesterId]
    );

    return res.json(rows);
  } catch (error) {
    console.error("Class list failed:", error.message);
    return res.status(500).json({ message: "Failed to load classes." });
  }
});

function requireOwnStudent(req, res, next) {
  const bearer = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  let account;
  try {
    account = jwt.verify(bearer?.[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  if (
    account.role !== "student" ||
    typeof account.sub !== "string" ||
    !/^[1-9]\d*$/.test(account.sub) ||
    account.sub !== String(req.body?.student_id ?? req.query.student_id ?? "")
  ) {
    return res.status(403).json({ message: "Student access required." });
  }

  req.studentId = account.sub;
  next();
}

function requireTranscriptAccess(req, res, next) {
  const bearer = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  let account;
  try {
    account = jwt.verify(bearer?.[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  if (!["admin", "student"].includes(account?.role)) {
    return res.status(403).json({ message: "Transcript access denied." });
  }

  const studentId = req.query.student_id;
  if (
    typeof studentId !== "string" ||
    !/^[1-9]\d*$/.test(studentId) ||
    Number(studentId) > 2147483647
  ) {
    return res.status(400).json({ message: "Select a valid student." });
  }

  if (account.role === "student" && account.sub !== studentId) {
    return res.status(403).json({ message: "You can only view your own transcript." });
  }

  req.studentId = studentId;
  next();
}

app.get("/api/views/transcript", requireTranscriptAccess, async (req, res) => {
  try {
    const profile = await pool.query(
      "SELECT name, overall_gpa FROM public.students WHERE id = $1",
      [req.studentId]
    );
    const student = profile.rows[0];

    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    const { rows } = await pool.query(
      `SELECT semester, course_code, course_name, credit_hours,
              grade_letter, grade_points, status
       FROM public.view_student_transcript
       WHERE student_id = $1`,
      [req.studentId]
    );

    const semesters = Object.create(null);
    for (const row of rows) {
      (semesters[row.semester] ??= []).push({
        courseCode: row.course_code,
        courseName: row.course_name,
        creditHours: row.credit_hours,
        gradeLetter: row.grade_letter ?? "—",
        gradePoints: row.grade_points ?? "—",
        status: row.status,
      });
    }

    const gpa = student.overall_gpa === null ? null : Number(student.overall_gpa);
    const bands = [
      [3.5, "Excellent"],
      [3.0, "Very Good"],
      [2.5, "Good"],
      [2.0, "Accepted"],
      [0, "Weak"],
    ];

    return res.json({
      studentName: student.name,
      overallGpa: gpa === null ? "—" : gpa.toFixed(2),
      performanceBand:
        bands.find(([minimum]) => gpa !== null && gpa >= minimum)?.[1] ?? "N/A",
      semesters,
    });
  } catch (error) {
    console.error("Transcript failed:", error.message);
    return res.status(500).json({ message: "Failed to load transcript." });
  }
});

app.get("/api/procedures/tuition", requireOwnStudent, async (req, res) => {
  const { semester_id } = req.query;
  if (
    typeof semester_id !== "string" ||
    !/^[1-9]\d*$/.test(semester_id) ||
    Number(semester_id) > 2147483647
  ) {
    return res.status(400).json({ message: "Invalid semester ID." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT public.calculate_tuition($1, sem.id) AS "totalAmount",
              COALESCE(payment.status, 'unpaid') AS "paymentStatus",
              payment.id AS "paymentId",
              payment.paid_at AS "paidAt",
              COALESCE((
                SELECT json_agg(json_build_object(
                  'courseCode', c.code,
                  'courseName', c.name,
                  'creditHours', c.credit_hours,
                  'ratePerHour', pr.price_per_hour,
                  'cost', c.credit_hours * pr.price_per_hour
                ) ORDER BY c.code)
                FROM public.enrollments AS e
                JOIN public.class_instances AS ci ON ci.id = e.class_instance_id
                JOIN public.courses AS c ON c.id = ci.course_id
                JOIN public.pricing_rules AS pr ON pr.credit_hour_weight = c.credit_hours
                WHERE e.student_id = $1 AND ci.semester_id = sem.id
                  AND e.status IN ('enrolled', 'completed')
              ), '[]'::json) AS breakdown
       FROM public.semesters AS sem
       LEFT JOIN LATERAL (
         SELECT p.id, p.status, p.paid_at
         FROM public.payments AS p
         WHERE p.student_id = $1 AND p.semester_id = sem.id
         ORDER BY (p.status = 'paid') DESC NULLS LAST, p.id DESC
         LIMIT 1
       ) AS payment ON true
       WHERE sem.id = $2`,
      [req.studentId, semester_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Semester not found." });
    }

    return res.json({ ...rows[0], totalAmount: Number(rows[0].totalAmount) });
  } catch (error) {
    console.error("Tuition failed:", error.message);
    return res.status(500).json({ message: "Failed to load tuition." });
  }
});

app.get("/api/students/semesters", requireOwnStudent, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name
      FROM public.semesters
      ORDER BY
        CASE
          WHEN CURRENT_DATE BETWEEN start_date AND end_date THEN 0
          WHEN start_date <= CURRENT_DATE THEN 1
          ELSE 2
        END,
        CASE WHEN start_date <= CURRENT_DATE THEN start_date END DESC,
        start_date ASC,
        id DESC
    `);

    return res.json(rows);
  } catch (error) {
    console.error("Semester list failed:", error.message);
    return res.status(500).json({ message: "Failed to load semesters." });
  }
});


app.post("/api/procedures/enroll", requireOwnStudent, async (req, res) => {
  const classId = req.body?.class_instance_id;
  const validId = typeof classId === "number" ||
    (typeof classId === "string" && /^[1-9]\d*$/.test(classId));
  const sectionId = Number(validId ? classId : NaN);

  if (!Number.isInteger(sectionId) || sectionId < 1 || sectionId > 2147483647) {
    return res.status(400).json({ message: "ERROR: Invalid class section." });
  }

  try {
    const { rows } = await pool.query(
      "SELECT public.enroll_student($1::integer, $2::integer) AS message",
      [req.studentId, sectionId]
    );

    const { message } = rows[0];
    return res.status(message.startsWith("SUCCESS:") ? 200 : 409).json({ message });
  } catch (error) {
    console.error("Enrollment failed:", error.message);
    return res.status(500).json({ message: "ERROR: Enrollment failed." });
  }
});

function adminList(sql) {
  return async (req, res) => {
    const bearer = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

    let account;
    try {
      account = jwt.verify(bearer?.[1], process.env.OSMS_JWT_SECRET, {
        algorithms: ["HS256"],
      });
    } catch {
      return res.status(401).json({ message: "Please sign in again." });
    }

    if (account.role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }

    try {
      const { rows } = await pool.query(sql);
      return res.json(rows);
    } catch (error) {
      console.error("Admin list failed:", error.message);
      return res.status(500).json({ message: "Failed to load records." });
    }
  };
}

app.get("/api/admin/departments", adminList(
  "SELECT id, name FROM public.departments ORDER BY name, id"
));

app.get("/api/admin/instructors", adminList(
  "SELECT id, name, email, department_id FROM public.instructors ORDER BY name, id"
));

app.get("/api/admin/admins", adminList(
  "SELECT id, name, email FROM public.admins ORDER BY id"
));

app.get("/api/admin/students", adminList(
  `SELECT id, name, email, major_department_id,
          overall_gpa::double precision AS overall_gpa, status
   FROM public.students ORDER BY id`
));

app.get("/api/admin/courses", adminList(
  `SELECT id, code, name, credit_hours, department_id, min_credit_hours_required
   FROM public.courses ORDER BY id`
));

app.get("/api/admin/semesters", adminList(
  `SELECT id, name, start_date::text AS start_date, end_date::text AS end_date
   FROM public.semesters ORDER BY id`
));

app.get("/api/admin/class_instances", adminList(
  `SELECT id, course_id, instructor_id, semester_id, capacity, current_enrolled_count
   FROM public.class_instances ORDER BY id`
));

app.get("/api/admin/enrollments", adminList(
  `SELECT id, student_id, class_instance_id, grade_letter,
          grade_points::double precision AS grade_points, status
   FROM public.enrollments ORDER BY id`
));

app.get("/api/admin/pricing_rules", adminList(
  `SELECT id, credit_hour_weight, price_per_hour::double precision AS price_per_hour
   FROM public.pricing_rules ORDER BY id`
));

app.get("/api/admin/payments", adminList(
  `SELECT id, student_id, semester_id, amount::double precision AS amount, status, paid_at
   FROM public.payments ORDER BY id`
));



const editableProfiles = new Map([
  ["students", ["name", "email", "major_department_id", "overall_gpa", "status"]],
  ["admins", ["name", "email"]],
  ["instructors", ["name", "email", "department_id"]],
  ["class_instances", ["course_id", "instructor_id", "semester_id", "capacity"]],
]);

app.put("/api/admin/:table/:id", async (req, res, next) => {
  const { table, id: rawId } = req.params;
  const fields = editableProfiles.get(table);
  if (!fields) return next();

  const bearer = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  let account;
  try {
    account = jwt.verify(bearer?.[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  if (account.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  const id = Number(rawId);
  if (!/^[1-9]\d*$/.test(rawId) || id > 2147483647) {
    return res.status(400).json({ message: "Invalid record ID." });
  }

  const body = req.body ?? {};
  const changes = fields.filter(field => Object.hasOwn(body, field));

  if (changes.length === 0) {
    return res.status(400).json({ message: "No editable fields were sent." });
  }

  for (const field of changes) {
    const value = body[field];
    if (field === "overall_gpa" && value === null) continue;

    const textField = ["name", "email", "status"].includes(field);
    if (
      (typeof value !== "string" && (textField || typeof value !== "number")) ||
      String(value).trim() === ""
    ) {
      return res.status(400).json({ message: `Invalid value for ${field}.` });
    }
  }

  const assignments = changes.map((field, index) => `${field} = $${index + 1}`);
  const values = changes.map(field =>
    typeof body[field] === "string" ? body[field].trim() : body[field]
  );
  values.push(id);

  const returning = fields.map(field =>
    field === "overall_gpa" ? "overall_gpa::double precision AS overall_gpa" : field
  );

  try {
    const { rows } = await pool.query(
      `UPDATE public.${table}
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, ${returning.join(", ")}`,
      values
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Record not found." });
    }

    return res.json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "That email is already in use." });
    }
    if (error.code === "23503") {
      return res.status(400).json({ message: "Choose an existing department." });
    }
    if (error.code?.startsWith("22") || ["23502", "23514"].includes(error.code)) {
      return res.status(400).json({ message: "Check the values you entered." });
    }

    console.error("Profile update failed:", error.message);
    return res.status(500).json({ message: "Failed to update the record." });
  }
});

app.post("/api/admin/class_instances", async (req, res) => {
  const bearer = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  let account;
  try {
    account = jwt.verify(bearer?.[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  if (account.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  const { course_id, instructor_id, semester_id, capacity } = req.body ?? {};
  const fields = [course_id, instructor_id, semester_id, capacity];

  const valid = fields.every(value =>
    (typeof value === "number" || typeof value === "string") &&
    /^[1-9]\d*$/.test(String(value).trim()) &&
    Number(value) <= 2147483647
  );

  if (!valid) {
    return res.status(400).json({
      message: "Select a course, instructor, and semester, and enter a capacity.",
    });
  }

  if (Number(capacity) < 3 || Number(capacity) > 5) {
    return res.status(400).json({ message: "Capacity must be between 3 and 5." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.class_instances
         (course_id, instructor_id, semester_id, capacity)
       VALUES ($1, $2, $3, $4)
       RETURNING id, course_id, instructor_id, semester_id,
                 capacity, current_enrolled_count`,
      fields.map(Number)
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({
        message: "The selected course, instructor, or semester does not exist.",
      });
    }

    console.error("Class creation failed:", error.message);
    return res.status(500).json({ message: "Failed to create class section." });
  }
});

app.post("/api/admin/courses", async (req, res) => {
  const bearer = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  let account;
  try {
    account = jwt.verify(bearer?.[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  if (account.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  const {
    code,
    name,
    credit_hours,
    department_id,
    min_credit_hours_required,
  } = req.body ?? {};

  const courseCode = typeof code === "string" ? code.trim() : "";
  const courseName = typeof name === "string" ? name.trim() : "";

  if (!courseCode || courseCode.length > 20 || !courseName || courseName.length > 150) {
    return res.status(400).json({
      message: "Enter a course code up to 20 characters and a name up to 150 characters.",
    });
  }

  const isWholeNumber = (value, minimum) =>
    (typeof value === "number" || typeof value === "string") &&
    /^\d+$/.test(String(value).trim()) &&
    Number(value) >= minimum &&
    Number(value) <= 2147483647;

  const minimumCredits =
    typeof min_credit_hours_required === "string"
      ? min_credit_hours_required.trim()
      : min_credit_hours_required;
  const hasMinimum = minimumCredits != null && minimumCredits !== "";

  if (
    !isWholeNumber(credit_hours, 1) ||
    !isWholeNumber(department_id, 1) ||
    (hasMinimum && !isWholeNumber(minimumCredits, 0))
  ) {
    return res.status(400).json({
      message: "Select a department and enter valid credit hours.",
    });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.courses
         (code, name, credit_hours, department_id, min_credit_hours_required)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, code, name, credit_hours, department_id, min_credit_hours_required`,
      [
        courseCode,
        courseName,
        Number(credit_hours),
        Number(department_id),
        hasMinimum ? Number(minimumCredits) : null,
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "That course code is already in use." });
    }
    if (error.code === "23503") {
      return res.status(400).json({ message: "Choose an existing department." });
    }

    console.error("Course creation failed:", error.message);
    return res.status(500).json({ message: "Failed to create course." });
  }
});

const managedUserTables = new Map([
  ["students", {
    department: "major_department_id",
    returning: "id, name, email, major_department_id, overall_gpa::double precision AS overall_gpa, status",
  }],
  ["instructors", {
    department: "department_id",
    returning: "id, name, email, department_id",
  }],
  ["admins", {
    returning: "id, name, email",
  }],
]);

function requireUserManagementAdmin(req, res, next) {
  const bearer = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  let account;
  try {
    account = jwt.verify(bearer?.[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  if (account?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  req.userManagementAdmin = account;
  next();
}

app.post("/api/admin/:table", requireUserManagementAdmin, async (req, res, next) => {
  const { table } = req.params;
  const config = managedUserTables.get(table);
  if (!config) return next();

  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body.password ?? body.password_hash;

  if (!name || name.length > 100 || email.length > 150 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Enter a valid name and email address." });
  }

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      message: "Enter a password with at least 8 characters and at most 72 bytes.",
    });
  }

  const columns = ["name", "email", "password_hash"];
  const values = [name, email];

  if (config.department) {
    const rawDepartment = body[config.department];
    const departmentId = Number(rawDepartment);

    if (
      !["string", "number"].includes(typeof rawDepartment) ||
      !/^[1-9]\d*$/.test(String(rawDepartment).trim()) ||
      departmentId > 2147483647
    ) {
      return res.status(400).json({ message: "Choose a valid department." });
    }
  }

  let client;
  try {
    values.push(await bcrypt.hash(password, 12));

    if (config.department) {
      columns.push(config.department);
      values.push(Number(body[config.department]));
    }

    if (table === "students") {
      if (body.overall_gpa != null && body.overall_gpa !== "") {
        columns.push("overall_gpa");
        values.push(body.overall_gpa);
      }
      if (typeof body.status === "string" && body.status.trim()) {
        columns.push("status");
        values.push(body.status.trim());
      }
    }

    const placeholders = values.map((_, index) =>
    index === 1 ? "$2::text" : `$${index + 1}`);
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(`
      LOCK TABLE public.admins, public.instructors, public.students
      IN SHARE ROW EXCLUSIVE MODE
    `);

    const { rows } = await client.query(
      `INSERT INTO public.${table} (${columns.join(", ")})
       SELECT ${placeholders.join(", ")}
       WHERE NOT EXISTS (
         SELECT 1 FROM public.admins WHERE lower(email) = $2::text
         UNION ALL
         SELECT 1 FROM public.instructors WHERE lower(email) = $2::text
         UNION ALL
         SELECT 1 FROM public.students WHERE lower(email) = $2::text
       )
       RETURNING ${config.returning}`,
      values
    );
    await client.query("COMMIT");

    if (!rows.length) {
      return res.status(409).json({ message: "That email is already in use." });
    }

    return res.status(201).json(rows[0]);
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        client.release(rollbackError);
        client = undefined;
      }
    }

    if (error.code === "23505") {
      return res.status(409).json({ message: "That email is already in use." });
    }
    if (error.code === "23503") {
      return res.status(400).json({ message: "Choose an existing department." });
    }
    if (error.code?.startsWith("22") || ["23502", "23514"].includes(error.code)) {
      return res.status(400).json({ message: "Check the values you entered." });
    }

    console.error("User creation failed:", error.message);
    return res.status(500).json({ message: "Failed to create the user." });
  } finally {
    client?.release();
  }
});

app.delete("/api/admin/:table/:id", requireUserManagementAdmin, async (req, res, next) => {
  const { table, id } = req.params;
  if (!managedUserTables.has(table)) return next();

  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
    return res.status(400).json({ message: "Invalid user ID." });
  }

  if (table === "admins" && String(req.userManagementAdmin.sub) === id) {
    return res.status(409).json({ message: "You cannot delete the admin account you are signed in with." });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.${table} WHERE id = $1`,
      [id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ message: "User deleted." });
  } catch (error) {
    if (error.code === "23503") {
      const message = table === "students"
        ? "This student has linked enrollments or payments."
        : "This faculty member is assigned to a class section.";

      return res.status(409).json({ message });
    }

    console.error("User deletion failed:", error.message);
    return res.status(500).json({ message: "Failed to delete the user." });
  }
});

app.get("/api/admin/course_prerequisites", adminList(`
  SELECT cp.course_id, cp.prerequisite_course_id,
         c.code AS "courseCode", c.name AS "courseName",
         p.code AS "prereqCode", p.name AS "prereqName"
  FROM public.course_prerequisites AS cp
  JOIN public.courses AS c ON c.id = cp.course_id
  JOIN public.courses AS p ON p.id = cp.prerequisite_course_id
  ORDER BY c.code, p.code
`));

function readCourseInteger(value, minimum = 1) {
  if (
    !["string", "number"].includes(typeof value) ||
    !/^\d+$/.test(String(value).trim())
  ) return null;

  const number = Number(value);
  return number >= minimum && number <= 2147483647 ? number : null;
}

function courseWriteError(res, error, operation) {
  if (error.code === "23505") {
    const message = operation === "add prerequisite"
      ? "This prerequisite already exists."
      : "That course code is already in use.";
    return res.status(409).json({ message });
  }
  if (error.code === "23503") {
    if (operation === "delete course") {
      return res.status(409).json({
        message: "This course is assigned to a class section. Remove or reassign the section first.",
      });
    }
    return res.status(400).json({
      message: operation === "edit course"
        ? "Choose an existing department."
        : "Both courses must exist.",
    });
  }

  console.error(`Could not ${operation}:`, error.message);
  return res.status(500).json({ message: `Could not ${operation}.` });
}

app.put("/api/admin/courses/:id", requireUserManagementAdmin, async (req, res) => {
  const id = readCourseInteger(req.params.id);
  if (id === null) return res.status(400).json({ message: "Invalid course ID." });

  const body = req.body ?? {};
  const fields = ["code", "name", "credit_hours", "department_id", "min_credit_hours_required"];
  const changes = [];

  for (const field of fields) {
    if (!Object.hasOwn(body, field)) continue;
    const raw = typeof body[field] === "string" ? body[field].trim() : body[field];

    if (field === "code" || field === "name") {
      const limit = field === "code" ? 20 : 150;
      if (typeof raw !== "string" || !raw || raw.length > limit) {
        return res.status(400).json({ message: `Enter a valid course ${field}.` });
      }
      changes.push([field, raw]);
      continue;
    }

    const optional = field === "min_credit_hours_required";
    if (optional && (raw === "" || raw === null)) {
      changes.push([field, null]);
      continue;
    }

    const value = readCourseInteger(raw, optional ? 0 : 1);
    if (value === null) {
      return res.status(400).json({ message: `Invalid value for ${field}.` });
    }
    changes.push([field, value]);
  }

  if (!changes.length) {
    return res.status(400).json({ message: "No editable course fields were sent." });
  }

  const assignments = changes.map(([field], index) => `${field} = $${index + 1}`);
  const values = changes.map(([, value]) => value);
  values.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE public.courses
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, code, name, credit_hours, department_id, min_credit_hours_required`,
      values
    );
    if (!rows.length) return res.status(404).json({ message: "Course not found." });
    return res.json(rows[0]);
  } catch (error) {
    return courseWriteError(res, error, "edit course");
  }
});

app.delete("/api/admin/courses/:id", requireUserManagementAdmin, async (req, res) => {
  const id = readCourseInteger(req.params.id);
  if (id === null) return res.status(400).json({ message: "Invalid course ID." });

  try {
    const result = await pool.query("DELETE FROM public.courses WHERE id = $1", [id]);
    if (!result.rowCount) return res.status(404).json({ message: "Course not found." });
    return res.json({ message: "Course deleted." });
  } catch (error) {
    return courseWriteError(res, error, "delete course");
  }
});

function readPrerequisitePair(req, res, next) {
  const courseId = readCourseInteger(req.body?.course_id);
  const prerequisiteId = readCourseInteger(req.body?.prerequisite_course_id);

  if (courseId === null || prerequisiteId === null) {
    return res.status(400).json({ message: "Select both courses." });
  }
  if (courseId === prerequisiteId) {
    return res.status(400).json({ message: "A course cannot be its own prerequisite." });
  }

  req.prerequisitePair = [courseId, prerequisiteId];
  next();
}

app.post("/api/admin/course_prerequisites",
  requireUserManagementAdmin, readPrerequisitePair, async (req, res) => {
    try {
      await pool.query(
        `INSERT INTO public.course_prerequisites (course_id, prerequisite_course_id)
         VALUES ($1, $2)`,
        req.prerequisitePair
      );
      return res.status(201).json({ message: "Prerequisite added." });
    } catch (error) {
      return courseWriteError(res, error, "add prerequisite");
    }
  }
);

app.delete("/api/admin/course_prerequisites",
  requireUserManagementAdmin, readPrerequisitePair, async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM public.course_prerequisites
         WHERE course_id = $1 AND prerequisite_course_id = $2`,
        req.prerequisitePair
      );
      if (!result.rowCount) {
        return res.status(404).json({ message: "Prerequisite not found." });
      }
      return res.json({ message: "Prerequisite removed." });
    } catch (error) {
      return courseWriteError(res, error, "remove prerequisite");
    }
  }
);

app.delete("/api/admin/class_instances/:id", requireUserManagementAdmin, async (req, res) => {
  const rawId = req.params.id;
  const id = Number(rawId);

  if (!/^[1-9]\d*$/.test(rawId) || id > 2147483647) {
    return res.status(400).json({ message: "Invalid class section ID." });
  }

  try {
    const { rowCount } = await pool.query(
      "DELETE FROM public.class_instances WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Class section not found." });
    }

    return res.json({ message: "Class section deleted." });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        message: "This class section has linked enrollment records.",
      });
    }

    console.error("Class section deletion failed:", error.message);
    return res.status(500).json({ message: "Failed to delete class section." });
  }
});

const academicAdminTables = [
  {
    table: "departments",
    label: "Department",
    nameLimit: 100,
    fields: ["name"],
    returning: "id, name",
    linkedRecords: "students, instructors, or courses",
  },
  {
    table: "semesters",
    label: "Semester",
    nameLimit: 50,
    fields: ["name", "start_date", "end_date"],
    returning: "id, name, start_date::text AS start_date, end_date::text AS end_date",
    linkedRecords: "class sections or payments",
  },
];

function academicAdminId(rawId) {
  return /^[1-9]\d*$/.test(rawId) && Number(rawId) <= 2147483647
    ? Number(rawId)
    : null;
}

function academicAdminError(res, error, config) {
  if (error.code === "23503") {
    return res.status(409).json({
      message: `This ${config.label.toLowerCase()} has linked ${config.linkedRecords}.`,
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({ message: "That name is already in use." });
  }

  if (error.constraint === "semesters_check") {
    return res.status(400).json({
      message: "The semester end date must be after the start date.",
    });
  }

  if (error.code?.startsWith("22") || error.code === "23502") {
    return res.status(400).json({ message: "Check the name and any dates you entered." });
  }

  console.error(`${config.label} request failed:`, error.message);
  return res.status(500).json({ message: `${config.label} request failed.` });
}

for (const config of academicAdminTables) {
  const { table, label, nameLimit, fields, returning } = config;
  const path = `/api/admin/${table}`;

  async function saveRecord(req, res) {
    const creating = req.method === "POST";
    const id = creating ? null : academicAdminId(req.params.id);

    if (!creating && id === null) {
      return res.status(400).json({ message: `Invalid ${label.toLowerCase()} ID.` });
    }

    const body = req.body ?? {};
    const changes = creating ? fields : fields.filter(field => Object.hasOwn(body, field));

    if (!changes.length) {
      return res.status(400).json({ message: "No editable fields were sent." });
    }

    const values = [];
    for (const field of changes) {
      const value = typeof body[field] === "string" ? body[field].trim() : "";
      const valid = field === "name"
        ? value.length > 0 && value.length <= nameLimit
        : /^\d{4}-\d{2}-\d{2}$/.test(value);

      if (!valid) {
        return res.status(400).json({
          message: field === "name"
            ? `Enter a name up to ${nameLimit} characters.`
            : `Enter a valid ${field.replace("_", " ")} in YYYY-MM-DD format.`,
        });
      }

      values.push(value);
    }

    const parameters = changes.map((_, index) => `$${index + 1}`);
    const assignments = changes.map((field, index) => `${field} = ${parameters[index]}`);
    const sql = creating
      ? `INSERT INTO public.${table} (${changes.join(", ")})
         VALUES (${parameters.join(", ")}) RETURNING ${returning}`
      : `UPDATE public.${table} SET ${assignments.join(", ")}
         WHERE id = $${values.length + 1} RETURNING ${returning}`;

    try {
      const { rows } = await pool.query(sql, creating ? values : [...values, id]);
      if (!rows.length) {
        return res.status(404).json({ message: `${label} not found.` });
      }
      return res.status(creating ? 201 : 200).json(rows[0]);
    } catch (error) {
      return academicAdminError(res, error, config);
    }
  }

  app.post(path, requireUserManagementAdmin, saveRecord);
  app.put(`${path}/:id`, requireUserManagementAdmin, saveRecord);

  app.delete(`${path}/:id`, requireUserManagementAdmin, async (req, res) => {
    const id = academicAdminId(req.params.id);
    if (id === null) {
      return res.status(400).json({ message: `Invalid ${label.toLowerCase()} ID.` });
    }

    try {
      const { rowCount } = await pool.query(
        `DELETE FROM public.${table} WHERE id = $1`,
        [id]
      );
      if (rowCount === 0) {
        return res.status(404).json({ message: `${label} not found.` });
      }
      return res.json({ message: `${label} deleted.` });
    } catch (error) {
      return academicAdminError(res, error, config);
    }
  });
}

const adminBillingTables = [
  {
    table: "pricing_rules",
    label: "Pricing rule",
    fields: ["credit_hour_weight", "price_per_hour"],
    moneyField: "price_per_hour",
    returning: "id, credit_hour_weight, price_per_hour::double precision AS price_per_hour",
  },
  {
    table: "payments",
    label: "Payment",
    fields: ["student_id", "semester_id", "amount", "status"],
    moneyField: "amount",
    returning: "id, student_id, semester_id, amount::double precision AS amount, status, paid_at",
  },
];

function adminBillingError(res, error, label) {
  if (error.constraint === "pricing_rules_credit_hour_weight_key") {
    return res.status(409).json({
      message: "A pricing rule already exists for that credit-hour weight.",
    });
  }

  if (error.code === "23503") {
    return res.status(409).json({
      message: "Check that the selected student and semester exist and that the record has no dependencies.",
    });
  }

  if (error.code?.startsWith("22") || ["23502", "23514"].includes(error.code)) {
    return res.status(400).json({ message: "Check the values you entered." });
  }

  console.error(`${label} request failed:`, error.message);
  return res.status(500).json({ message: `${label} request failed.` });
}

for (const { table, label, fields, moneyField, returning } of adminBillingTables) {
  const path = `/api/admin/${table}`;

  async function saveRecord(req, res) {
    const creating = req.method === "POST";
    const id = creating ? null : readCourseInteger(req.params.id);

    if (!creating && id === null) {
      return res.status(400).json({ message: "Invalid record ID." });
    }

    const body = req.body ?? {};
    const changes = creating ? [...fields] : fields.filter(field => Object.hasOwn(body, field));

    if (!changes.length) {
      return res.status(400).json({ message: "No editable fields were sent." });
    }

    const values = [];

    for (const field of changes) {
      const raw = field === "status" && creating ? body.status ?? "pending" : body[field];
      let value;

      if (field === "status") {
        value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
        if (!["pending", "paid"].includes(value)) {
          return res.status(400).json({ message: "Choose Pending or Paid." });
        }
      } else if (field === moneyField) {
        value = ["number", "string"].includes(typeof raw) ? String(raw).trim() : "";
        if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) {
          return res.status(400).json({
            message: "Enter a nonnegative amount with at most two decimal places.",
          });
        }
      } else {
        value = readCourseInteger(raw);
        if (value === null) {
          return res.status(400).json({ message: `Invalid value for ${field}.` });
        }
      }

      values.push(value);
    }

    const columns = [...changes];
    const expressions = values.map((_, index) => `$${index + 1}`);
    const statusIndex = changes.indexOf("status");

    if (statusIndex !== -1) {
      columns.push("paid_at");
      const paidAt = creating
        ? "LOCALTIMESTAMP"
        : "COALESCE(paid_at, LOCALTIMESTAMP)";
      expressions.push(
        `CASE WHEN $${statusIndex + 1}::varchar = 'paid' THEN ${paidAt} ELSE NULL END`
      );
    }

    const assignments = columns.map((column, index) => `${column} = ${expressions[index]}`);
    const sql = creating
      ? `INSERT INTO public.${table} (${columns.join(", ")})
         VALUES (${expressions.join(", ")}) RETURNING ${returning}`
      : `UPDATE public.${table} SET ${assignments.join(", ")}
         WHERE id = $${values.length + 1} RETURNING ${returning}`;

    try {
      const { rows } = await pool.query(sql, creating ? values : [...values, id]);
      if (!rows.length) {
        return res.status(404).json({ message: `${label} not found.` });
      }
      return res.status(creating ? 201 : 200).json(rows[0]);
    } catch (error) {
      return adminBillingError(res, error, label);
    }
  }

  app.post(path, requireUserManagementAdmin, saveRecord);
  app.put(`${path}/:id`, requireUserManagementAdmin, saveRecord);

  app.delete(`${path}/:id`, requireUserManagementAdmin, async (req, res) => {
    const id = readCourseInteger(req.params.id);
    if (id === null) {
      return res.status(400).json({ message: "Invalid record ID." });
    }

    try {
      const { rowCount } = await pool.query(
        `DELETE FROM public.${table} WHERE id = $1`,
        [id]
      );
      if (!rowCount) {
        return res.status(404).json({ message: `${label} not found.` });
      }
      return res.json({ message: `${label} deleted.` });
    } catch (error) {
      return adminBillingError(res, error, label);
    }
  });
}

app.get("/api/reports/department_enrollment_stats", adminList(`
  SELECT v.department_name AS "departmentName",
         v.course_code AS "courseCode",
         v.course_name AS "courseName",
         c.credit_hours AS "creditHours",
         v.currently_enrolled_count::double precision AS "activeEnrolled",
         v.completed_count::double precision AS "completedCount",
         v.total_enrollments::double precision AS "totalEnrolled"
  FROM public.view_department_enrollment_stats AS v
  JOIN public.courses AS c ON c.code = v.course_code
  ORDER BY v.department_name, v.course_code
`));

app.get("/api/reports/instructor_teaching_load", adminList(`
  SELECT v.instructor_name AS "instructorName",
         i.email AS "instructorEmail",
         d.name AS "departmentName",
         v.semester AS "semesterName",
         v.sections_taught::double precision AS "sectionsCount",
         v.total_students::double precision AS "totalStudentsTaught"
  FROM public.view_instructor_teaching_load AS v
  JOIN public.instructors AS i ON i.id = v.instructor_id
  JOIN public.departments AS d ON d.id = i.department_id
  WHERE v.sections_taught > 0
  ORDER BY v.instructor_name, v.semester
`));

app.get("/api/reports/unpaid_tuition", adminList(`
  SELECT p.id AS "paymentId",
         s.name AS "studentName",
         s.email AS "studentEmail",
         d.name AS "departmentName",
         sem.name AS "semesterName",
         p.amount::text AS amount,
         p.status
  FROM public.payments AS p
  JOIN public.students AS s ON s.id = p.student_id
  JOIN public.departments AS d ON d.id = s.major_department_id
  JOIN public.semesters AS sem ON sem.id = p.semester_id
  WHERE p.status <> 'paid'
  ORDER BY sem.name, s.name, p.id
`));

app.get("/api/departments", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name FROM public.departments ORDER BY name, id"
    );
    return res.json(rows);
  } catch (error) {
    console.error("Department lookup failed:", error.message);
    return res.status(500).json({ message: "Failed to load departments." });
  }
});

function requireInstructor(req, res, next) {
  const match = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  let account;
  try {
    account = jwt.verify(match?.[1], process.env.OSMS_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

  if (
    account?.role !== "instructor" ||
    typeof account.sub !== "string" ||
    !/^[1-9]\d*$/.test(account.sub) ||
    Number(account.sub) > 2147483647
  ) {
    return res.status(403).json({ message: "Instructor access required." });
  }

  req.instructorId = Number(account.sub);
  next();
}

function readInstructorRouteId(value) {
  return /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647
    ? Number(value)
    : null;
}

app.get("/api/instructors/:id/classes", requireInstructor, async (req, res) => {
  if (readInstructorRouteId(req.params.id) !== req.instructorId) {
    return res.status(403).json({ message: "You can only view your own classes." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ci.id, c.code AS "courseCode", c.name AS "courseName",
              c.credit_hours AS "creditHours", sem.name AS "semesterName",
              ci.semester_id AS "semesterId", ci.capacity,
              ci.current_enrolled_count AS "currentEnrolledCount"
       FROM public.class_instances AS ci
       JOIN public.courses AS c ON c.id = ci.course_id
       JOIN public.semesters AS sem ON sem.id = ci.semester_id
       WHERE ci.instructor_id = $1
       ORDER BY sem.start_date DESC, c.code, ci.id`,
      [req.instructorId]
    );
    return res.json(rows);
  } catch (error) {
    console.error("Instructor classes failed:", error.message);
    return res.status(500).json({ message: "Failed to load classes." });
  }
});

app.get("/api/classes/:id/roster", requireInstructor, async (req, res) => {
  const id = readInstructorRouteId(req.params.id);
  if (id === null) return res.status(400).json({ message: "Invalid class ID." });

  try {
    const { rows } = await pool.query(
      `SELECT ci.id AS "classInstanceId", c.code AS "courseCode",
              c.name AS "courseName", sem.name AS "semesterName",
              COALESCE(
                json_agg(json_build_object(
                  'enrollmentId', e.id,
                  'studentId', s.id,
                  'studentName', s.name,
                  'studentEmail', s.email,
                  'departmentName', d.name,
                  'gradeLetter', e.grade_letter,
                  'gradePoints', e.grade_points,
                  'status', e.status
                ) ORDER BY s.name, e.id) FILTER (WHERE e.id IS NOT NULL),
                '[]'::json
              ) AS students
       FROM public.class_instances AS ci
       JOIN public.courses AS c ON c.id = ci.course_id
       JOIN public.semesters AS sem ON sem.id = ci.semester_id
       LEFT JOIN public.enrollments AS e ON e.class_instance_id = ci.id
       LEFT JOIN public.students AS s ON s.id = e.student_id
       LEFT JOIN public.departments AS d ON d.id = s.major_department_id
       WHERE ci.id = $1 AND ci.instructor_id = $2
       GROUP BY ci.id, c.code, c.name, sem.name`,
      [id, req.instructorId]
    );

    if (!rows.length) return res.status(404).json({ message: "Class section not found." });
    return res.json(rows[0]);
  } catch (error) {
    console.error("Class roster failed:", error.message);
    return res.status(500).json({ message: "Failed to load the roster." });
  }
});

const instructorGradeScale = new Map([
  ["A+", 4.0], ["A", 3.75], ["A-", 3.5],
  ["B+", 3.25], ["B", 3.0], ["B-", 2.75],
  ["C+", 2.5], ["C", 2.25], ["C-", 2.0],
  ["D+", 1.5], ["D", 1.0], ["F", 0.0],
]);

app.put("/api/enrollments/:id/grade", requireInstructor, async (req, res) => {
  const id = readInstructorRouteId(req.params.id);
  const letter = req.body?.grade_letter;

  if (id === null || !instructorGradeScale.has(letter)) {
    return res.status(400).json({ message: "ERROR: Invalid enrollment ID or grade letter." });
  }

  const points = instructorGradeScale.get(letter);

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.enrollments AS e
       SET grade_letter = $1, grade_points = $2, status = 'completed'
       FROM public.class_instances AS ci
       WHERE e.id = $3 AND ci.id = e.class_instance_id AND ci.instructor_id = $4`,
      [letter, points, id, req.instructorId]
    );

    if (!rowCount) {
      return res.status(404).json({ message: "ERROR: Enrollment record not found." });
    }

    return res.json({
      message: `SUCCESS: Grade updated to ${letter} (${points.toFixed(2)} pts).`,
    });
  } catch (error) {
    console.error("Grade update failed:", error.message);
    return res.status(500).json({ message: "ERROR: Failed to update grade." });
  }
});

app.listen(3000, () => {
  console.log("Backend running at http://localhost:3000");
});