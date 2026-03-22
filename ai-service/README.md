# College AI Service

Flask + scikit-learn service for the EDUSMART risk predictions.

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

The API starts on `http://localhost:5000`.

## Endpoints

- `GET /health`
- `POST /predict`

Sample payload:

```json
{
  "attendancePercentage": 78,
  "averageMarks": 61,
  "attendanceTrend": -5,
  "marksTrend": -3
}
```
