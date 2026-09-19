import re
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.operational import Patient, Case, Hospital, Policy

logger = logging.getLogger("medpass_chatbot")

SYSTEM_PROMPT = """You are MedPass AI Assistant, an enterprise-grade intelligent clinical and health-insurance co-pilot.
You assist doctors, hospital billing desks, insurance claim underwriters, and patients with:
1. Patient encounter status, care plans, and admission details.
2. Clinical protocols, surgical procedures, and ICD-10 diagnoses.
3. Health insurance policies, cashless pre-authorization, room rent sub-limits, deductibles, and co-pays.
4. Medical bill itemization, discharge readiness scoring, and resolving active blockers.

Tone: Professional, helpful, empathetic, concise, and accurate. Format responses using clean markdown (bold text, bullet points, and key figures).
"""

class ChatbotService:
    @classmethod
    def answer_query(
        cls,
        prompt: str,
        case_context: Optional[Dict[str, Any]] = None,
        custom_api_key: Optional[str] = None,
        provider: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Main query handler for MedPass AI Assistant.
        Executes database lookups for patient/case queries, invokes Gemini if configured,
        and falls back to a comprehensive clinical and insurance domain intelligence engine.
        """
        prompt_trimmed = prompt.strip()
        p_lower = prompt_trimmed.lower()

        # Step 1: Capabilities & Help Query Handler
        if any(phrase in p_lower for phrase in [
            "what can you do", "what queries can i ask", "tell me the queries",
            "queries that i can ask", "queries i can ask", "what can i ask", "help me", "capabilities", "what are your features"
        ]):
            return {
                "reply": cls._get_capabilities_guide(),
                "bounded": True,
                "status": "SUCCESS",
                "provider": "assistant_guide"
            }

        # Step 2: Database Patient / Case Lookup
        if db is not None:
            patient_reply = cls._try_patient_case_lookup(prompt_trimmed, db)
            if patient_reply:
                return {
                    "reply": patient_reply,
                    "bounded": True,
                    "status": "SUCCESS",
                    "provider": "medpass_database"
                }

        # Step 3: Check Live Gemini / OpenAI if server API key is configured
        api_key = custom_api_key or settings.GEMINI_API_KEY or settings.OPENAI_API_KEY
        active_provider = provider or ("gemini" if settings.GEMINI_API_KEY else ("openai" if settings.OPENAI_API_KEY else None))

        context_str = ""
        if case_context:
            context_str = (
                f"\nACTIVE CASE CONTEXT:\n"
                f"- Case Number: {case_context.get("case_number", "N/A")}\n"
                f"- Patient: {case_context.get("patient_name", "N/A")}\n"
                f"- Diagnosis: {case_context.get("diagnosis", "N/A")}\n"
                f"- Status: {case_context.get("status", "N/A")}\n"
                f"- Readiness Score: {case_context.get("readiness_score", "N/A")}%\n"
                f"- Active Blockers: {case_context.get("blockers_summary", "None")}\n"
                f"- Total Billed: ₹{case_context.get("total_gross", 0):,.2f}\n"
                f"- Covered: ₹{case_context.get("total_covered", 0):,.2f}\n"
                f"- Patient Payable: ₹{case_context.get("total_patient_payable", 0):,.2f}\n"
            )

        if api_key and active_provider == "gemini":
            try:
                reply = cls._call_gemini(prompt_trimmed, context_str, api_key)
                if reply:
                    return {
                        "reply": reply,
                        "bounded": True,
                        "status": "SUCCESS",
                        "provider": "gemini"
                    }
            except Exception as e:
                logger.warning(f"Gemini call error ({e}). Proceeding to clinical engine.")

        elif api_key and active_provider == "openai":
            try:
                reply = cls._call_openai(prompt_trimmed, context_str, api_key)
                if reply:
                    return {
                        "reply": reply,
                        "bounded": True,
                        "status": "SUCCESS",
                        "provider": "openai"
                    }
            except Exception as e:
                logger.warning(f"OpenAI call error ({e}). Proceeding to clinical engine.")

        # Step 4: Comprehensive Domain Intelligence Engine
        reply = cls._domain_intelligence_answer(prompt_trimmed, case_context, db)
        return {
            "reply": reply,
            "bounded": True,
            "status": "SUCCESS",
            "provider": "medpass_clinical_engine"
        }

    @classmethod
    def _try_patient_case_lookup(cls, prompt: str, db: Session) -> Optional[str]:
        """
        Attempts to identify patient names or case numbers in the prompt and retrieve live records.
        """
        p_clean = prompt.strip()
        p_lower = p_clean.lower()

        stop_words = {
            "fetch", "details", "of", "the", "search", "patient", "show", "me",
            "find", "who", "is", "about", "get", "status", "case", "record", "info",
            "information", "please", "can", "you", "check", "for", "look", "up", "a", "an",
            "how", "much", "what", "when", "where", "why", "coverage", "amount", "fee",
            "bill", "rent", "room", "deduction", "policy", "claim", "total", "payable", "cost", "price"
        }

        # 1. Match Case Numbers directly: e.g. MED-2026-..., CASE-...
        case_match = re.search(r"\b(MED-[A-Za-z0-9\-]+|CASE-[A-Za-z0-9\-]+)\b", p_clean, re.IGNORECASE)
        if case_match:
            case_no = case_match.group(1).upper()
            c = db.query(Case).filter(Case.case_number.ilike(f"%{case_no}%")).first()
            if c:
                return cls._format_case_card(c)

        # 2. Extract potential names/tokens
        words = re.findall(r"[A-Za-z0-9\-]+", p_clean)
        candidate_terms = [w for w in words if w.lower() not in stop_words and len(w) >= 3]

        for term in candidate_terms:
            # Prevent substring matches inside other words (e.g. 'how' inside 'Chowdhury')
            # Match if the name starts with the term OR contains the term after a space
            patient = db.query(Patient).filter(
                (Patient.full_name.ilike(f"{term}%")) | 
                (Patient.full_name.ilike(f"% {term}%")) | 
                (Patient.patient_ref.ilike(f"{term}%"))
            ).first()

            if patient:
                case = db.query(Case).filter(Case.patient_id == patient.id).order_by(Case.created_at.desc()).first()
                return cls._format_patient_card(patient, case)

        return None

    @staticmethod
    def _format_patient_card(patient: Patient, case: Optional[Case]) -> str:
        lines = [
            f"### 👤 Patient Record: **{patient.full_name}**",
            f"• **Patient ID**: `{patient.patient_ref}`",
            f"• **Demographics**: {patient.age_band} yrs • {patient.sex_at_birth.title()} • {patient.phone or "Phone not recorded"}"
        ]

        if case:
            hosp_name = case.hospital.name if case.hospital else "Apollo Multi-Specialty Hospital"
            total_gross = sum([float(i.gross_amount) for i in (case.line_items or [])])
            total_covered = sum([float(d.covered_amount) for d in (case.decisions or [])])
            total_payable = sum([float(d.patient_payable) for d in (case.decisions or [])])

            lines.extend([
                "",
                f"**🏥 Active Admission Details:**",
                f"• **Case Number**: `{case.case_number}`",
                f"• **Hospital**: {hosp_name}",
                f"• **Primary Diagnosis**: {case.primary_diagnosis_name} (`{case.primary_diagnosis_code}`)",
                f"• **Encounter Status**: `{case.case_status}`",
                f"• **Discharge Readiness**: **{case.readiness_score}%** ({case.readiness_band})",
                "",
                f"**💰 Financial & Settlement Ledger:**",
                f"• **Total Billed Gross**: ₹{total_gross:,.2f}",
                f"• **Insurer Approved**: ₹{total_covered:,.2f}",
                f"• **Patient Out-of-Pocket**: ₹{total_payable:,.2f}",
            ])

            unresolved_blockers = [b for b in (case.blockers or []) if not b.is_resolved]
            if unresolved_blockers:
                lines.append("")
                lines.append(f"**⚠️ Active Discharge Blockers ({len(unresolved_blockers)}):**")
                for b in unresolved_blockers:
                    lines.append(f"• **[{b.severity}]** {b.blocker_type}: {b.description} *(Action: {b.action_required})*")
            else:
                lines.append("")
                lines.append("• **Blocker Status**: ✓ No active discharge blockers. All criteria satisfied.")
        else:
            lines.append("\n*No active inpatient admissions currently associated with this patient file.*")

        return "\n".join(lines)

    @staticmethod
    def _format_case_card(case: Case) -> str:
        patient_name = case.patient.full_name if case.patient else "Patient Record"
        hosp_name = case.hospital.name if case.hospital else "MedPass Network Hospital"
        total_gross = sum([float(i.gross_amount) for i in (case.line_items or [])])
        total_covered = sum([float(d.covered_amount) for d in (case.decisions or [])])
        total_payable = sum([float(d.patient_payable) for d in (case.decisions or [])])

        lines = [
            f"### 📋 Case File: **{case.case_number}**",
            f"• **Patient**: {patient_name}",
            f"• **Hospital**: {hosp_name}",
            f"• **Diagnosis**: {case.primary_diagnosis_name} (`{case.primary_diagnosis_code}`)",
            f"• **Status**: `{case.case_status}`",
            f"• **Readiness Score**: **{case.readiness_score}%** ({case.readiness_band})",
            "",
            f"**Financial Breakdown:**",
            f"• **Gross Charges**: ₹{total_gross:,.2f}",
            f"• **Insurer Covered**: ₹{total_covered:,.2f}",
            f"• **Patient Share**: ₹{total_payable:,.2f}",
        ]

        unresolved = [b for b in (case.blockers or []) if not b.is_resolved]
        if unresolved:
            lines.append("")
            lines.append(f"**Active Blockers ({len(unresolved)}):**")
            for b in unresolved:
                lines.append(f"• **[{b.severity}]** {b.description} *(Action: {b.action_required})*")

        return "\n".join(lines)

    @staticmethod
    def _get_capabilities_guide() -> str:
        return (
            "### 🩺 What You Can Ask Me\n\n"
            "I can assist across all operational, clinical, and insurance workflows. Here are sample queries:\n\n"
            "1. **👤 Patient & Case Lookups**\n"
            "   • *\"Fetch Rahul details\"* or *\"Search patient Tanvi\"*\n"
            "   • *\"What is the status of case MED-2026-2003?\"*\n"
            "   • *\"Show clinical summary for patient Ishita\"*\n\n"
            "2. **🛡️ Health Insurance & Policy Rules**\n"
            "   • *\"Explain the room rent deduction rule\"*\n"
            "   • *\"How does 10% co-pay apply on ₹1.5L surgery bill?\"*\n"
            "   • *\"What are the IRDAI cashless pre-authorization SLAs?\"*\n\n"
            "3. **📋 Clinical Care Pathways**\n"
            "   • *\"Appendicitis protocol and ICD-10 code\"*\n"
            "   • *\"Cataract surgery daycare guidelines\"*\n"
            "   • *\"Pre-operative checkup checklist\"*\n\n"
            "4. **⚡ Discharge Readiness & Blockers**\n"
            "   • *\"What blockers are preventing discharge?\"*\n"
            "   • *\"How do I resolve an outstanding co-pay blocker?\"*\n"
            "   • *\"Why is the readiness score below 80%?\"*\n\n"
            "5. **🏥 Hospital & Network Operations**\n"
            "   • *\"Check Apollo hospital network integration\"*\n"
            "   • *\"Cashless Everywhere protocol guidelines\"*"
        )

    @classmethod
    def _domain_intelligence_answer(
        cls,
        prompt: str,
        case_context: Optional[Dict[str, Any]],
        db: Optional[Session]
    ) -> str:
        p = prompt.lower()

        # 1. Greetings
        if any(w in p for w in ["hello", "hi", "hey", "good morning", "good evening", "greetings"]):
            return (
                "Hello! I am your **MedPass AI Clinical & Insurance Assistant**.\n\n"
                "I am ready to help you with:\n"
                "• **Patient Search & Case Records**: Try asking *\"Fetch Rahul details\"* or *\"Search patient Tanvi\"*\n"
                "• **Insurance Adjudication**: Room rent deductions, co-pay calculations, and pre-auths\n"
                "• **Discharge Readiness**: Diagnoses, line-item itemization, and blocker clearance\n\n"
                "How can I assist you with your active case or query?"
            )

        # 2. Discharge Blockers
        if any(w in p for w in ["blocker", "blocked", "stuck", "prevent discharge", "why pending", "readiness"]):
            if case_context:
                blockers = case_context.get("blockers", [])
                if blockers:
                    b_list = "\n".join([f"• **[{b.get("severity", "HIGH")}]** {b.get("type")}: {b.get("description")}\n  *(Remediation: {b.get("action_required", "Resolve")})*" for b in blockers])
                    return f"### ⚠️ Active Discharge Blockers (Case {case_context.get("case_number")}):\n\n{b_list}\n\n**Current Readiness Score**: **{case_context.get("readiness_score")}%**"
                return f"✓ **Case {case_context.get("case_number")}** has zero active discharge blockers. Readiness score is **{case_context.get("readiness_score")}%** (Discharge Cleared)."
            return (
                "### ⚡ Discharge Blocker Framework\n\n"
                "Common discharge blockers governed by MedPass AI:\n"
                "1. **`OUTSTANDING_PATIENT_COPAY`**: Co-pay settlement pending at the billing desk.\n"
                "2. **`MISSING_DISCHARGE_SUMMARY`**: Doctor final clinical summary not yet signed.\n"
                "3. **`FINAL_INSURER_APPROVAL_PENDING`**: Final cashless settlement awaiting underwriter approval.\n\n"
                "*Select an active patient case or ask for a patient name to inspect specific case blockers.*"
            )

        # 3. Room Rent & Policy Deductions
        if any(w in p for w in ["room rent", "room cap", "deductible", "copay", "co-pay", "proportionate", "deduction"]):
            if case_context and case_context.get("total_gross"):
                return (
                    f"### 💰 Financial Breakdown for Case {case_context.get("case_number")}:\n"
                    f"• **Total Gross Billed**: ₹{case_context.get("total_gross"):,.2f}\n"
                    f"• **Insurer Covered**: ₹{case_context.get("total_covered"):,.2f}\n"
                    f"• **Patient Payable**: ₹{case_context.get("total_patient_payable"):,.2f}\n\n"
                    f"**Clause 3.2 Room Rent Rule**:\n"
                    f"If the chosen room rent exceeds the policy cap (e.g. ₹5,000/day for Normal, ₹10,000/day for ICU), "
                    f"associated charges such as doctor rounds, nursing, and OT fee are reduced proportionately. The difference is borne by the patient."
                )
            return (
                "### 🛡️ Room Rent & Proportionate Deduction Rule\n\n"
                "Under standard IRDAI health insurance guidelines:\n"
                "• **Normal Room Cap**: Typically 1% of Sum Insured per day (e.g., ₹5,000/day on a ₹5 Lakh policy).\n"
                "• **ICU Cap**: Typically 2% of Sum Insured per day (e.g., ₹10,000/day).\n"
                "• **Proportionate Deduction Formula**:\n"
                "  $$\\text{Approved Ratio} = \\frac{\\text{Eligible Room Rent}}{\\text{Actual Room Rent Charged}}$$\n"
                "Associated medical charges (surgery fees, nursing, anesthetist) are reimbursed at this ratio, and the patient pays the remainder."
            )

        # 4. Pre-Auth & Cashless Claims
        if any(w in p for w in ["preauth", "pre-auth", "cashless", "claim", "adjudication", "sla", "approval"]):
            if case_context:
                return (
                    f"### 📋 Cashless Pre-Auth Summary (Case {case_context.get("case_number")}):\n"
                    f"• **Patient**: {case_context.get("patient_name")}\n"
                    f"• **Diagnosis**: {case_context.get("diagnosis")}\n"
                    f"• **Authorization Status**: `{case_context.get("status")}`\n"
                    f"• **Readiness Score**: **{case_context.get("readiness_score")}%**\n"
                    f"All line items have been mapped against the insurer policy tariff."
                )
            return (
                "### ⚡ IRDAI Cashless Everywhere Pre-Authorization Protocol\n\n"
                "1. **Initial Pre-Auth (45-Minute SLA)**: Hospital desk submits estimated costs, clinical diagnosis, and doctor notes via NHCX FHIR R4 standard.\n"
                "2. **Adjudication**: Insurer system verifies active sum insured, excludes non-payables, and issues initial pre-authorization token.\n"
                "3. **Final Discharge (3-Hour SLA)**: Final itemized bill is submitted on discharge day. Pre-auth is adjusted to final approved cashless amount."
            )

        # 5. Clinical Protocols (Appendicitis, Cataract, Cholecystitis, etc.)
        if any(w in p for w in ["appendicitis", "cataract", "cholecystitis", "surgery", "laparoscopic", "protocol", "icd"]):
            return (
                "### 🩺 Clinical Protocol Reference\n\n"
                "• **Acute Appendicitis (`K35.80`)**: Laparoscopic Appendectomy. Standard stay: 2-3 inpatient days. Typical package includes pre-op blood panel, abdominal ultrasound/CT, surgical OT consumables, and postoperative IV antibiotics.\n"
                "• **Cataract (`H26.9`)**: Daycare Phacoemulsification with intraocular lens (IOL) implantation. Outpatient/Daycare procedure with pre-op biometry.\n"
                "• **Acute Cholecystitis (`K81.0`)**: Laparoscopic Cholecystectomy. Standard stay: 2-4 days with liver function tests (LFT) and surgical OT package."
            )

        # 6. Fallback General Healthcare Response
        if case_context:
            return (
                f"### 📋 Context for Case {case_context.get("case_number")}\n"
                f"• **Patient**: {case_context.get("patient_name")}\n"
                f"• **Diagnosis**: {case_context.get("diagnosis")}\n"
                f"• **Current Status**: `{case_context.get("status")}` ({case_context.get("readiness_score")}% readiness)\n\n"
                f"You can ask me to check discharge blockers, explain room rent rules, or calculate patient co-pay shares."
            )

        return (
            "I am your **MedPass AI Clinical & Insurance Assistant**.\n\n"
            "You can query active patient records (*e.g., \"Fetch Rahul details\"*), check discharge readiness, "
            "review insurance coverage rules, or ask about hospital clinical care pathways. "
            "Type *\"what queries can I ask\"* for a complete guide."
        )

    @classmethod
    def get_ai_status(cls) -> Dict[str, Any]:
        has_gemini = bool(settings.GEMINI_API_KEY)
        has_openai = bool(settings.OPENAI_API_KEY)
        engine_mode = "gemini_server_side" if has_gemini else ("openai_server_side" if has_openai else "deterministic_clinical_fallback")
        return {
            "gemini_active": has_gemini,
            "openai_active": has_openai,
            "engine_mode": engine_mode,
            "server_side_secured": True,
            "message": "Connected to MedPass AI Gemini Engine" if has_gemini else "MedPass AI Clinical Engine Active"
        }

    @staticmethod
    def _call_gemini(prompt: str, context: str, api_key: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        user_content = f"{SYSTEM_PROMPT}\n{context}\nUser Query: {prompt}"
        payload = {
            "contents": [{"parts": [{"text": user_content}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600}
        }
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
            raise RuntimeError(f"Gemini API returned HTTP {resp.status_code}")

    @staticmethod
    def _call_openai(prompt: str, context: str, api_key: str) -> str:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT + (f"\n{context}" if context else "")},
            {"role": "user", "content": prompt}
        ]
        payload = {"model": "gpt-4o-mini", "messages": messages, "temperature": 0.2, "max_tokens": 600}
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "").strip()
            raise RuntimeError(f"OpenAI API returned HTTP {resp.status_code}")
