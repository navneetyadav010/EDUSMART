require("dotenv").config();

const http = require("http");
const path = require("path");

const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { Server } = require("socket.io");

const { cleanString, generateId, normalizeIsoDate, slugifyName } = require("./lib/utils");
const { buildDashboardData, buildStudentProfile, getCollegeContext } = require("./college-erp/analytics");
const { scanAndSendAlerts } = require("./college-erp/notifications");
const { createAttendancePdf, createMarksheetPdf } = require("./college-erp/reports");
const { bootstrapDemoCollege, createUniqueCollegeSlug } = require("./college-erp/seed");
const { allowRoles, hashPassword, requireAuth, sanitizeUser, signToken, verifyPassword, verifyToken } = require("./college-erp/security");
const { ensureDb, readDb, writeDb } = require("./college-erp/storage");

const port = Number(process.env.PORT || 4000);
const rootDir = path.resolve(__dirname, "..");
const frontDir = path.join(rootDir, "erp");

ensureDb();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(
  "/erp-api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(
  "/erp-api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false
  })
);

io.use(function authenticateSocket(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token;

  if (!token) {
    next(new Error("Unauthorized"));
    return;
  }

  try {
    socket.data.auth = verifyToken(token);
    next();
  } catch (error) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", function onConnection(socket) {
  const room = getCollegeRoom(socket.data.auth.collegeId);
  socket.join(room);
  socket.emit("erp:ready", { connectedAt: new Date().toISOString() });
});

app.get("/erp-api/health", function health(_req, res) {
  res.json({
    ok: true,
    service: "edusmart",
    timestamp: Date.now()
  });
});

app.post("/erp-api/demo/bootstrap", async function bootstrapDemo(_req, res) {
  const db = readDb();
  const credentials = await bootstrapDemoCollege(db);
  writeDb(db);
  res.status(201).json({
    message: "Demo college is ready.",
    credentials
  });
});

app.post("/erp-api/auth/register-admin", async function registerAdmin(req, res) {
  const collegeName = cleanString(req.body.collegeName);
  const adminName = cleanString(req.body.adminName);
  const email = cleanString(req.body.email).toLowerCase();
  const password = String(req.body.password || "");
  const requestedPlan = cleanString(req.body.plan).toLowerCase() === "pro" ? "pro" : "free";

  if (!collegeName || !adminName || !email || password.length < 8) {
    res.status(400).json({ error: "College name, admin name, email, and an 8 character password are required." });
    return;
  }

  const db = readDb();
  const existingUser = db.users.find(function matchUser(user) {
    return user.email.toLowerCase() === email;
  });

  if (existingUser) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const collegeId = generateId("college");
  const college = {
    id: collegeId,
    name: collegeName,
    slug: createUniqueCollegeSlug(db, collegeName || slugifyName(collegeName)),
    contactEmail: email,
    createdAt: new Date().toISOString()
  };
  const subscription = buildSubscription(collegeId, requestedPlan);
  const user = {
    id: generateId("user"),
    collegeId,
    role: "admin",
    name: adminName,
    email,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString()
  };

  db.colleges.push(college);
  db.subscriptions.push(subscription);
  db.users.push(user);
  writeDb(db);

  res.status(201).json({
    token: signToken(user),
    user: sanitizeUser(user),
    college,
    subscription
  });
});

app.post("/erp-api/auth/login", async function login(req, res) {
  const email = cleanString(req.body.email).toLowerCase();
  const password = String(req.body.password || "");
  const db = readDb();
  const user = db.users.find(function matchUser(entry) {
    return entry.email.toLowerCase() === email;
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const context = getCollegeContext(db, user.collegeId);
  res.json({
    token: signToken(user),
    user: sanitizeUser(user),
    college: context.college,
    subscription: context.subscription
  });
});

app.get("/erp-api/auth/me", requireAuth, function authMe(req, res) {
  const db = readDb();
  const user = db.users.find(function matchUser(entry) {
    return entry.id === req.auth.sub;
  });

  if (!user) {
    res.status(404).json({ error: "User account was not found." });
    return;
  }

  const context = getCollegeContext(db, user.collegeId);
  res.json({
    user: sanitizeUser(user),
    college: context.college,
    subscription: context.subscription
  });
});

app.get("/erp-api/dashboard", requireAuth, async function dashboard(req, res) {
  const db = readDb();
  const dashboardData = await buildDashboardData(db, req.auth.collegeId, req.auth);
  const selectedStudentId =
    req.auth.role === "student"
      ? req.auth.studentId
      : cleanString(req.query.studentId) || (dashboardData.studentSummaries[0] && dashboardData.studentSummaries[0].id);

  const highlightedStudent = selectedStudentId
    ? await buildStudentProfile(db, req.auth.collegeId, selectedStudentId)
    : null;

  res.json({
    viewer: {
      role: req.auth.role,
      studentId: req.auth.studentId || null
    },
    ...dashboardData,
    highlightedStudent
  });
});

app.get("/erp-api/students", requireAuth, async function listStudents(req, res) {
  const dashboardData = await buildDashboardData(readDb(), req.auth.collegeId, req.auth);
  const search = cleanString(req.query.search).toLowerCase();
  const risk = cleanString(req.query.risk);
  const department = cleanString(req.query.department);
  const semester = Number(req.query.semester || 0);

  const students = dashboardData.studentSummaries.filter(function applyFilters(student) {
    const matchesSearch =
      !search ||
      student.name.toLowerCase().includes(search) ||
      String(student.rollNumber).toLowerCase().includes(search) ||
      String(student.email || "").toLowerCase().includes(search);
    const matchesRisk = !risk || student.riskLevel === risk;
    const matchesDepartment = !department || student.department === department;
    const matchesSemester = !semester || Number(student.semester) === semester;
    return matchesSearch && matchesRisk && matchesDepartment && matchesSemester;
  });

  res.json({ students });
});

app.post("/erp-api/students", requireAuth, allowRoles("admin"), async function createStudent(req, res) {
  const name = cleanString(req.body.name);
  const email = cleanString(req.body.email).toLowerCase();
  const department = cleanString(req.body.department);
  const program = cleanString(req.body.program);
  const semester = Number(req.body.semester || 0);
  const year = Number(req.body.year || 0);
  const portalEmail = cleanString(req.body.portalEmail).toLowerCase();
  const portalPassword = String(req.body.portalPassword || "");

  if (!name || !department || !program || !semester || !year) {
    res.status(400).json({ error: "Name, department, program, semester, and year are required." });
    return;
  }

  if ((portalEmail && !portalPassword) || (!portalEmail && portalPassword)) {
    res.status(400).json({ error: "Student portal email and password must be provided together." });
    return;
  }

  const db = readDb();
  const context = getCollegeContext(db, req.auth.collegeId);
  const limit = context.subscription && context.subscription.plan === "free" ? Number(context.subscription.studentLimit || 60) : Infinity;

  if (context.students.length >= limit) {
    res.status(403).json({ error: "The free plan student limit has been reached. Upgrade to Pro for unlimited students." });
    return;
  }

  if (
    portalEmail &&
    db.users.some(function duplicatePortal(entry) {
      return entry.email.toLowerCase() === portalEmail;
    })
  ) {
    res.status(409).json({ error: "That student portal email is already in use." });
    return;
  }

  const studentId = generateId("student");
  const student = {
    id: studentId,
    collegeId: req.auth.collegeId,
    name,
    email,
    department,
    program,
    semester,
    year,
    rollNumber: `COL${String(context.students.length + 1).padStart(3, "0")}`,
    createdAt: new Date().toISOString()
  };

  db.students.push(student);

  if (portalEmail) {
    db.users.push({
      id: generateId("user"),
      collegeId: req.auth.collegeId,
      role: "student",
      name,
      email: portalEmail,
      passwordHash: await hashPassword(portalPassword),
      studentId,
      createdAt: new Date().toISOString()
    });
  }

  writeDb(db);
  const profile = await buildStudentProfile(db, req.auth.collegeId, studentId);
  emitCollegeEvent(req.auth.collegeId, "student.created", { studentId });
  res.status(201).json({ student: profile });
});

app.get("/erp-api/students/:studentId", requireAuth, async function getStudent(req, res) {
  if (!canAccessStudent(req, req.params.studentId)) {
    res.status(403).json({ error: "You cannot view another student's profile." });
    return;
  }

  const profile = await buildStudentProfile(readDb(), req.auth.collegeId, req.params.studentId);

  if (!profile) {
    res.status(404).json({ error: "Student not found." });
    return;
  }

  res.json({ student: profile });
});

app.delete("/erp-api/students/:studentId", requireAuth, allowRoles("admin"), function deleteStudent(req, res) {
  const db = readDb();
  const index = db.students.findIndex(function matchStudent(student) {
    return student.id === req.params.studentId && student.collegeId === req.auth.collegeId;
  });

  if (index === -1) {
    res.status(404).json({ error: "Student not found." });
    return;
  }

  db.students.splice(index, 1);
  db.attendance = db.attendance.filter(function keepAttendance(entry) {
    return entry.studentId !== req.params.studentId;
  });
  db.marks = db.marks.filter(function keepMarks(entry) {
    return entry.studentId !== req.params.studentId;
  });
  db.notifications = db.notifications.filter(function keepNotifications(entry) {
    return entry.studentId !== req.params.studentId;
  });
  db.users = db.users.filter(function keepUsers(entry) {
    return entry.studentId !== req.params.studentId;
  });
  writeDb(db);
  emitCollegeEvent(req.auth.collegeId, "student.deleted", { studentId: req.params.studentId });
  res.json({ ok: true });
});

app.post("/erp-api/students/:studentId/attendance", requireAuth, allowRoles("admin"), async function recordAttendance(req, res) {
  const status = cleanString(req.body.status);
  const date = normalizeIsoDate(req.body.date || new Date().toISOString());

  if (!["Present", "Absent"].includes(status) || !date) {
    res.status(400).json({ error: "Attendance requires a valid date and status of Present or Absent." });
    return;
  }

  const db = readDb();
  const student = getStudentRecord(db, req.auth.collegeId, req.params.studentId);

  if (!student) {
    res.status(404).json({ error: "Student not found." });
    return;
  }

  const existing = db.attendance.find(function matchEntry(entry) {
    return entry.collegeId === req.auth.collegeId && entry.studentId === student.id && entry.date === date;
  });

  if (existing) {
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
  } else {
    db.attendance.push({
      id: generateId("attn"),
      collegeId: req.auth.collegeId,
      studentId: student.id,
      date,
      status,
      updatedAt: new Date().toISOString()
    });
  }

  await refreshAlertsForStudents(db, req.auth.collegeId, [student.id]);
  writeDb(db);

  const profile = await buildStudentProfile(db, req.auth.collegeId, student.id);
  emitCollegeEvent(req.auth.collegeId, "attendance.updated", { studentId: student.id, date, status });
  res.status(201).json({ student: profile });
});

app.post("/erp-api/students/:studentId/marks", requireAuth, allowRoles("admin"), async function recordMarks(req, res) {
  const subject = cleanString(req.body.subject);
  const assessment = cleanString(req.body.assessment);
  const score = Number(req.body.score);
  const maxScore = Number(req.body.maxScore || 100);
  const recordedAt = normalizeIsoDate(req.body.recordedAt || new Date().toISOString());

  if (!subject || !assessment || !recordedAt || !Number.isFinite(score) || !Number.isFinite(maxScore) || score < 0 || score > maxScore) {
    res.status(400).json({ error: "Marks require a subject, assessment, valid date, and score within the max score." });
    return;
  }

  const db = readDb();
  const student = getStudentRecord(db, req.auth.collegeId, req.params.studentId);

  if (!student) {
    res.status(404).json({ error: "Student not found." });
    return;
  }

  db.marks.push({
    id: generateId("mark"),
    collegeId: req.auth.collegeId,
    studentId: student.id,
    subject,
    assessment,
    score,
    maxScore,
    recordedAt
  });

  await refreshAlertsForStudents(db, req.auth.collegeId, [student.id]);
  writeDb(db);

  const profile = await buildStudentProfile(db, req.auth.collegeId, student.id);
  emitCollegeEvent(req.auth.collegeId, "marks.updated", { studentId: student.id, subject, assessment });
  res.status(201).json({ student: profile });
});

app.get("/erp-api/notifications", requireAuth, function listNotifications(req, res) {
  const context = getCollegeContext(readDb(), req.auth.collegeId);
  const notifications =
    req.auth.role === "student"
      ? context.notifications.filter(function ownNotifications(entry) {
          return entry.studentId === req.auth.studentId;
        })
      : context.notifications;

  res.json({ notifications: notifications.slice(0, 20) });
});

app.post("/erp-api/notifications/scan", requireAuth, allowRoles("admin"), async function scanNotifications(req, res) {
  const db = readDb();
  const context = getCollegeContext(db, req.auth.collegeId);
  const studentProfiles = await Promise.all(
    context.students.map(function buildProfile(student) {
      return buildStudentProfile(db, req.auth.collegeId, student.id);
    })
  );

  const created = await scanAndSendAlerts({
    db,
    college: context.college,
    admins: context.users.filter(function onlyAdmins(user) {
      return user.role === "admin";
    }),
    studentProfiles: studentProfiles.filter(Boolean)
  });

  writeDb(db);
  emitCollegeEvent(req.auth.collegeId, "notifications.scanned", { created: created.length });
  res.json({ created });
});

app.patch("/erp-api/subscription", requireAuth, allowRoles("admin"), function updateSubscription(req, res) {
  const plan = cleanString(req.body.plan).toLowerCase() === "pro" ? "pro" : "free";
  const db = readDb();
  let subscription = db.subscriptions.find(function matchSubscription(record) {
    return record.collegeId === req.auth.collegeId;
  });

  if (!subscription) {
    subscription = buildSubscription(req.auth.collegeId, plan);
    db.subscriptions.push(subscription);
  } else {
    const updated = buildSubscription(req.auth.collegeId, plan);
    subscription.plan = updated.plan;
    subscription.status = updated.status;
    subscription.studentLimit = updated.studentLimit;
    subscription.updatedAt = new Date().toISOString();
  }

  writeDb(db);
  emitCollegeEvent(req.auth.collegeId, "subscription.updated", { plan: subscription.plan });
  res.json({ subscription });
});

app.get("/erp-api/reports/students/:studentId/marksheet", requireAuth, async function marksheetReport(req, res) {
  if (!canAccessStudent(req, req.params.studentId)) {
    res.status(403).json({ error: "You cannot access this report." });
    return;
  }

  const db = readDb();
  const context = getCollegeContext(db, req.auth.collegeId);
  const profile = await buildStudentProfile(db, req.auth.collegeId, req.params.studentId);

  if (!profile) {
    res.status(404).json({ error: "Student not found." });
    return;
  }

  const pdf = await createMarksheetPdf(context.college, profile);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${slugifyName(profile.name)}-marksheet.pdf"`);
  res.send(pdf);
});

app.get("/erp-api/reports/students/:studentId/attendance", requireAuth, async function attendanceReport(req, res) {
  if (!canAccessStudent(req, req.params.studentId)) {
    res.status(403).json({ error: "You cannot access this report." });
    return;
  }

  const db = readDb();
  const context = getCollegeContext(db, req.auth.collegeId);
  const profile = await buildStudentProfile(db, req.auth.collegeId, req.params.studentId);

  if (!profile) {
    res.status(404).json({ error: "Student not found." });
    return;
  }

  const pdf = await createAttendancePdf(context.college, profile);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${slugifyName(profile.name)}-attendance.pdf"`);
  res.send(pdf);
});

app.use(express.static(frontDir));

app.use(function serveFrontend(req, res, next) {
  if (req.path.startsWith("/erp-api") || req.path.startsWith("/socket.io")) {
    next();
    return;
  }

  res.sendFile(path.join(frontDir, "index.html"));
});

server.listen(port, function onListen() {
  console.log(`EDUSMART is running at http://localhost:${port}`);
});

function buildSubscription(collegeId, plan) {
  return {
    id: generateId("sub"),
    collegeId,
    plan,
    status: "active",
    studentLimit: plan === "free" ? 60 : null,
    createdAt: new Date().toISOString()
  };
}

function getCollegeRoom(collegeId) {
  return `college:${collegeId}`;
}

function emitCollegeEvent(collegeId, type, payload) {
  io.to(getCollegeRoom(collegeId)).emit("erp:event", {
    type,
    payload,
    createdAt: new Date().toISOString()
  });
}

function getStudentRecord(db, collegeId, studentId) {
  return db.students.find(function matchStudent(student) {
    return student.id === studentId && student.collegeId === collegeId;
  });
}

function canAccessStudent(req, studentId) {
  return req.auth.role === "admin" || req.auth.studentId === studentId;
}

async function refreshAlertsForStudents(db, collegeId, studentIds) {
  const context = getCollegeContext(db, collegeId);
  const studentProfiles = await Promise.all(
    studentIds.map(function buildProfile(studentId) {
      return buildStudentProfile(db, collegeId, studentId);
    })
  );

  return scanAndSendAlerts({
    db,
    college: context.college,
    admins: context.users.filter(function onlyAdmins(user) {
      return user.role === "admin";
    }),
    studentProfiles: studentProfiles.filter(Boolean)
  });
}
