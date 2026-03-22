# EDUSMART Setup

This repository now contains a separate EDUSMART college ERP MVP alongside the existing storefront files.

## Run EDUSMART

```bash
npm install
npm run erp:start
```

EDUSMART serves on `http://localhost:4000` by default.

## Demo access

Use the `Open Demo College` button on the login screen, or seed the demo tenant through:

```bash
POST /erp-api/demo/bootstrap
```

Demo credentials:

- Admin: `admin@auroracity.edu` / `Admin@123`
- Student: `student@auroracity.edu` / `Student@123`

## Optional AI service

The Node backend works without Python and falls back to heuristic scoring.

To enable the Flask + scikit-learn predictor:

```bash
cd ai-service
pip install -r requirements.txt
python app.py
```

Then set:

```bash
COLLEGE_AI_SERVICE_URL=http://127.0.0.1:5000
```

## Optional email alerts

If SMTP is configured, alerts will be sent to admin accounts. Otherwise they are safely simulated in-app.

Supported variables:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Validation

```bash
npm run erp:check
```
