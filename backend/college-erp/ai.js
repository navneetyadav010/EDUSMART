function buildFallbackInsights(metrics) {
  const attendancePercentage = Number(metrics.attendancePercentage || 0);
  const averageMarks = Number(metrics.averageMarks || 0);
  const attendanceTrend = Number(metrics.attendanceTrend || 0);
  const marksTrend = Number(metrics.marksTrend || 0);

  let riskLevel = "Low";
  let score = 24;

  if (attendancePercentage < 75 || averageMarks < 55) {
    riskLevel = "High";
    score = 84;
  } else if (attendancePercentage < 85 || averageMarks < 70 || attendanceTrend < -6 || marksTrend < -6) {
    riskLevel = "Medium";
    score = 58;
  }

  const improvementAreas = [];
  if (attendancePercentage < 85) {
    improvementAreas.push("Attendance consistency");
  }
  if (averageMarks < 70) {
    improvementAreas.push("Subject revision plan");
  }
  if (marksTrend < 0) {
    improvementAreas.push("Assessment trend recovery");
  }
  if (!improvementAreas.length) {
    improvementAreas.push("Maintain current performance");
  }

  return {
    riskLevel,
    score,
    confidence: 0.72,
    source: "heuristic-fallback",
    improvementAreas,
    summary:
      riskLevel === "High"
        ? "Attendance and academics both need intervention."
        : riskLevel === "Medium"
          ? "Performance is stable but needs monitoring."
          : "The student is performing within a healthy range."
  };
}

async function predictStudentRisk(metrics) {
  const serviceUrl = normalizeServiceUrl(process.env.COLLEGE_AI_SERVICE_URL || process.env.AI_SERVICE_URL);

  if (!serviceUrl || typeof fetch !== "function") {
    return buildFallbackInsights(metrics);
  }

  const controller = new AbortController();
  const timeout = setTimeout(function abortRequest() {
    controller.abort();
  }, 3000);

  try {
    const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metrics),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    const payload = await response.json();
    return {
      riskLevel: payload.riskLevel || payload.risk_level || "Medium",
      score: Number(payload.score || 50),
      confidence: Number(payload.confidence || 0.75),
      source: payload.source || "flask-service",
      improvementAreas: payload.improvementAreas || payload.improvement_areas || [],
      summary: payload.summary || "AI service responded successfully."
    };
  } catch (error) {
    return buildFallbackInsights(metrics);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  predictStudentRisk
};

function normalizeServiceUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
}
