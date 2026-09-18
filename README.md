# MedPass AI

[![CI Pipeline](https://github.com/medpass-ai/medpass-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/medpass-ai/medpass-platform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-brightgreen.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-teal.svg)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![DuckDB](https://img.shields.io/badge/DuckDB-Analytics-yellow.svg)](https://duckdb.org)
[![Deploy on Render](https://img.shields.io/badge/Render-Deployed-purple.svg)](https://render.com)

**MedPass AI + Trace Commons** is a full-stack, enterprise-grade healthcare insurance workflow and governed longitudinal data platform built for the **DSU DEVHACK**.

---

## The Problem
Hospitals and insurers face fragmented clinical documents, opaque policy rules, manual pre-authorization delays, hidden patient out-of-pocket costs, and blocked discharges. Simultaneously, critical workflow and clinical evidence remain trapped in operational silos, preventing privacy-compliant research and longitudinal analytics.

## The Solution
1. **MedPass AI (Operational Monolith)**:
   - **Document Intelligence**: Extracts structured line items and clinical codes from uploaded invoices/discharge summaries using AI with deterministic fallbacks.
   - **Deterministic Policy & Waterfall Calculation Engine**: Applies strict insurance rules (room rent caps, sub-limits, deductibles, co-pays) with explainable arithmetic—**no LLM makes financial or approval decisions**.
   - **Case Readiness & Blocker Engine**: Calculates real-time readiness scores (0–100%) across 5 weighted categories and pinpoints blockers (missing documents, query pending, billing clearance).
   - **Role-Based Portals**: Tailored interfaces for Hospital Administrators, Insurer/TPA Reviewers, Patients (clear, jargon-free breakdown), and Platform Admins.
   - **AI Agent / Model Context Protocol (MCP)**: Native tools (`get_case`, `check_coverage`, `get_blockers`, `get_decision_evidence`, `query_trace_dataset`) for interactive assistance.

2. **Trace Commons (Governed Longitudinal Data Layer)**:
   - **Transactional Event Outbox**: Captures canonical healthcare events (`CASE_CREATED`, `TREATMENT_ADDED`, `CLAIM_APPROVED`, etc.).
   - **Multi-Layer Privacy Gate**: Deny-list filtration, age banding, month bucketing, facility anonymization, Presidio-compatible PII regex scanning, and small-cell suppression ($k \ge 5$).
   - **DuckDB Cohort Explorer & Analytics**: Real-time querying across synthetic encounters, facilities, and conditions.
   - **Complete Export Packaging**: One-click download of research bundles (`.zip`) containing **Apache Parquet**, **CSV**, **FHIR R4 NDJSON**, **OMOP CDM v5.5 tables**, metadata manifest, data dictionary, and SHA-256 checksums.

---

## Hackathon Track Implementations

| Hackathon Track | Implementation Details | Evidence / Files |
|---|---|---|
| **1. GitHub Developer Track** | Clean git tree, conventional commits, branch protection guidelines, GitHub Actions CI/CD matrix, CODEOWNERS, issue/PR templates, unit & integration test coverage. | `.github/`, `CODEOWNERS`, `pytest` |
| **2. Beeceptor Mocking Track** | Mock client & simulator for Insurer Preauthorization, NHCX Claim Submission, and FHIR endpoints with Success (202), Query (200), Rejection (200), Timeout, and 500 error scenarios. | `backend/app/integrations/beeceptor/` |
| **3. Render Cloud Deployment Track** | Multi-service blueprint (`render.yaml`), containerized builds (`Dockerfile`), health check endpoints (`/health`, `/ready`), and auto-deploy workflow. | `render.yaml`, `Dockerfile` |
| **4. n8n Automation Track** | Decoupled outbound webhook dispatcher firing on case lifecycle events (`CLAIM_SUBMITTED`, `STATUS_CHANGED`) + ready-to-import n8n operational workflow. | `data/n8n/`, `backend/app/integrations/n8n/` |
| **5. Trace Commons Track** | Open data prototype: synthetic population generator (500+ encounters across 3 hospital tiers), data quality audits, lineage graphs, and DuckDB Parquet export. | `trace/`, `backend/app/services/cohort_service.py` |

---

## System Architecture

```
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
│ • Case Readiness & Blocker Engine       │ • Dataset Catalog & Versioning (trace-core-v1.3.0)     │
│ • Decision & Audit Evidence Engine      │ • DuckDB Cohort Query & Parquet/CSV/FHIR Export Engine │
├─────────────────────────────────────────┴────────────────────────────────────────────────────────┤
│ MCP & Integration Layer:                                                                         │
│ • Model Context Protocol (MCP) Tools: get_case, check_coverage, get_blockers, query_trace...      │
│ • External Beeceptor Adapters (Insurer Preauth, NHCX claims, FHIR adapter)                       │
│ • Outbound n8n Webhook Dispatcher (Decoupled lifecycle triggers)                                 │
└───────────────────────────┬──────────────────────────────────────────┬───────────────────────────┘
                            ▼                                          ▼
                PostgreSQL / SQLite DB                        DuckDB & Parquet Engine
           (Operational `app` & `trace` schemas)               (Longitudinal Analytics)
```

---

## Quickstart & Local Setup

### 1. Backend
```bash
# Set up Python virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run seed data script (seeds 5 golden cases + 500 trace encounters)
python ../scripts/seed_demo.py
python ../scripts/seed_trace.py

# Run test suite
pytest app/tests -v

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Golden Demo Cases Included

1. **Case 1 (Clean Preauth)**: Full clinical documentation, in-network hospital, 100% readiness, approved within minutes.
2. **Case 2 (Partial Coverage / Room Rent Cap)**: Room rent ₹7,500 exceeds policy cap of ₹5,000; strict deterministic waterfall calculates proportionate deductions and explains "Why?".
3. **Case 3 (Missing Document / Blocker)**: Case blocked with 45% readiness due to missing Pre-Op ECG report; interactive resolution workflow.
4. **Case 4 (Ambiguous Exclusion / Human Review)**: Pre-existing condition clause flagged for clinical review before payer submission.
5. **Case 5 (Family Floater Coordination)**: Multi-member floater balance tracking across previous family admissions.

---

## License
Distributed under the MIT License. See `LICENSE` for more information.
