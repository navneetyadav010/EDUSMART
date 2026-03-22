const crypto = require("crypto");

function cleanString(value) {
  return String(value || "").trim();
}

function slugifyName(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createUniqueSlug(db, schoolName) {
  const base = slugifyName(schoolName) || "school";
  let slug = base;
  let suffix = 1;

  while (db.schools.some((school) => school.slug === slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

function generateAdmissionNo(sequence) {
  return `ADM${String(sequence).padStart(4, "0")}`;
}

function getLastSchoolDates(count) {
  const dates = [];
  const cursor = new Date();

  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return dates;
}

function normalizeIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function daysFromNow(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function averageOf(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundNumber(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function riskScore(riskLevel) {
  if (riskLevel === "High") {
    return 3;
  }
  if (riskLevel === "Medium") {
    return 2;
  }
  return 1;
}

module.exports = {
  averageOf,
  cleanString,
  createUniqueSlug,
  daysFromNow,
  generateAdmissionNo,
  generateId,
  getLastSchoolDates,
  normalizeIsoDate,
  riskScore,
  roundNumber,
  slugifyName
};

