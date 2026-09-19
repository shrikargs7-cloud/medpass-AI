# MedPass AI & Trace Commons

**MedPass AI** is a modern healthcare workflow platform that automates insurance approvals, analyzes hospital discharge blockers, and creates anonymous medical datasets for researchers. It simplifies the complicated process of health insurance claims into a transparent, easy-to-use interface.

---

## 🚀 Key Features

1. **Smart Insurance Dashboards:**
   - **For Hospitals:** Easily track active admissions, view real-time discharge blockers, and monitor the pre-authorization pipeline.
   - **For Insurers:** A secure adjudication portal to review claims, automatically map billing codes, and instantly flag fraudulent or missing data.
   - **For Patients:** A jargon-free view of their coverage, showing exactly what is covered and why.

2. **AI-Powered Medical Chatbot:**
   - Ask our built-in assistant about cases, claim statuses, and policy details.
   - It seamlessly reads clinical data and returns beautifully formatted, accurate answers (No AI hallucinations).

3. **Trace Commons (Database Engine):**
   - Strictly reserved for administrators, this engine converts live hospital data into 100% anonymous operational datasets.
   - Generates research-ready ZIP bundles containing CSV and highly-compressed **Parquet** files that are fully compliant with the DPDP Act 2023.

---

## 🛠 Tech Stack

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, Google Sans (Plus Jakarta Sans).
*   **Backend:** Python, FastAPI, SQLite/PostgreSQL, DuckDB, Pandas, PyArrow.
*   **AI Integrations:** Google Gemini (for Document Parsing & Chatbot).

---

## ⚙️ CI/CD Pipeline

This project includes a fully automated Continuous Integration & Continuous Deployment (CI/CD) pipeline via **GitHub Actions**.

*   **Continuous Integration (CI):** On every push or pull request to the `main` branch, GitHub Actions automatically spins up an Ubuntu environment, installs all Node.js/Python dependencies, builds the Vite frontend, and validates the backend Python syntax.
*   **Continuous Deployment (CD):** 
    *   **Frontend:** Deploys instantly via **Vercel**. Any updates to the `main` branch trigger a live production build.
    *   **Backend:** Deploys via cloud platforms (like Render or Railway) by binding to the `$PORT` environment variable.

*(You can view the exact pipeline script in `.github/workflows/ci-cd.yml`)*

---

## 🚀 How to Deploy

### 1. Deploying the Frontend (Vercel)
1. Import this repository into Vercel.
2. Set the **Framework Preset** to `Vite`.
3. Set the **Root Directory** to `frontend`.
4. Leave the Build Command as `npm run build` and Output Directory as `dist`.
5. Under Environment Variables, paste the following (Ensure you update the API URL to your live backend):
   ```env
   VITE_API_URL=https://your-backend-url-goes-here.com
   VITE_FIREBASE_API_KEY=your_key_here
   VITE_FIREBASE_AUTH_DOMAIN=medpass-93fd7.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=medpass-93fd7
   VITE_FIREBASE_STORAGE_BUCKET=medpass-93fd7.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=160228173971
   VITE_FIREBASE_APP_ID=1:160228173971:web:678dfff4291e595774c566
   VITE_FIREBASE_MEASUREMENT_ID=G-J6JRG584YE
   ```

### 2. Deploying the Backend
1. Deploy the `backend/` folder to a service like Render or AWS.
2. Set the following Environment Variables:
   ```env
   SECRET_KEY=medpass_production_secret_9942_!@#
   CORS_ORIGINS=*
   GEMINI_API_KEY=your_google_ai_key
   ```
3. The server will start automatically by binding to `0.0.0.0:$PORT`.

---

## 🖥 Local Setup (For Developers)

**Backend Setup:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python ../scripts/seed_demo.py
python ../scripts/seed_trace.py
uvicorn app.main:app --reload --port 8000
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🔄 Latest Updates (Current Release)
- **UI & Typography Polish:** Replaced broken CDN fonts with Plus Jakarta Sans (Google Sans) for a crisp, enterprise-grade aesthetic.
- **Dynamic Analytics Redesign:** Completely overhauled the Hospital Preauth Pipeline and Discharge Blocker infographics with live data, premium semantic colors, and smooth animations.
- **Enhanced Data Exports:** Upgraded the Trace Commons engine to produce richly detailed, fully anonymized CSV and Parquet files for clinical/financial research.
- **Chatbot Fixes:** Implemented exact word-boundary NLP matching to prevent patient name hallucinations during generic queries.

