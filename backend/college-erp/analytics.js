const { averageOf, getLastSchoolDates, riskScore, roundNumber } = require("../lib/utils");
const { predictStudentRisk } = require("./ai");

function getCollegeContext(db, collegeId) {
  return {
    college: db.colleges.find(function matchCollege(college) {
      return college.id === collegeId;
    }) || null,
    subscription:
      db.subscriptions.find(function matchSubscription(record) {
        return record.collegeId === collegeId;
      }) || null,
    students: db.students.filter(function filterStudents(student) {
      return student.collegeId === collegeId;
    }),
    users: db.users.filter(function filterUsers(user) {
      return user.collegeId === collegeId;
    }),
    attendance: db.attendance.filter(function filterAttendance(entry) {
      return entry.collegeId === collegeId;
    }),
    marks: db.marks.filter(function filterMarks(entry) {
      return entry.collegeId === collegeId;
    }),
    notifications: db.notifications
      .filter(function filterNotifications(entry) {
        return entry.collegeId === collegeId;
      })
      .sort(function newestFirst(a, b) {
        return String(b.createdAt).localeCompare(String(a.createdAt));
      })
  };
}

function buildStudentSnapshot(student, attendanceRecords, markRecords, portalEnabled) {
  const attendanceHistory = attendanceRecords
    .filter(function filterAttendance(entry) {
      return entry.studentId === student.id;
    })
    .sort(function sortAttendance(a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

  const marksHistory = markRecords
    .filter(function filterMarks(entry) {
      return entry.studentId === student.id;
    })
    .map(function normalizeMark(mark) {
      const scorePercentage = mark.maxScore ? (mark.score / mark.maxScore) * 100 : 0;
      return {
        ...mark,
        scorePercentage: roundNumber(scorePercentage)
      };
    })
    .sort(function sortMarks(a, b) {
      return String(b.recordedAt).localeCompare(String(a.recordedAt));
    });

  const totalAttendanceDays = attendanceHistory.length;
  const presentDays = attendanceHistory.filter(function countPresent(entry) {
    return entry.status === "Present";
  }).length;
  const attendancePercentage = totalAttendanceDays ? roundNumber((presentDays / totalAttendanceDays) * 100) : 0;

  const markPercentages = marksHistory.map(function toPercentage(mark) {
    return mark.scorePercentage;
  });

  const averageMarks = roundNumber(averageOf(markPercentages));
  const totalMarks = marksHistory.reduce(function sumMarks(total, mark) {
    return total + Number(mark.score || 0);
  }, 0);
  const attendanceTrend = calculateTrend(
    attendanceHistory
      .slice()
      .reverse()
      .map(function toValue(entry) {
        return entry.status === "Present" ? 100 : 0;
      })
  );
  const marksTrend = calculateTrend(
    marksHistory
      .slice()
      .reverse()
      .map(function toValue(mark) {
        return mark.scorePercentage;
      })
  );

  return {
    ...student,
    portalEnabled: Boolean(portalEnabled),
    attendanceHistory,
    marksHistory,
    attendancePercentage,
    averageMarks,
    totalMarks,
    attendanceTrend,
    marksTrend,
    subjectBreakdown: buildSubjectBreakdown(marksHistory)
  };
}

async function buildStudentProfile(db, collegeId, studentId) {
  const context = getCollegeContext(db, collegeId);
  const student = context.students.find(function matchStudent(record) {
    return record.id === studentId;
  });

  if (!student) {
    return null;
  }

  const portalEnabled = context.users.some(function matchUser(user) {
    return user.studentId === student.id;
  });

  const snapshot = buildStudentSnapshot(student, context.attendance, context.marks, portalEnabled);
  const ai = await predictStudentRisk({
    attendancePercentage: snapshot.attendancePercentage,
    averageMarks: snapshot.averageMarks,
    attendanceTrend: snapshot.attendanceTrend,
    marksTrend: snapshot.marksTrend
  });

  return {
    ...snapshot,
    ai,
    riskLevel: ai.riskLevel
  };
}

async function buildDashboardData(db, collegeId, viewer) {
  const context = getCollegeContext(db, collegeId);
  const studentUserIds = new Set(
    context.users
      .filter(function onlyStudentUsers(user) {
        return user.role === "student" && user.studentId;
      })
      .map(function toStudentId(user) {
        return user.studentId;
      })
  );

  const visibleStudents =
    viewer && viewer.role === "student"
      ? context.students.filter(function ownStudentOnly(student) {
          return student.id === viewer.studentId;
        })
      : context.students.slice();

  const visibleAttendance =
    viewer && viewer.role === "student"
      ? context.attendance.filter(function ownAttendanceOnly(entry) {
          return entry.studentId === viewer.studentId;
        })
      : context.attendance.slice();

  const visibleMarks =
    viewer && viewer.role === "student"
      ? context.marks.filter(function ownMarksOnly(entry) {
          return entry.studentId === viewer.studentId;
        })
      : context.marks.slice();

  const enrichedStudents = await Promise.all(
    visibleStudents.map(async function enrichStudent(student) {
      const snapshot = buildStudentSnapshot(student, visibleAttendance, visibleMarks, studentUserIds.has(student.id));
      const ai = await predictStudentRisk({
        attendancePercentage: snapshot.attendancePercentage,
        averageMarks: snapshot.averageMarks,
        attendanceTrend: snapshot.attendanceTrend,
        marksTrend: snapshot.marksTrend
      });

      return {
        ...snapshot,
        ai,
        riskLevel: ai.riskLevel
      };
    })
  );

  const riskDistribution = enrichedStudents.reduce(
    function countRiskLevels(summary, student) {
      summary[student.riskLevel] = (summary[student.riskLevel] || 0) + 1;
      return summary;
    },
    { High: 0, Medium: 0, Low: 0 }
  );

  const studentSummaries = enrichedStudents
    .map(function toSummary(student) {
      return {
        id: student.id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        department: student.department,
        program: student.program,
        semester: student.semester,
        year: student.year,
        attendancePercentage: student.attendancePercentage,
        averageMarks: student.averageMarks,
        totalMarks: student.totalMarks,
        riskLevel: student.riskLevel,
        portalEnabled: student.portalEnabled
      };
    })
    .sort(function sortByRiskThenName(a, b) {
      const riskGap = riskScore(b.riskLevel) - riskScore(a.riskLevel);
      if (riskGap !== 0) {
        return riskGap;
      }
      return a.name.localeCompare(b.name);
    });

  const sortedByPerformance = enrichedStudents
    .slice()
    .sort(function sortTopPerformers(a, b) {
      if (b.averageMarks !== a.averageMarks) {
        return b.averageMarks - a.averageMarks;
      }
      return b.attendancePercentage - a.attendancePercentage;
    });

  const weakStudents = studentSummaries
    .slice()
    .sort(function sortWeakStudents(a, b) {
      const riskGap = riskScore(b.riskLevel) - riskScore(a.riskLevel);
      if (riskGap !== 0) {
        return riskGap;
      }
      return a.averageMarks - b.averageMarks;
    })
    .slice(0, 5);

  return {
    college: context.college,
    subscription: context.subscription,
    summary: {
      totalStudents: studentSummaries.length,
      averageAttendance: roundNumber(
        averageOf(
          studentSummaries.map(function toAttendance(student) {
            return student.attendancePercentage;
          })
        )
      ),
      averageMarks: roundNumber(
        averageOf(
          studentSummaries.map(function toMarks(student) {
            return student.averageMarks;
          })
        )
      ),
      highRiskCount: riskDistribution.High,
      topPerformer: sortedByPerformance[0]
        ? {
            name: sortedByPerformance[0].name,
            averageMarks: sortedByPerformance[0].averageMarks,
            department: sortedByPerformance[0].department
          }
        : null
    },
    riskDistribution,
    departmentBreakdown: buildDepartmentBreakdown(studentSummaries),
    trends: {
      attendance: buildAttendanceTrend(visibleAttendance, visibleStudents.length),
      marks: buildMarksTrend(visibleMarks)
    },
    topPerformers: sortedByPerformance.slice(0, 5).map(function toTopPerformer(student) {
      return {
        id: student.id,
        name: student.name,
        averageMarks: student.averageMarks,
        attendancePercentage: student.attendancePercentage,
        department: student.department
      };
    }),
    weakStudents,
    studentSummaries,
    notifications:
      viewer && viewer.role === "student"
        ? context.notifications.filter(function ownNotifications(entry) {
            return entry.studentId === viewer.studentId;
          }).slice(0, 8)
        : context.notifications.slice(0, 8)
  };
}

function buildAttendanceTrend(attendanceRecords, totalStudents) {
  const dates = getLastSchoolDates(7).slice().reverse();
  const denominator = totalStudents || 1;

  return dates.map(function buildPoint(date) {
    const entries = attendanceRecords.filter(function matchDate(entry) {
      return entry.date === date;
    });
    const presentCount = entries.filter(function presentOnly(entry) {
      return entry.status === "Present";
    }).length;

    return {
      date,
      label: date.slice(5),
      percentage: entries.length ? roundNumber((presentCount / denominator) * 100) : 0
    };
  });
}

function buildMarksTrend(marksRecords) {
  const grouped = new Map();

  marksRecords.forEach(function collectMark(mark) {
    const key = String(mark.recordedAt || "").slice(0, 10);
    const percentage = mark.maxScore ? (mark.score / mark.maxScore) * 100 : 0;
    const current = grouped.get(key) || { total: 0, count: 0 };
    current.total += percentage;
    current.count += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .sort(function byDate(a, b) {
      return a[0].localeCompare(b[0]);
    })
    .slice(-7)
    .map(function toPoint(entry) {
      return {
        date: entry[0],
        label: entry[0].slice(5),
        averagePercentage: roundNumber(entry[1].count ? entry[1].total / entry[1].count : 0)
      };
    });
}

function buildDepartmentBreakdown(students) {
  const grouped = new Map();

  students.forEach(function countStudent(student) {
    const key = student.department || "General";
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  return Array.from(grouped.entries())
    .map(function toRecord(entry) {
      return {
        department: entry[0],
        count: entry[1]
      };
    })
    .sort(function sortCounts(a, b) {
      return b.count - a.count;
    });
}

function buildSubjectBreakdown(marksHistory) {
  const grouped = new Map();

  marksHistory.forEach(function collectSubject(mark) {
    const current = grouped.get(mark.subject) || { total: 0, count: 0, best: 0 };
    current.total += mark.scorePercentage;
    current.count += 1;
    current.best = Math.max(current.best, mark.scorePercentage);
    grouped.set(mark.subject, current);
  });

  return Array.from(grouped.entries())
    .map(function toSubject(entry) {
      return {
        subject: entry[0],
        averagePercentage: roundNumber(entry[1].count ? entry[1].total / entry[1].count : 0),
        bestPercentage: roundNumber(entry[1].best)
      };
    })
    .sort(function sortSubjects(a, b) {
      return b.averagePercentage - a.averagePercentage;
    });
}

function calculateTrend(values) {
  if (values.length < 2) {
    return 0;
  }

  const splitIndex = Math.max(1, Math.floor(values.length / 2));
  const firstHalf = values.slice(0, splitIndex);
  const secondHalf = values.slice(splitIndex);
  const firstAverage = averageOf(firstHalf);
  const secondAverage = averageOf(secondHalf);
  return roundNumber(secondAverage - firstAverage);
}

module.exports = {
  buildDashboardData,
  buildStudentProfile,
  getCollegeContext
};
