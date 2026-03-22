from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from flask import Flask, jsonify, request
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


app = Flask(__name__)


@dataclass(frozen=True)
class Labels:
    LOW: int = 0
    MEDIUM: int = 1
    HIGH: int = 2


RISK_LABELS = {
    Labels.LOW: "Low",
    Labels.MEDIUM: "Medium",
    Labels.HIGH: "High",
}


def generate_training_dataset() -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    samples = []
    labels = []

    for _ in range(720):
        attendance = float(rng.uniform(45, 100))
        average_marks = float(rng.uniform(35, 98))
        attendance_trend = float(rng.uniform(-18, 16))
        marks_trend = float(rng.uniform(-18, 18))

        if attendance < 72 or average_marks < 52 or (attendance_trend < -8 and marks_trend < -8):
            label = Labels.HIGH
        elif attendance < 84 or average_marks < 68 or attendance_trend < -4 or marks_trend < -4:
            label = Labels.MEDIUM
        else:
            label = Labels.LOW

        samples.append([attendance, average_marks, attendance_trend, marks_trend])
        labels.append(label)

    return np.array(samples, dtype=float), np.array(labels)


def train_model() -> Pipeline:
    features, labels = generate_training_dataset()
    pipeline = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(max_iter=1200)),
        ]
    )
    pipeline.fit(features, labels)
    return pipeline


MODEL = train_model()


def improvement_areas(attendance: float, average_marks: float, attendance_trend: float, marks_trend: float) -> list[str]:
    suggestions = []

    if attendance < 85:
        suggestions.append("Attendance recovery plan")
    if average_marks < 70:
        suggestions.append("Subject revision support")
    if attendance_trend < 0:
        suggestions.append("Early intervention for consistency")
    if marks_trend < 0:
        suggestions.append("Assessment performance review")
    if not suggestions:
        suggestions.append("Maintain current academic rhythm")

    return suggestions


@app.get("/health")
def health() -> tuple[dict, int]:
    return {"ok": True, "service": "college-ai"}, 200


@app.post("/predict")
def predict() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}

    attendance = float(payload.get("attendancePercentage", 0))
    average_marks = float(payload.get("averageMarks", 0))
    attendance_trend = float(payload.get("attendanceTrend", 0))
    marks_trend = float(payload.get("marksTrend", 0))

    vector = np.array([[attendance, average_marks, attendance_trend, marks_trend]], dtype=float)
    probabilities = MODEL.predict_proba(vector)[0]
    prediction = int(np.argmax(probabilities))

    return (
        jsonify(
            {
                "riskLevel": RISK_LABELS[prediction],
                "score": round(float(probabilities[Labels.HIGH]) * 100, 1),
                "confidence": round(float(np.max(probabilities)), 3),
                "summary": summary_for_label(prediction, attendance, average_marks),
                "improvementAreas": improvement_areas(attendance, average_marks, attendance_trend, marks_trend),
                "source": "flask-scikit-learn",
            }
        ),
        200,
    )


def summary_for_label(label: int, attendance: float, average_marks: float) -> str:
    if label == Labels.HIGH:
        return f"Student needs immediate follow-up: attendance at {attendance:.1f}% and marks at {average_marks:.1f}%."
    if label == Labels.MEDIUM:
        return f"Student is stable but should be monitored: attendance at {attendance:.1f}% and marks at {average_marks:.1f}%."
    return f"Student is currently in a healthy range with attendance at {attendance:.1f}% and marks at {average_marks:.1f}%."


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
