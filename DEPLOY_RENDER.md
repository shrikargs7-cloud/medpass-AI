# Deploying MedPass AI + Trace Commons to Render

This repository includes a multi-service [Render Blueprint](https://render.com/docs/blueprint-spec) (`render.yaml`) that provisions and orchestrates:
1. **`medpass-db`**: Managed PostgreSQL Database
2. **`medpass-ai-backend`**: FastAPI Python web service with automatic database migrations and initial demo seeding
3. **`medpass-ai-frontend`**: React + Vite Single Page Application (Static Site)

---

## 1-Click Deployment (Recommended)

### Step 1: Push your code to GitHub
Ensure all your latest changes are pushed to your GitHub repository:
```bash
git add .
git commit -m "feat: configure automated Render deployment blueprint"
git push origin main
```

### Step 2: Create a Blueprint on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click the **"New +"** button at top right and select **"Blueprint"**.
3. Connect your GitHub account and choose the repository (`medpass-AI` or your fork).
4. Render will automatically read `render.yaml` and display the resources to be created:
   - Web Service: `medpass-ai-backend` (Python 3.11)
   - Static Site: `medpass-ai-frontend` (React + Vite)
   - Database: `medpass-db` (PostgreSQL 16)
5. Enter any environment variables requested (e.g., `GEMINI_API_KEY` if you have one, or leave blank to use deterministic fallback models).
6. Click **"Apply"**.

Render will now provision the PostgreSQL instance, build the backend, run the database migrations and seed golden demo cases, build the static frontend, and connect them.

---

## Manual Deployment (Alternative)

If you prefer configuring services individually in the Render UI:

### 1. PostgreSQL Database
- **Name**: `medpass-db`
- **Database Name**: `medpass_operational`
- **User**: `medpass_user`
- **Plan**: `Free` (or `Starter`)
- Copy the **Internal Database URL** once created.

### 2. Backend Web Service
- **Name**: `medpass-ai-backend`
- **Runtime**: `Python`
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/health`
- **Environment Variables**:
  - `DATABASE_URL`: Set to the connection string of your PostgreSQL database (Render supports `postgres://` or `postgresql://`).
  - `ENVIRONMENT`: `production`
  - `CORS_ORIGINS`: `*`
  - `BEECEPTOR_BASE_URL`: `https://medpass-mocks.free.beeceptor.com`
  - `GEMINI_API_KEY`: *(optional)*

### 3. Frontend Static Site
- **Name**: `medpass-ai-frontend`
- **Build Command**: `cd frontend && npm install && npm run build`
- **Publish Directory**: `frontend/dist`
- **Redirects / Rewrites**:
  - Type: `Rewrite`
  - Source: `/*`
  - Destination: `/index.html`
- **Environment Variables**:
  - `VITE_API_URL`: Your backend URL, e.g. `https://medpass-ai-backend.onrender.com`

---

## Post-Deployment Verification

### 1. Backend Health Check
Navigate to your backend URL:
- `https://<your-backend>.onrender.com/health` -> Expect `{"status": "healthy", ...}`
- `https://<your-backend>.onrender.com/ready` -> Expect `{"status": "ready", "checks": {"database": "connected", "storage": "writable"}}`
- `https://<your-backend>.onrender.com/docs` -> Interactive OpenAPI / Swagger UI

### 2. Frontend Operational Check
Open your frontend URL:
- `https://<your-frontend>.onrender.com`
- Verify that the 5 golden demo cases appear immediately in the Hospital & Insurer dashboards.
- Test the interactive Preauth submission (Beeceptor simulator) and Financial Waterfall calculator.
- Open the AI Assistant / MCP agent drawer to test interactive explanations.
