<div align="center">
  
# 🏥 MedPass AI & Trace Commons
  
**Next-Generation Healthcare Workflow & Anonymous Data Platform**

[![Demo Video](https://img.shields.io/badge/🎥_Watch_Demo_Video-Click_Here-blue?style=for-the-badge)](https://drive.google.com/file/d/1dmNqRtss118P9AUq0twe5tZ5-AvA5mn1/view?usp=sharing)

</div>

---
## 📖 Overview

**MedPass AI** is a comprehensive, modern healthcare workflow platform designed to bridge the gap between hospitals, insurers, and patients. It automates insurance approvals, analyzes hospital discharge blockers in real-time, and strictly adjudicates claims without hallucination. 

In addition to operational workflows, the platform includes **Trace Commons**—an isolated, strictly-governed database engine that converts live hospital data into 100% anonymous, highly-monetizable operational datasets for researchers and underwriters, fully compliant with the DPDP Act 2023.

---

## 🚀 Core Platform Features

### 1. Smart Insurance Dashboards
- **Hospital Administration Portal:** Easily track active admissions, view real-time discharge blockers, and monitor the pre-authorization pipeline through beautiful, semantic data visualizations.
- **Insurer Adjudication Portal:** A secure, dedicated environment to review claims, automatically map billing codes, and instantly flag fraudulent or missing data via a deterministic rules engine.
- **Patient Portal:** A jargon-free, transparent view of a patient's insurance coverage, showing exactly what is covered, what was rejected, and why.

### 2. AI-Powered Medical Chatbot
- **Context-Aware Assistance:** Ask our built-in assistant about cases, claim statuses, and policy details.
- **Deterministic Guardrails:** The chatbot seamlessly reads clinical data and returns beautifully formatted, accurate markdown answers. We implemented strict word-boundary NLP matching to completely eliminate patient-name hallucinations during generic queries.

### 3. Trace Commons (Data Export Engine)
- **Zero-PII Architecture:** Strictly reserved for administrators, this engine scrubs all Protected Health Information (PHI) and Personally Identifiable Information (PII). Exact dates become generalized months, and exact ages become 15-year brackets.
- **Premium Data Formats:** Generates research-ready ZIP bundles containing enriched CSVs and highly-compressed **Apache Parquet** files, including detailed Data Dictionaries mapping clinical and financial domains.

---

## 🏆 Hackathon Tracks Implemented

| Hackathon Track | Implementation Details |
|---|---|
| **1. GitHub Developer Track** | Implemented a clean Git tree, robust **GitHub Actions CI/CD pipeline** (automatically builds frontend and validates backend syntax on push), CODEOWNERS, and issue/PR templates. |
| **2. Beeceptor Mocking Track** | Built a mock client & simulator for Insurer Preauthorization, NHCX Claim Submission, and FHIR endpoints handling Success, Query, Rejection, and 500 error scenarios. |
| **3. Render / Vercel Cloud Deployment Track** | Multi-service blueprints, containerized backend configurations, and highly-optimized Vite/React frontend deployed via Vercel Serverless with strict environment variable configuration. |
| **4. n8n Automation Track** | Engineered a decoupled outbound webhook dispatcher firing on case lifecycle events (e.g., `CLAIM_SUBMITTED`, `STATUS_CHANGED`) with a ready-to-import n8n operational workflow. |

---

## 🏗 System Architecture

```text
                          ┌────────────────────────────────────────────────────────┐
                          │         React + TypeScript + Tailwind + Lucide         │
                          │   (Hospital, Insurer, Patient, Admin & Trace Portals)  │
                          └───────────────────────────┬────────────────────────────┘
                                                      │ REST API
                                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                FastAPI Modular Backend Service                                   │
├─────────────────────────────────────────┬────────────────────────────────────────────────────────┤
│ MedPass AI Core:                        │ Trace Commons Data Layer:                              │
│ • Document Intelligence (OCR/LLM)       │ • Transactional Event Outbox & Ingestion               │
│ • Deterministic Policy Engine           │ • Privacy De-identification Gate (Presidio/Regex/Mask) │
│ • Financial Waterfall Calculator        │ • Data Quality Rules Engine (Completeness/Integrity)   │
│ • Case Readiness & Blocker Engine       │ • Dataset Catalog & Versioning                           │
│ • Decision & Audit Evidence Engine      │ • DuckDB Cohort Query & Parquet/CSV Export Engine      │
└───────────────────────────┬──────────────────────────────────────────┬───────────────────────────┘
                            ▼                                          ▼
                PostgreSQL / SQLite DB                        DuckDB & Parquet Engine
           (Operational `app` & `trace` schemas)               (Longitudinal Analytics)
```

---

## ⚙️ CI/CD Pipeline & Deployment

This project includes a fully automated Continuous Integration & Continuous Deployment (CI/CD) pipeline via **GitHub Actions**.

*   **Continuous Integration (CI):** On every push or pull request to the `main` branch, GitHub Actions automatically provisions an Ubuntu environment, installs all Node.js/Python dependencies, builds the Vite frontend, and validates the backend Python syntax.
*   **Continuous Deployment (CD):** 
    *   **Frontend:** Deploys instantly via **Vercel**. Any updates to the `main` branch trigger a live production build.
    *   **Backend:** Deploys seamlessly to cloud platforms (like Render or Railway) by dynamically binding to the `$PORT` environment variable.

---

## 💻 Local Setup (For Developers)

### Backend Setup (Python/FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Seed the database with demo cases and trace encounters
python ../scripts/seed_demo.py
python ../scripts/seed_trace.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup (React/Vite)
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## 🔄 Recent Updates & Polish
- **Typography Overhaul:** Replaced external CDNs with Plus Jakarta Sans (Google Sans) for a crisp, enterprise-grade UI aesthetic.
- **Dynamic Infographics Redesign:** Overhauled the Hospital Preauth Pipeline and Discharge Blocker charts with live data mapping, semantic colors, and smooth rendering animations.
- **Trace Export Expansion:** Upgraded the Trace Commons engine to produce richly detailed clinical/financial columns without compromising PII constraints.
  
---

<div align="center">
  <i>Built with ❤️ for DSU DevHack 3.0</i>
</div>
