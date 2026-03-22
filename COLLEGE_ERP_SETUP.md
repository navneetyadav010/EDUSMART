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

## Production deployment

EDUSMART is now prepared for a split deployment:

- Frontend: Vercel
- API: Render web service
- AI service: Render web service
- Database: MongoDB Atlas

### 1. MongoDB Atlas

Create a MongoDB Atlas cluster and copy the connection string into:

- `MONGODB_URI`
- `MONGODB_DB_NAME`

### 2. Render

This repo includes [render.yaml](C:/Users/navne/OneDrive/Documents/New%20project/render.yaml) for:

- `edusmart-api`
- `edusmart-ai`

In Render, import the Blueprint from this repo and fill these secrets:

- `COLLEGE_ERP_JWT_SECRET`
- `CLIENT_ORIGIN`
- `MONGODB_URI`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Use your Vercel frontend URL as `CLIENT_ORIGIN`.

### 3. Vercel

This repo includes [vercel.json](C:/Users/navne/OneDrive/Documents/New%20project/vercel.json) and [build-vercel.js](C:/Users/navne/OneDrive/Documents/New%20project/scripts/build-vercel.js).

Set these Vercel environment variables:

- `EDUSMART_API_BASE`
- `EDUSMART_SOCKET_URL`
- `EDUSMART_SOCKET_PATH`

Example values:

- `EDUSMART_API_BASE=https://your-edusmart-api.onrender.com`
- `EDUSMART_SOCKET_URL=https://your-edusmart-api.onrender.com`
- `EDUSMART_SOCKET_PATH=/socket.io`

Then deploy the repo to Vercel. The build will output a static frontend in `dist/`.
