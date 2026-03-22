const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.COLLEGE_ERP_JWT_SECRET || process.env.JWT_SECRET || "college-erp-dev-secret";

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash || "");
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      collegeId: user.collegeId,
      role: user.role,
      studentId: user.studentId || null,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    collegeId: user.collegeId,
    role: user.role,
    name: user.name,
    email: user.email,
    studentId: user.studentId || null,
    createdAt: user.createdAt
  };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Authentication token is required." });
    return;
  }

  try {
    req.auth = verifyToken(token);
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired session." });
  }
}

function allowRoles(...roles) {
  return function authorize(req, res, next) {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ error: "You do not have access to this action." });
      return;
    }
    next();
  };
}

module.exports = {
  allowRoles,
  hashPassword,
  requireAuth,
  sanitizeUser,
  signToken,
  verifyPassword,
  verifyToken
};
