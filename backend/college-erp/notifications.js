const nodemailer = require("nodemailer");

const { generateId } = require("../lib/utils");

let mailer;

function getTransporter() {
  if (mailer) {
    return mailer;
  }

  const hasSmtpConfig =
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (hasSmtpConfig) {
    mailer = {
      mode: "smtp",
      client: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })
    };
    return mailer;
  }

  mailer = {
    mode: "simulated",
    client: nodemailer.createTransport({ jsonTransport: true })
  };
  return mailer;
}

async function scanAndSendAlerts(options) {
  const db = options.db;
  const college = options.college;
  const admins = options.admins || [];
  const studentProfiles = options.studentProfiles || [];
  const created = [];

  for (const profile of studentProfiles) {
    const candidates = buildAlertCandidates(profile);

    for (const candidate of candidates) {
      if (hasRecentNotification(db.notifications, profile.id, candidate.type)) {
        continue;
      }

      const notification = {
        id: generateId("notify"),
        collegeId: college.id,
        studentId: profile.id,
        type: candidate.type,
        priority: candidate.priority,
        title: candidate.title,
        message: candidate.message,
        deliveryStatus: "pending",
        createdAt: new Date().toISOString()
      };

      await deliverNotificationEmail(notification, college, admins);
      db.notifications.push(notification);
      created.push(notification);
    }
  }

  return created;
}

function buildAlertCandidates(profile) {
  const candidates = [];

  if (profile.attendancePercentage < 75) {
    candidates.push({
      type: "low_attendance",
      priority: "high",
      title: `${profile.name} is below the attendance threshold`,
      message: `${profile.name} is at ${profile.attendancePercentage}% attendance in ${profile.department}.`
    });
  }

  if (profile.averageMarks < 55) {
    candidates.push({
      type: "performance_alert",
      priority: "medium",
      title: `${profile.name} needs academic support`,
      message: `${profile.name} is averaging ${profile.averageMarks}% across recorded assessments.`
    });
  }

  if (profile.ai && profile.ai.riskLevel === "High") {
    candidates.push({
      type: "high_risk",
      priority: "high",
      title: `${profile.name} has been flagged as high risk`,
      message: profile.ai.summary || `${profile.name} should be reviewed by the academic team.`
    });
  }

  return candidates;
}

function hasRecentNotification(notifications, studentId, type) {
  const now = Date.now();

  return notifications.some(function matchNotification(notification) {
    if (notification.studentId !== studentId || notification.type !== type) {
      return false;
    }

    const age = now - new Date(notification.createdAt).getTime();
    return age < 1000 * 60 * 60 * 24 * 5;
  });
}

async function deliverNotificationEmail(notification, college, admins) {
  const recipients = admins
    .map(function toEmail(admin) {
      return admin.email;
    })
    .filter(Boolean);

  if (!recipients.length) {
    notification.deliveryStatus = "skipped";
    notification.deliveryNote = "No admin email addresses were available.";
    return;
  }

  const transporter = getTransporter();

  try {
    await transporter.client.sendMail({
      from: process.env.SMTP_FROM || "alerts@college-erp.local",
      to: recipients.join(", "),
      subject: `[${college.name}] ${notification.title}`,
      text: `${notification.message}\n\nStudent ID: ${notification.studentId}\nGenerated at: ${notification.createdAt}`
    });

    notification.deliveryStatus = transporter.mode === "smtp" ? "sent" : "simulated";
    notification.deliveryNote =
      transporter.mode === "smtp"
        ? "Alert email delivered through SMTP."
        : "Alert email captured with Nodemailer JSON transport.";
    notification.sentAt = new Date().toISOString();
  } catch (error) {
    notification.deliveryStatus = "failed";
    notification.deliveryNote = error.message;
  }
}

module.exports = {
  scanAndSendAlerts
};
