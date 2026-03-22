const { generateId, getLastSchoolDates, slugifyName } = require("../lib/utils");
const { hashPassword } = require("./security");

const DEMO_COLLEGE_NAME = "Aurora City College";
const DEMO_ADMIN_EMAIL = "admin@auroracity.edu";
const DEMO_ADMIN_PASSWORD = "Admin@123";
const DEMO_STUDENT_EMAIL = "student@auroracity.edu";
const DEMO_STUDENT_PASSWORD = "Student@123";

async function bootstrapDemoCollege(db) {
  let college = db.colleges.find(function findDemoCollege(entry) {
    return entry.slug === slugifyName(DEMO_COLLEGE_NAME);
  });

  if (!college) {
    const collegeId = generateId("college");
    college = {
      id: collegeId,
      name: DEMO_COLLEGE_NAME,
      slug: createUniqueCollegeSlug(db, DEMO_COLLEGE_NAME),
      createdAt: new Date().toISOString(),
      contactEmail: DEMO_ADMIN_EMAIL
    };
    db.colleges.push(college);

    db.subscriptions.push({
      id: generateId("sub"),
      collegeId,
      plan: "pro",
      status: "active",
      studentLimit: null,
      createdAt: new Date().toISOString()
    });

    const roster = createRoster(collegeId);
    db.students.push.apply(db.students, roster.students);
    db.attendance.push.apply(db.attendance, roster.attendance);
    db.marks.push.apply(db.marks, roster.marks);

    const adminUser = {
      id: generateId("user"),
      collegeId,
      role: "admin",
      name: "Priya Raman",
      email: DEMO_ADMIN_EMAIL,
      passwordHash: await hashPassword(DEMO_ADMIN_PASSWORD),
      createdAt: new Date().toISOString()
    };

    const studentUser = {
      id: generateId("user"),
      collegeId,
      role: "student",
      name: roster.students[0].name,
      email: DEMO_STUDENT_EMAIL,
      passwordHash: await hashPassword(DEMO_STUDENT_PASSWORD),
      studentId: roster.students[0].id,
      createdAt: new Date().toISOString()
    };

    db.users.push(adminUser, studentUser);
  }

  return {
    collegeName: DEMO_COLLEGE_NAME,
    admin: {
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD
    },
    student: {
      email: DEMO_STUDENT_EMAIL,
      password: DEMO_STUDENT_PASSWORD
    }
  };
}

function createRoster(collegeId) {
  const rosterBlueprint = [
    ["Aarav Nair", "Computer Science", "B.Tech CSE", 6, 3],
    ["Meera Shah", "Computer Science", "B.Tech CSE", 4, 2],
    ["Diya Kapoor", "Information Technology", "B.Tech IT", 6, 3],
    ["Rohan Iyer", "Mechanical Engineering", "B.Tech ME", 8, 4],
    ["Ananya Sen", "Electronics", "B.Tech ECE", 4, 2],
    ["Kabir Thomas", "Commerce", "B.Com", 2, 1],
    ["Ishita Paul", "Commerce", "B.Com", 6, 3],
    ["Yash Verma", "Business Administration", "BBA", 4, 2],
    ["Sana Ali", "Biotechnology", "B.Sc Biotechnology", 2, 1],
    ["Neel Joshi", "Computer Science", "MCA", 2, 1],
    ["Aditi Rao", "Psychology", "B.A Psychology", 6, 3],
    ["Karan Bhat", "Civil Engineering", "B.Tech Civil", 8, 4]
  ];

  const dates = getLastSchoolDates(12).slice().reverse();
  const subjectsByProgram = {
    "B.Tech CSE": ["DSA", "DBMS", "Operating Systems", "AI"],
    "B.Tech IT": ["Cloud Computing", "Networks", "Java", "Analytics"],
    "B.Tech ME": ["Thermodynamics", "CAD", "Manufacturing", "Robotics"],
    "B.Tech ECE": ["Signals", "VLSI", "Embedded Systems", "IoT"],
    "B.Com": ["Accounting", "Business Law", "Taxation", "Economics"],
    BBA: ["Management", "Finance", "Marketing", "Operations"],
    "B.Sc Biotechnology": ["Genetics", "Biochemistry", "Microbiology", "Lab Methods"],
    MCA: ["Algorithms", "Web Engineering", "ML Basics", "Data Warehousing"],
    "B.A Psychology": ["Cognition", "Counselling", "Research Methods", "Social Psychology"],
    "B.Tech Civil": ["Structures", "Surveying", "Concrete Tech", "Hydraulics"]
  };

  const students = [];
  const attendance = [];
  const marks = [];

  rosterBlueprint.forEach(function buildStudent(entry, index) {
    const studentId = generateId("student");
    const rollNumber = `ACC${String(index + 1).padStart(3, "0")}`;
    const student = {
      id: studentId,
      collegeId,
      name: entry[0],
      email: index === 0 ? DEMO_STUDENT_EMAIL : `${slugifyName(entry[0])}@auroracity.edu`,
      department: entry[1],
      program: entry[2],
      semester: entry[3],
      year: entry[4],
      rollNumber,
      createdAt: new Date().toISOString()
    };

    students.push(student);

    dates.forEach(function buildAttendance(date, dayIndex) {
      const attendanceSeed = (index * 7 + dayIndex * 5) % 10;
      const threshold = index % 4 === 0 ? 6 : index % 3 === 0 ? 7 : 8;
      attendance.push({
        id: generateId("attn"),
        collegeId,
        studentId,
        date,
        status: attendanceSeed < threshold ? "Present" : "Absent",
        updatedAt: new Date().toISOString()
      });
    });

    const subjects = subjectsByProgram[student.program] || ["Core Subject", "Elective 1", "Elective 2", "Lab"];
    subjects.forEach(function buildMarks(subject, subjectIndex) {
      ["Midterm", "Internal", "End Semester"].forEach(function buildAssessment(assessment, assessmentIndex) {
        const basePercentage = 48 + ((index * 9 + subjectIndex * 8 + assessmentIndex * 5) % 42);
        const adjustment = index % 5 === 0 ? -10 : index % 2 === 0 ? 4 : 0;
        const percentage = Math.max(35, Math.min(94, basePercentage + adjustment));
        const maxScore = 100;
        marks.push({
          id: generateId("mark"),
          collegeId,
          studentId,
          subject,
          assessment,
          score: Math.round((percentage / 100) * maxScore),
          maxScore,
          recordedAt: dates[Math.max(0, dates.length - (assessmentIndex + 3))]
        });
      });
    });
  });

  return {
    students,
    attendance,
    marks
  };
}

function createUniqueCollegeSlug(db, name) {
  const base = slugifyName(name) || "college";
  let candidate = base;
  let suffix = 1;

  while (
    db.colleges.some(function matchCollege(college) {
      return college.slug === candidate;
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

module.exports = {
  bootstrapDemoCollege,
  createUniqueCollegeSlug
};
