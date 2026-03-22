const PDFDocument = require("pdfkit");

function createMarksheetPdf(college, profile) {
  return createPdfBuffer(function buildMarksheet(doc) {
    writeHeader(doc, college, `${profile.name} Marksheet`);
    writeStudentMeta(doc, profile);

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(13).text("Assessment Summary");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Average Marks: ${profile.averageMarks}%`);
    doc.text(`Total Recorded Score: ${profile.totalMarks}`);
    doc.text(`Risk Level: ${profile.riskLevel}`);
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(13).text("Marks History");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(10);

    if (!profile.marksHistory.length) {
      doc.text("No marks have been recorded yet.");
      return;
    }

    profile.marksHistory.slice(0, 18).forEach(function writeMark(mark) {
      doc.text(
        `${mark.recordedAt.slice(0, 10)}  |  ${mark.subject}  |  ${mark.assessment}  |  ${mark.score}/${mark.maxScore} (${mark.scorePercentage}%)`
      );
    });
  });
}

function createAttendancePdf(college, profile) {
  return createPdfBuffer(function buildAttendanceReport(doc) {
    writeHeader(doc, college, `${profile.name} Attendance Report`);
    writeStudentMeta(doc, profile);

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(13).text("Attendance Summary");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Attendance Percentage: ${profile.attendancePercentage}%`);
    doc.text(`Recorded Days: ${profile.attendanceHistory.length}`);
    doc.text(`Risk Level: ${profile.riskLevel}`);
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(13).text("Attendance History");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(10);

    if (!profile.attendanceHistory.length) {
      doc.text("No attendance entries have been recorded yet.");
      return;
    }

    profile.attendanceHistory.slice(0, 20).forEach(function writeAttendance(entry) {
      doc.text(`${entry.date}  |  ${entry.status}`);
    });
  });
}

function createPdfBuffer(builder) {
  return new Promise(function resolveBuffer(resolve) {
    const doc = new PDFDocument({ margin: 42 });
    const chunks = [];

    doc.on("data", function collect(chunk) {
      chunks.push(chunk);
    });

    doc.on("end", function finish() {
      resolve(Buffer.concat(chunks));
    });

    builder(doc);
    doc.end();
  });
}

function writeHeader(doc, college, title) {
  doc.font("Helvetica-Bold").fontSize(20).text(college.name || "EDUSMART");
  doc.font("Helvetica").fontSize(11).fillColor("#475569").text(title);
  doc.moveDown(0.2);
  doc.text(`Generated on ${new Date().toLocaleString()}`);
  doc.moveDown(1);
  doc.fillColor("#111827");
}

function writeStudentMeta(doc, profile) {
  doc.font("Helvetica-Bold").fontSize(13).text("Student Details");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10);
  doc.text(`Roll Number: ${profile.rollNumber}`);
  doc.text(`Department: ${profile.department}`);
  doc.text(`Program: ${profile.program}`);
  doc.text(`Semester: ${profile.semester}`);
  doc.text(`Year: ${profile.year}`);
  doc.text(`Email: ${profile.email || "Not provided"}`);
}

module.exports = {
  createAttendancePdf,
  createMarksheetPdf
};
