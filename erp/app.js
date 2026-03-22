(function () {
  "use strict";

  var API_BASE = "/erp-api";
  var SESSION_KEY = "college-erp-session";
  var root = document.getElementById("app");

  var state = {
    token: "",
    user: null,
    college: null,
    subscription: null,
    dashboard: null,
    selectedStudent: null,
    selectedStudentId: "",
    authMode: "login",
    busy: false,
    liveStatus: "offline",
    demoCredentials: null,
    filters: {
      search: "",
      risk: "",
      department: "",
      semester: ""
    },
    toasts: []
  };

  var charts = {
    attendance: null,
    marks: null
  };

  var socket = null;
  var liveRefreshTimer = null;

  init();

  function init() {
    var session = readSession();

    if (session && session.token) {
      state.token = session.token;
      state.user = session.user || null;
      state.college = session.college || null;
      state.subscription = session.subscription || null;
      state.busy = true;
      render();
      hydrateSession();
      return;
    }

    render();
  }

  async function hydrateSession() {
    try {
      var authData = await api("/auth/me");
      state.user = authData.user;
      state.college = authData.college;
      state.subscription = authData.subscription;
      persistSession();
      await refreshDashboard(false);
      connectSocket();
    } catch (error) {
      clearSession();
      toast("Session ended", error.message);
      render();
    } finally {
      state.busy = false;
      render();
    }
  }

  async function refreshDashboard(showLoader) {
    if (showLoader !== false) {
      state.busy = true;
      render();
    }

    try {
      var query = "";
      if (state.selectedStudentId && state.user && state.user.role !== "student") {
        query = "?studentId=" + encodeURIComponent(state.selectedStudentId);
      }

      var dashboard = await api("/dashboard" + query);
      state.dashboard = dashboard;
      state.college = dashboard.college || state.college;
      state.subscription = dashboard.subscription || state.subscription;
      state.selectedStudent = dashboard.highlightedStudent || null;
      state.selectedStudentId = state.selectedStudent ? state.selectedStudent.id : "";
      persistSession();
    } catch (error) {
      toast("Refresh failed", error.message);
    } finally {
      state.busy = false;
      render();
      updateCharts();
    }
  }

  async function login(credentials) {
    state.busy = true;
    render();

    try {
      var data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      }, false);

      state.token = data.token;
      state.user = data.user;
      state.college = data.college;
      state.subscription = data.subscription;
      persistSession();
      await refreshDashboard(false);
      connectSocket();
      toast("Welcome back", "The college workspace is ready.");
    } catch (error) {
      toast("Login failed", error.message);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function registerAdmin(payload) {
    state.busy = true;
    render();

    try {
      var data = await api("/auth/register-admin", {
        method: "POST",
        body: JSON.stringify(payload)
      }, false);

      state.token = data.token;
      state.user = data.user;
      state.college = data.college;
      state.subscription = data.subscription;
      persistSession();
      await refreshDashboard(false);
      connectSocket();
      toast("Workspace created", "Your college tenant is live.");
    } catch (error) {
      toast("Registration failed", error.message);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function loginWithDemo() {
    state.busy = true;
    render();

    try {
      var seeded = await api("/demo/bootstrap", { method: "POST" }, false);
      state.demoCredentials = seeded.credentials;
      await login({
        email: seeded.credentials.admin.email,
        password: seeded.credentials.admin.password
      });
    } catch (error) {
      state.busy = false;
      toast("Demo setup failed", error.message);
      render();
    }
  }

  async function loadStudent(studentId) {
    if (!studentId) {
      return;
    }

    state.busy = true;
    render();

    try {
      var payload = await api("/students/" + encodeURIComponent(studentId));
      state.selectedStudent = payload.student;
      state.selectedStudentId = payload.student.id;
    } catch (error) {
      toast("Profile unavailable", error.message);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function createStudent(form) {
    var formData = new FormData(form);
    var payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      department: formData.get("department"),
      program: formData.get("program"),
      semester: Number(formData.get("semester")),
      year: Number(formData.get("year")),
      portalEmail: formData.get("portalEmail"),
      portalPassword: formData.get("portalPassword")
    };

    state.busy = true;
    render();

    try {
      var created = await api("/students", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      state.selectedStudent = created.student;
      state.selectedStudentId = created.student.id;
      form.reset();
      toast("Student added", created.student.name + " is now on the roster.");
      await refreshDashboard(false);
    } catch (error) {
      state.busy = false;
      toast("Student not created", error.message);
      render();
    }
  }

  async function deleteSelectedStudent() {
    if (!state.selectedStudentId || !window.confirm("Delete this student and their records?")) {
      return;
    }

    state.busy = true;
    render();

    try {
      await api("/students/" + encodeURIComponent(state.selectedStudentId), {
        method: "DELETE"
      });
      toast("Student removed", "The profile and linked records were deleted.");
      state.selectedStudent = null;
      state.selectedStudentId = "";
      await refreshDashboard(false);
    } catch (error) {
      state.busy = false;
      toast("Delete failed", error.message);
      render();
    }
  }

  async function addAttendance(form) {
    if (!state.selectedStudentId) {
      toast("Choose a student", "Select a student before recording attendance.");
      return;
    }

    var formData = new FormData(form);
    var payload = {
      date: formData.get("date"),
      status: formData.get("status")
    };

    state.busy = true;
    render();

    try {
      var updated = await api("/students/" + encodeURIComponent(state.selectedStudentId) + "/attendance", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      state.selectedStudent = updated.student;
      toast("Attendance saved", "Attendance updated for " + updated.student.name + ".");
      await refreshDashboard(false);
      form.reset();
    } catch (error) {
      state.busy = false;
      toast("Attendance failed", error.message);
      render();
    }
  }

  async function addMarks(form) {
    if (!state.selectedStudentId) {
      toast("Choose a student", "Select a student before recording marks.");
      return;
    }

    var formData = new FormData(form);
    var payload = {
      subject: formData.get("subject"),
      assessment: formData.get("assessment"),
      score: Number(formData.get("score")),
      maxScore: Number(formData.get("maxScore")),
      recordedAt: formData.get("recordedAt")
    };

    state.busy = true;
    render();

    try {
      var updated = await api("/students/" + encodeURIComponent(state.selectedStudentId) + "/marks", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      state.selectedStudent = updated.student;
      toast("Marks saved", "Assessment scores updated for " + updated.student.name + ".");
      await refreshDashboard(false);
      form.reset();
    } catch (error) {
      state.busy = false;
      toast("Marks failed", error.message);
      render();
    }
  }

  async function scanAlerts() {
    state.busy = true;
    render();

    try {
      var payload = await api("/notifications/scan", { method: "POST" });
      toast("Alerts refreshed", payload.created.length + " notification(s) generated.");
      await refreshDashboard(false);
    } catch (error) {
      state.busy = false;
      toast("Scan failed", error.message);
      render();
    }
  }

  async function updateSubscription(form) {
    var plan = new FormData(form).get("plan");

    state.busy = true;
    render();

    try {
      var payload = await api("/subscription", {
        method: "PATCH",
        body: JSON.stringify({ plan: plan })
      });
      state.subscription = payload.subscription;
      toast("Plan updated", "Subscription moved to " + payload.subscription.plan.toUpperCase() + ".");
      await refreshDashboard(false);
    } catch (error) {
      state.busy = false;
      toast("Plan update failed", error.message);
      render();
    }
  }

  async function downloadReport(type) {
    if (!state.selectedStudentId) {
      toast("Choose a student", "Select a student before exporting reports.");
      return;
    }

    try {
      var blob = await api("/reports/students/" + encodeURIComponent(state.selectedStudentId) + "/" + type, {}, true, "blob");
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = (state.selectedStudent ? slugify(state.selectedStudent.name) : "student") + "-" + type + ".pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast("Report failed", error.message);
    }
  }

  function connectSocket() {
    if (!window.io || !state.token) {
      return;
    }

    disconnectSocket();
    state.liveStatus = "connecting";
    render();

    socket = window.io({
      auth: {
        token: state.token
      }
    });

    socket.on("connect", function () {
      state.liveStatus = "online";
      render();
    });

    socket.on("disconnect", function () {
      state.liveStatus = "offline";
      render();
    });

    socket.on("erp:ready", function () {
      state.liveStatus = "online";
      render();
    });

    socket.on("erp:event", function () {
      state.liveStatus = "syncing";
      render();
      window.clearTimeout(liveRefreshTimer);
      liveRefreshTimer = window.setTimeout(async function () {
        await refreshDashboard(false);
        state.liveStatus = "online";
        render();
      }, 420);
    });
  }

  function disconnectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  function clearSession() {
    disconnectSocket();
    window.localStorage.removeItem(SESSION_KEY);
    state.token = "";
    state.user = null;
    state.college = null;
    state.subscription = null;
    state.dashboard = null;
    state.selectedStudent = null;
    state.selectedStudentId = "";
    state.liveStatus = "offline";
  }

  function persistSession() {
    if (!state.token) {
      return;
    }

    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: state.token,
        user: state.user,
        college: state.college,
        subscription: state.subscription
      })
    );
  }

  function readSession() {
    try {
      var raw = window.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  async function api(path, options, includeAuth, responseType) {
    var settings = options || {};
    var shouldIncludeAuth = includeAuth !== false;
    var headers = Object.assign({}, settings.headers || {});

    if (settings.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (shouldIncludeAuth && state.token) {
      headers.Authorization = "Bearer " + state.token;
    }

    var response = await fetch(API_BASE + path, Object.assign({}, settings, { headers: headers }));

    if (responseType === "blob") {
      if (!response.ok) {
        throw new Error(await safeReadError(response));
      }
      return response.blob();
    }

    var payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    return payload;
  }

  async function safeReadError(response) {
    try {
      var payload = await response.json();
      return payload.error || "Request failed.";
    } catch (error) {
      return "Request failed.";
    }
  }

  function render() {
    root.innerHTML = state.token ? renderAppShell() : renderAuthShell();
    bindEvents();
    updateCharts();
  }

  function renderAuthShell() {
    var loginMode = state.authMode === "login";
    var demoBox = state.demoCredentials
      ? '<div class="credential-box"><strong>Demo ready</strong><br>Admin: ' +
        escapeHtml(state.demoCredentials.admin.email) +
        " / " +
        escapeHtml(state.demoCredentials.admin.password) +
        "<br>Student: " +
        escapeHtml(state.demoCredentials.student.email) +
        " / " +
        escapeHtml(state.demoCredentials.student.password) +
        "</div>"
      : "";

    return (
      '<div class="auth-shell' +
      (state.busy ? " loading-dim" : "") +
      '">' +
      '<section class="auth-visual fade-up">' +
      '<div class="auth-hero">' +
      '<img src="assets/edusmart-logo.svg" alt="EDUSMART logo" class="brand-logo brand-logo--hero">' +
      '<div class="eyebrow">College SaaS ERP</div>' +
      '<h1 class="auth-title">Operate attendance, academics, alerts, and AI intelligence from one calm college workspace.</h1>' +
      '<p class="auth-copy">Multi-tenant college operations with department-wise rosters, semester tracking, live dashboards, PDF reporting, and risk scoring that highlights students who need intervention before outcomes slip.</p>' +
      "</div>" +
      '<div class="auth-columns">' +
      renderAuthFeature("Multi-college SaaS", "Each college runs in an isolated tenant with its own data, dashboards, and subscription.") +
      renderAuthFeature("Role-aware access", "Admins manage the full system while student accounts only see their own academic profile.") +
      renderAuthFeature("Academic intelligence", "Attendance trends, mark averages, performance risk, and weak-signal alerts stay visible.") +
      renderAuthFeature("Ready to deploy", "Frontend, Node backend, and Flask AI service map cleanly to Vercel, Render, and Railway.") +
      "</div>" +
      "</section>" +
      '<section class="auth-panel fade-up">' +
      '<div><div class="panel-tag">Tenant Access</div><h2 class="section-title">' +
      (loginMode ? "Sign in to your college workspace" : "Create a college tenant") +
      '</h2><p class="section-copy">' +
      (loginMode
        ? "Use admin credentials to manage the ERP, or student credentials to view your personal record."
        : "Start with the free tier or open directly on Pro for unlimited student capacity.") +
      "</p></div>" +
      '<div class="auth-toggle">' +
      '<button type="button" data-auth-mode="login" class="' +
      (loginMode ? "is-active" : "") +
      '">Login</button>' +
      '<button type="button" data-auth-mode="register" class="' +
      (!loginMode ? "is-active" : "") +
      '">Register</button>' +
      "</div>" +
      (loginMode ? renderLoginForm() : renderRegisterForm()) +
      demoBox +
      '<div class="button-row"><button type="button" class="secondary-button" id="demo-login">Open Demo College</button></div>' +
      renderToasts() +
      "</section>" +
      "</div>"
    );
  }

  function renderLoginForm() {
    return (
      '<form id="login-form" class="form-stack">' +
      '<div class="field"><label>Email</label><input required type="email" name="email" placeholder="admin@yourcollege.edu"></div>' +
      '<div class="field"><label>Password</label><input required type="password" name="password" placeholder="Enter password"></div>' +
      '<div class="button-row"><button type="submit" class="primary-button">Sign in</button></div>' +
      "</form>"
    );
  }

  function renderRegisterForm() {
    return (
      '<form id="register-form" class="form-stack">' +
      '<div class="form-grid">' +
      '<div class="field"><label>College Name</label><input required type="text" name="collegeName" placeholder="Aurora City College"></div>' +
      '<div class="field"><label>Admin Name</label><input required type="text" name="adminName" placeholder="Priya Raman"></div>' +
      '<div class="field"><label>Admin Email</label><input required type="email" name="email" placeholder="admin@yourcollege.edu"></div>' +
      '<div class="field"><label>Password</label><input required minlength="8" type="password" name="password" placeholder="Minimum 8 characters"></div>' +
      '<div class="field full-span"><label>Plan</label><select name="plan"><option value="free">Free (up to 60 students)</option><option value="pro">Pro (unlimited students)</option></select></div>' +
      "</div>" +
      '<div class="button-row"><button type="submit" class="primary-button">Create Workspace</button></div>' +
      "</form>"
    );
  }

  function renderAuthFeature(title, text) {
    return '<div class="auth-feature"><strong>' + escapeHtml(title) + "</strong><span>" + escapeHtml(text) + "</span></div>";
  }

  function renderAppShell() {
    var dashboard = state.dashboard || emptyDashboard();
    var summary = dashboard.summary;
    var filteredStudents = getFilteredStudents();
    var departments = uniqueValues(dashboard.studentSummaries.map(function (student) {
      return student.department;
    }));

    return (
      '<div class="app-shell' +
      (state.busy ? " loading-dim" : "") +
      '">' +
      renderSidebar(dashboard) +
      '<main class="main-stage">' +
      renderTopbar(summary) +
      '<section id="overview" class="metric-strip fade-up">' +
      renderMetric("Students", summary.totalStudents, "Across your visible roster") +
      renderMetric("Avg Attendance", summary.averageAttendance + "%", "Live from date-wise records") +
      renderMetric("Avg Marks", summary.averageMarks + "%", "Across recorded assessments") +
      renderMetric("High Risk", summary.highRiskCount, summary.topPerformer ? "Top performer: " + summary.topPerformer.name : "No ranking yet") +
      "</section>" +
      '<section class="chart-grid fade-up">' +
      '<div class="panel"><div class="panel-header"><div><h2 class="section-title">Attendance Trend</h2><p class="section-copy">Seven recent teaching days with real-time updates from the attendance register.</p></div><div class="live-pill">' +
      escapeHtml(liveStatusLabel()) +
      '</div></div><div class="canvas-wrap"><canvas id="attendance-chart"></canvas></div></div>' +
      '<div class="panel"><div class="panel-header"><div><h2 class="section-title">Marks Trend</h2><p class="section-copy">Recent assessment averages across the currently visible cohort.</p></div></div><div class="canvas-wrap"><canvas id="marks-chart"></canvas></div></div>' +
      "</section>" +
      '<section id="students" class="roster-layout fade-up">' +
      '<div class="panel"><div class="panel-header"><div><h2 class="section-title">Student Roster</h2><p class="section-copy">Search by name, roll number, email, risk, department, or semester.</p></div><span class="badge">' +
      filteredStudents.length +
      " visible</span></div>" +
      '<div class="search-row">' +
      '<input id="student-search" type="search" placeholder="Search students" value="' +
      escapeHtml(state.filters.search) +
      '">' +
      '<select id="risk-filter"><option value="">All risk levels</option><option value="High"' +
      selected(state.filters.risk === "High") +
      '>High</option><option value="Medium"' +
      selected(state.filters.risk === "Medium") +
      '>Medium</option><option value="Low"' +
      selected(state.filters.risk === "Low") +
      '>Low</option></select>' +
      '<select id="department-filter"><option value="">All departments</option>' +
      departments
        .map(function (department) {
          return '<option value="' + escapeHtml(department) + '"' + selected(state.filters.department === department) + ">" + escapeHtml(department) + "</option>";
        })
        .join("") +
      '</select>' +
      '<select id="semester-filter"><option value="">All semesters</option>' +
      renderSemesterOptions(state.filters.semester) +
      "</select>" +
      "</div>" +
      renderStudentList(filteredStudents) +
      "</div>" +
      '<div class="panel">' +
      renderSelectedStudentPanel() +
      "</div>" +
      "</section>" +
      '<section id="insights" class="utility-grid fade-up">' +
      '<div class="panel"><div class="panel-header"><div><h2 class="section-title">Risk Watchlist</h2><p class="section-copy">Students who need follow-up first, based on attendance, marks, and AI scoring.</p></div></div>' +
      renderMiniList(dashboard.weakStudents, true) +
      "</div>" +
      '<div class="panel"><div class="panel-header"><div><h2 class="section-title">Alerts and Leaderboard</h2><p class="section-copy">Operational alerts for admin follow-up, plus top academic performers.</p></div></div>' +
      '<div class="two-col"><div><p class="subtle-title">Recent Alerts</p>' +
      renderNotifications(dashboard.notifications) +
      '</div><div><p class="subtle-title">Top Performers</p>' +
      renderTopPerformers(dashboard.topPerformers) +
      "</div></div></div>" +
      "</section>" +
      renderAdminWorkspace() +
      '<section id="reports" class="panel fade-up"><div class="panel-header"><div><h2 class="section-title">Reports and Exports</h2><p class="section-copy">Download PDF marksheets or attendance reports for the selected student.</p></div></div><div class="report-actions"><button class="primary-button" id="download-marksheet">Download Marksheet</button><button class="secondary-button" id="download-attendance">Download Attendance Report</button></div></section>' +
      renderSettingsPanel() +
      renderToasts() +
      "</main>" +
      "</div>"
    );
  }

  function renderSidebar(dashboard) {
    return (
      '<aside class="sidebar fade-up">' +
      '<div class="brand-lockup"><img src="assets/edusmart-emblem.svg" alt="EDUSMART emblem" class="brand-logo brand-logo--sidebar"><div><h2 class="brand-name">EDUSMART</h2><p class="brand-copy">' +
      escapeHtml((state.college && state.college.name) || "College workspace") +
      "</p></div></div>" +
      '<div class="badge-row"><span class="badge badge--accent">' +
      escapeHtml(state.subscription && state.subscription.plan ? state.subscription.plan.toUpperCase() : "FREE") +
      ' plan</span><span class="badge">' +
      escapeHtml(state.user ? state.user.role.toUpperCase() : "USER") +
      "</span></div>" +
      '<div class="nav-stack">' +
      renderNavButton("Overview", "overview") +
      renderNavButton("Students", "students") +
      renderNavButton("Insights", "insights") +
      renderNavButton("Reports", "reports") +
      (state.user && state.user.role === "admin" ? renderNavButton("Settings", "settings") : "") +
      "</div>" +
      '<div class="user-chip"><strong>' +
      escapeHtml(state.user ? state.user.name : "User") +
      '</strong><span>' +
      escapeHtml(state.user ? state.user.email : "") +
      '</span><span>' +
      escapeHtml(dashboard.studentSummaries.length + " visible student records") +
      '</span></div><button class="ghost-button" id="logout-button" type="button">Log out</button></aside>'
    );
  }

  function renderNavButton(label, target) {
    return '<button type="button" class="nav-button" data-target="' + target + '">' + escapeHtml(label) + "<span>Open</span></button>";
  }

  function renderTopbar(summary) {
    return (
      '<section class="topbar fade-up"><div><div class="eyebrow">Academic Operations</div><h1>' +
      escapeHtml(state.user && state.user.role === "student" ? "My academic command center" : "College operations dashboard") +
      "</h1><p>" +
      escapeHtml(
        state.user && state.user.role === "student"
          ? "Your attendance, marks, risk insights, and downloadable reports stay in one read-only workspace."
          : "Track attendance, marks, weak students, and tenant health without hopping between systems."
      ) +
      '</p></div><div class="top-actions">' +
      (state.user && state.user.role === "admin"
        ? '<button class="primary-button" id="scan-alerts" type="button">Scan Alerts</button>'
        : "") +
      '<button class="secondary-button" id="refresh-dashboard" type="button">Refresh Data</button></div></section>'
    );
  }

  function renderMetric(label, value, foot) {
    return (
      '<article class="metric-tile"><span class="metric-label">' +
      escapeHtml(label) +
      '</span><strong class="metric-value">' +
      escapeHtml(String(value)) +
      '</strong><span class="metric-foot">' +
      escapeHtml(foot) +
      "</span></article>"
    );
  }

  function renderStudentList(students) {
    if (!students.length) {
      return '<div class="empty-state">No students match the current filters.</div>';
    }

    return (
      '<div class="student-list">' +
      students
        .map(function (student) {
          return (
            '<button type="button" class="student-row' +
            (state.selectedStudentId === student.id ? " is-selected" : "") +
            '" data-student-id="' +
            escapeHtml(student.id) +
            '"><div class="row-top"><strong>' +
            escapeHtml(student.name) +
            '</strong><span class="badge ' +
            riskBadgeClass(student.riskLevel) +
            '">' +
            escapeHtml(student.riskLevel) +
            '</span></div><div class="row-meta"><span>' +
            escapeHtml(student.rollNumber) +
            "</span><span>" +
            escapeHtml(student.department) +
            "</span><span>Sem " +
            escapeHtml(String(student.semester)) +
            "</span></div><div class=\"inline-stats\"><span class=\"pill\"><strong>" +
            escapeHtml(String(student.attendancePercentage)) +
            '%</strong> Attendance</span><span class="pill"><strong>' +
            escapeHtml(String(student.averageMarks)) +
            "%</strong> Marks</span></div></button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderSelectedStudentPanel() {
    var student = state.selectedStudent;

    if (!student) {
      return '<div class="empty-state">Select a student to inspect attendance history, marks, AI risk, and reports.</div>';
    }

    return (
      '<div class="profile-grid"><div class="profile-head"><div><h2 class="profile-name">' +
      escapeHtml(student.name) +
      '</h2><p class="profile-meta">' +
      escapeHtml(student.rollNumber + " | " + student.department + " | " + student.program + " | Semester " + student.semester) +
      '</p></div><span class="badge ' +
      riskBadgeClass(student.riskLevel) +
      '">' +
      escapeHtml(student.riskLevel + " risk") +
      "</span></div>" +
      '<div class="two-col">' +
      renderSplitStat(student.attendancePercentage + "%", "Attendance") +
      renderSplitStat(student.averageMarks + "%", "Average marks") +
      renderSplitStat(student.totalMarks, "Total recorded score") +
      renderSplitStat(student.portalEnabled ? "Enabled" : "Not enabled", "Portal access") +
      "</div>" +
      '<div><p class="subtle-title">AI Summary</p><div class="mini-item is-highlighted"><strong>' +
      escapeHtml(student.ai ? student.ai.summary : "No AI insight yet.") +
      '</strong><span class="muted-copy">' +
      escapeHtml(
        student.ai && student.ai.improvementAreas && student.ai.improvementAreas.length
          ? "Focus: " + student.ai.improvementAreas.join(", ")
          : "No improvement areas were returned."
      ) +
      "</span></div></div>" +
      '<div class="two-col"><div><p class="subtle-title">Attendance History</p>' +
      renderAttendanceHistory(student.attendanceHistory) +
      '</div><div><p class="subtle-title">Marks History</p>' +
      renderMarksHistory(student.marksHistory) +
      "</div></div><div><p class=\"subtle-title\">Subject Breakdown</p>" +
      renderSubjectBreakdown(student.subjectBreakdown) +
      "</div>" +
      (state.user && state.user.role === "admin"
        ? '<div class="button-row"><button type="button" class="secondary-button" id="delete-student">Delete Student</button></div>'
        : "") +
      "</div>"
    );
  }

  function renderSplitStat(value, label) {
    return '<div class="split-stat"><strong>' + escapeHtml(String(value)) + "</strong><span>" + escapeHtml(label) + "</span></div>";
  }

  function renderAttendanceHistory(history) {
    if (!history || !history.length) {
      return '<div class="empty-state">No attendance data yet.</div>';
    }

    return (
      '<div class="history-list">' +
      history
        .slice(0, 10)
        .map(function (entry) {
          return '<div class="history-item"><strong>' + escapeHtml(entry.date) + "</strong><small>" + escapeHtml(entry.status) + "</small></div>";
        })
        .join("") +
      "</div>"
    );
  }

  function renderMarksHistory(history) {
    if (!history || !history.length) {
      return '<div class="empty-state">No marks recorded yet.</div>';
    }

    return (
      '<div class="history-list">' +
      history
        .slice(0, 10)
        .map(function (entry) {
          return (
            '<div class="history-item"><strong>' +
            escapeHtml(entry.subject + " | " + entry.assessment) +
            '</strong><small>' +
            escapeHtml(entry.score + "/" + entry.maxScore + " | " + entry.scorePercentage + "% | " + entry.recordedAt.slice(0, 10)) +
            "</small></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderSubjectBreakdown(subjects) {
    if (!subjects || !subjects.length) {
      return '<div class="empty-state">Subject trends will appear after marks are added.</div>';
    }

    return (
      '<div class="mini-list">' +
      subjects
        .map(function (subject) {
          return (
            '<div class="mini-item"><strong>' +
            escapeHtml(subject.subject) +
            '</strong><span class="muted-copy">Average ' +
            escapeHtml(String(subject.averagePercentage)) +
            "% | Best " +
            escapeHtml(String(subject.bestPercentage)) +
            "%</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderMiniList(items, highlightRisk) {
    if (!items || !items.length) {
      return '<div class="empty-state">No flagged students right now.</div>';
    }

    return (
      '<div class="mini-list">' +
      items
        .map(function (item) {
          return (
            '<div class="mini-item' +
            (highlightRisk ? " is-highlighted" : "") +
            '"><div class="row-top"><strong>' +
            escapeHtml(item.name) +
            '</strong><span class="badge ' +
            riskBadgeClass(item.riskLevel) +
            '">' +
            escapeHtml(item.riskLevel) +
            '</span></div><span class="muted-copy">' +
            escapeHtml(item.department + " | " + item.averageMarks + "% marks | " + item.attendancePercentage + "% attendance") +
            "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderNotifications(items) {
    if (!items || !items.length) {
      return '<div class="empty-state">No alerts have been generated yet.</div>';
    }

    return (
      '<div class="notifications-list">' +
      items
        .map(function (item) {
          return (
            '<div class="notification-item"><strong>' +
            escapeHtml(item.title) +
            '</strong><span class="muted-copy">' +
            escapeHtml(item.message) +
            '</span><small>' +
            escapeHtml(formatDateTime(item.createdAt) + " | " + (item.deliveryStatus || "in-app")) +
            "</small></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderTopPerformers(items) {
    if (!items || !items.length) {
      return '<div class="empty-state">Top performers will appear after marks are recorded.</div>';
    }

    return (
      '<div class="mini-list">' +
      items
        .map(function (item) {
          return (
            '<div class="mini-item"><div class="row-top"><strong>' +
            escapeHtml(item.name) +
            '</strong><span class="badge">' +
            escapeHtml(item.department) +
            '</span></div><span class="muted-copy">' +
            escapeHtml(item.averageMarks + "% marks | " + item.attendancePercentage + "% attendance") +
            "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderAdminWorkspace() {
    if (!state.user || state.user.role !== "admin") {
      return "";
    }

    return (
      '<section class="forms-grid fade-up">' +
      '<form id="new-student-form" class="panel"><div class="panel-header"><div><h2 class="section-title">Add Student</h2><p class="section-copy">Create a new student profile and optional portal login.</p></div></div><div class="form-grid">' +
      '<div class="field"><label>Name</label><input required name="name" type="text" placeholder="Aarav Nair"></div>' +
      '<div class="field"><label>Email</label><input name="email" type="email" placeholder="student@college.edu"></div>' +
      '<div class="field"><label>Department</label><input required name="department" type="text" placeholder="Computer Science"></div>' +
      '<div class="field"><label>Program</label><input required name="program" type="text" placeholder="B.Tech CSE"></div>' +
      '<div class="field"><label>Semester</label><input required min="1" max="12" name="semester" type="number" placeholder="4"></div>' +
      '<div class="field"><label>Year</label><input required min="1" max="6" name="year" type="number" placeholder="2"></div>' +
      '<div class="field"><label>Portal Email</label><input name="portalEmail" type="email" placeholder="login@student.edu"></div>' +
      '<div class="field"><label>Portal Password</label><input name="portalPassword" type="password" placeholder="Optional"></div>' +
      '</div><div class="button-row"><button class="primary-button" type="submit">Add Student</button></div></form>' +
      '<form id="attendance-form" class="panel"><div class="panel-header"><div><h2 class="section-title">Record Attendance</h2><p class="section-copy">Mark the selected student as present or absent for a specific date.</p></div></div><div class="form-stack">' +
      '<div class="field"><label>Date</label><input required name="date" type="date" value="' +
      todayValue() +
      '"></div><div class="field"><label>Status</label><select name="status"><option value="Present">Present</option><option value="Absent">Absent</option></select></div>' +
      '<div class="button-row"><button class="primary-button" type="submit">Save Attendance</button></div></div></form>' +
      '<form id="marks-form" class="panel"><div class="panel-header"><div><h2 class="section-title">Record Marks</h2><p class="section-copy">Add subject-wise marks and let the dashboard recalculate performance trends.</p></div></div><div class="form-grid">' +
      '<div class="field"><label>Subject</label><input required name="subject" type="text" placeholder="DBMS"></div>' +
      '<div class="field"><label>Assessment</label><input required name="assessment" type="text" placeholder="Midterm"></div>' +
      '<div class="field"><label>Score</label><input required name="score" type="number" min="0" step="1" placeholder="72"></div>' +
      '<div class="field"><label>Max Score</label><input required name="maxScore" type="number" min="1" step="1" value="100"></div>' +
      '<div class="field full-span"><label>Date</label><input required name="recordedAt" type="date" value="' +
      todayValue() +
      '"></div></div><div class="button-row"><button class="primary-button" type="submit">Save Marks</button></div></form>' +
      "</section>"
    );
  }

  function renderSettingsPanel() {
    if (!state.user || state.user.role !== "admin") {
      return "";
    }

    return (
      '<section id="settings" class="panel fade-up"><div class="panel-header"><div><h2 class="section-title">Tenant Settings</h2><p class="section-copy">Switch plans and keep the college tenant within the right SaaS tier.</p></div></div><form id="plan-form" class="settings-row"><select name="plan"><option value="free"' +
      selected(state.subscription && state.subscription.plan === "free") +
      '>Free</option><option value="pro"' +
      selected(state.subscription && state.subscription.plan === "pro") +
      '>Pro</option></select><button class="primary-button" type="submit">Update Plan</button></form></section>'
    );
  }

  function renderToasts() {
    return (
      '<div class="toast-stack">' +
      state.toasts
        .map(function (item) {
          return '<div class="toast"><strong>' + escapeHtml(item.title) + "</strong><span>" + escapeHtml(item.message) + "</span></div>";
        })
        .join("") +
      "</div>"
    );
  }

  function bindEvents() {
    bindAuthEvents();
    bindDashboardEvents();
  }

  function bindAuthEvents() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-auth-mode]"), function (button) {
      button.addEventListener("click", function () {
        state.authMode = button.getAttribute("data-auth-mode");
        render();
      });
    });

    var loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var formData = new FormData(loginForm);
        login({
          email: formData.get("email"),
          password: formData.get("password")
        });
      });
    }

    var registerForm = document.getElementById("register-form");
    if (registerForm) {
      registerForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var formData = new FormData(registerForm);
        registerAdmin({
          collegeName: formData.get("collegeName"),
          adminName: formData.get("adminName"),
          email: formData.get("email"),
          password: formData.get("password"),
          plan: formData.get("plan")
        });
      });
    }

    var demoButton = document.getElementById("demo-login");
    if (demoButton) {
      demoButton.addEventListener("click", function () {
        loginWithDemo();
      });
    }
  }

  function bindDashboardEvents() {
    var logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        clearSession();
        toast("Logged out", "You have left the college workspace.");
        render();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-target]"), function (button) {
      button.addEventListener("click", function () {
        var target = document.getElementById(button.getAttribute("data-target"));
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });

    var refreshButton = document.getElementById("refresh-dashboard");
    if (refreshButton) {
      refreshButton.addEventListener("click", function () {
        refreshDashboard();
      });
    }

    var scanButton = document.getElementById("scan-alerts");
    if (scanButton) {
      scanButton.addEventListener("click", function () {
        scanAlerts();
      });
    }

    var searchInput = document.getElementById("student-search");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.filters.search = searchInput.value;
        render();
      });
    }

    var riskFilter = document.getElementById("risk-filter");
    if (riskFilter) {
      riskFilter.addEventListener("change", function () {
        state.filters.risk = riskFilter.value;
        render();
      });
    }

    var departmentFilter = document.getElementById("department-filter");
    if (departmentFilter) {
      departmentFilter.addEventListener("change", function () {
        state.filters.department = departmentFilter.value;
        render();
      });
    }

    var semesterFilter = document.getElementById("semester-filter");
    if (semesterFilter) {
      semesterFilter.addEventListener("change", function () {
        state.filters.semester = semesterFilter.value;
        render();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-student-id]"), function (button) {
      button.addEventListener("click", function () {
        loadStudent(button.getAttribute("data-student-id"));
      });
    });

    var newStudentForm = document.getElementById("new-student-form");
    if (newStudentForm) {
      newStudentForm.addEventListener("submit", function (event) {
        event.preventDefault();
        createStudent(newStudentForm);
      });
    }

    var attendanceForm = document.getElementById("attendance-form");
    if (attendanceForm) {
      attendanceForm.addEventListener("submit", function (event) {
        event.preventDefault();
        addAttendance(attendanceForm);
      });
    }

    var marksForm = document.getElementById("marks-form");
    if (marksForm) {
      marksForm.addEventListener("submit", function (event) {
        event.preventDefault();
        addMarks(marksForm);
      });
    }

    var deleteButton = document.getElementById("delete-student");
    if (deleteButton) {
      deleteButton.addEventListener("click", function () {
        deleteSelectedStudent();
      });
    }

    var marksheetButton = document.getElementById("download-marksheet");
    if (marksheetButton) {
      marksheetButton.addEventListener("click", function () {
        downloadReport("marksheet");
      });
    }

    var attendanceButton = document.getElementById("download-attendance");
    if (attendanceButton) {
      attendanceButton.addEventListener("click", function () {
        downloadReport("attendance");
      });
    }

    var planForm = document.getElementById("plan-form");
    if (planForm) {
      planForm.addEventListener("submit", function (event) {
        event.preventDefault();
        updateSubscription(planForm);
      });
    }
  }

  function updateCharts() {
    if (!state.dashboard || !document.getElementById("attendance-chart") || !window.Chart) {
      return;
    }

    if (charts.attendance) {
      charts.attendance.destroy();
    }
    if (charts.marks) {
      charts.marks.destroy();
    }

    var attendanceCtx = document.getElementById("attendance-chart").getContext("2d");
    var marksCtx = document.getElementById("marks-chart").getContext("2d");

    charts.attendance = new window.Chart(attendanceCtx, {
      type: "line",
      data: {
        labels: state.dashboard.trends.attendance.map(function (point) {
          return point.label;
        }),
        datasets: [
          {
            label: "Attendance %",
            data: state.dashboard.trends.attendance.map(function (point) {
              return point.percentage;
            }),
            borderColor: "#6ee7b7",
            backgroundColor: "rgba(110, 231, 183, 0.16)",
            tension: 0.35,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: "#6ee7b7"
          }
        ]
      },
      options: chartOptions("%")
    });

    charts.marks = new window.Chart(marksCtx, {
      type: "bar",
      data: {
        labels: state.dashboard.trends.marks.map(function (point) {
          return point.label;
        }),
        datasets: [
          {
            label: "Marks %",
            data: state.dashboard.trends.marks.map(function (point) {
              return point.averagePercentage;
            }),
            backgroundColor: "rgba(245, 158, 11, 0.72)",
            borderRadius: 12
          }
        ]
      },
      options: chartOptions("%")
    });
  }

  function chartOptions(suffix) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.parsed.y + suffix;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#9fb1c8"
          },
          grid: {
            color: "rgba(255,255,255,0.05)"
          }
        },
        y: {
          ticks: {
            color: "#9fb1c8"
          },
          grid: {
            color: "rgba(255,255,255,0.05)"
          },
          suggestedMax: 100
        }
      }
    };
  }

  function getFilteredStudents() {
    var students = (state.dashboard && state.dashboard.studentSummaries) || [];
    var search = state.filters.search.toLowerCase();

    return students.filter(function (student) {
      var matchesSearch =
        !search ||
        student.name.toLowerCase().indexOf(search) !== -1 ||
        String(student.rollNumber).toLowerCase().indexOf(search) !== -1 ||
        String(student.email || "").toLowerCase().indexOf(search) !== -1;
      var matchesRisk = !state.filters.risk || student.riskLevel === state.filters.risk;
      var matchesDepartment = !state.filters.department || student.department === state.filters.department;
      var matchesSemester = !state.filters.semester || String(student.semester) === String(state.filters.semester);
      return matchesSearch && matchesRisk && matchesDepartment && matchesSemester;
    });
  }

  function emptyDashboard() {
    return {
      studentSummaries: [],
      trends: {
        attendance: [],
        marks: []
      },
      summary: {
        totalStudents: 0,
        averageAttendance: 0,
        averageMarks: 0,
        highRiskCount: 0,
        topPerformer: null
      },
      weakStudents: [],
      topPerformers: [],
      notifications: []
    };
  }

  function riskBadgeClass(level) {
    if (level === "High") {
      return "badge--danger";
    }
    if (level === "Medium") {
      return "badge--warn";
    }
    return "";
  }

  function selected(isSelected) {
    return isSelected ? ' selected="selected"' : "";
  }

  function renderSemesterOptions(activeValue) {
    var output = "";
    for (var semester = 1; semester <= 8; semester += 1) {
      output += '<option value="' + semester + '"' + selected(String(activeValue) === String(semester)) + ">Semester " + semester + "</option>";
    }
    return output;
  }

  function uniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean))).sort();
  }

  function toast(title, message) {
    var item = {
      id: String(Date.now()) + String(Math.random()),
      title: title,
      message: message
    };
    state.toasts = state.toasts.concat(item).slice(-3);
    render();
    window.setTimeout(function () {
      state.toasts = state.toasts.filter(function (toastItem) {
        return toastItem.id !== item.id;
      });
      render();
    }, 3600);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function todayValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) {
      return "Unknown time";
    }

    return new Date(value).toLocaleString();
  }

  function liveStatusLabel() {
    if (state.liveStatus === "online") {
      return "Live sync active";
    }
    if (state.liveStatus === "syncing") {
      return "Refreshing";
    }
    if (state.liveStatus === "connecting") {
      return "Connecting";
    }
    return "Offline";
  }
})();
