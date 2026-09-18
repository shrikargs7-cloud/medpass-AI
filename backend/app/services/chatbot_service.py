import re
import json
import logging
from typing import Dict, Any, List, Optional
import httpx

from backend.app.config import settings

logger = logging.getLogger("medpass_chatbot")

# 1. Allowed healthcare and insurance keywords & topics
HEALTHCARE_KEYWORDS = [
    # Clinical & Medical
    "health", "hospital", "patient", "doctor", "nurse", "physician", "clinic",
    "disease", "diagnosis", "symptom", "illness", "infection", "appendicitis",
    "cardiac", "heart", "coronary", "infarction", "knee", "arthritis", "cholecystitis",
    "gallbladder", "fever", "pain", "surgery", "operation", "ot", "laparoscopic",
    "procedure", "medication", "medicine", "drug", "pharmacy", "prescription",
    "lab", "investigation", "blood", "imaging", "x-ray", "mri", "ct scan", "ultrasound",
    "icd", "cpt", "vital", "treatment", "care plan",
    # Operational & Administrative
    "roster", "bed", "ward", "icu", "admit", "admission", "discharge", "readiness",
    "blocker", "stuck", "pending", "status", "summary", "record",
    # Insurance & Financial
    "insurance", "policy", "tpa", "insurer", "payer", "cashless", "claim", "claims",
    "preauth", "pre-auth", "authorization", "coverage", "covered", "payable",
    "deductible", "co-pay", "copay", "room rent", "cap", "sub-limit", "sublimit",
    "waiting period", "exclusion", "settlement", "bill", "invoice", "tariff",
    # System & Governance
    "medpass", "nhcx", "abdm", "fhir", "privacy", "anonymization", "dataset",
    "lineage", "audit", "trace"
]

# 2. Strict Off-Topic Disallowed Patterns
OFF_TOPIC_PATTERNS = [
    r"\b(write|create|code|debug|fix)\s+(python|javascript|java|c\+\+|html|css|script|program|app|function|loop)\b",
    r"\b(weather|forecast|rain|temperature|sunny|cloudy|monsoon)\b",
    r"\b(cricket|football|soccer|ipl|world cup|messi|ronaldo|nba|match score)\b",
    r"\b(movie|cinema|actor|actress|hollywood|bollywood|netflix|song|music|album)\b",
    r"\b(recipe|cook|bake|restaurant|dish|food recipe|curry|cake|pizza|burger)\b",
    r"\b(politics|election|president|prime minister|parliament|bjp|congress|democrat|republican)\b",
    r"\b(stock market|crypto|bitcoin|ethereum|forex trading|invest in stocks)\b",
    r"\b(joke|riddle|game|gaming|playstation|xbox|video game)\b",
    r"\b(dating|girlfriend|boyfriend|love advice|horoscope|zodiac|astrology)\b"
]

STRICT_GUARDRAIL_REFUSAL = (
    "I am the MedPass AI Healthcare Assistant. I am strictly bounded to healthcare, "
    "hospital workflows, clinical care plans, insurance policies, claims adjudication, "
    "and discharge readiness. Please ask a question related to these topics."
)

SYSTEM_PROMPT = """You are MedPass AI Assistant, a concise and specialized healthcare and health-insurance assistant.

YOUR BOUNDARIES AND RULES:
1. TOPIC RESTRICTION: You ONLY answer questions strictly regarding:
   - Medical conditions, clinical treatments, surgeries, medications, and diagnoses.
   - Hospital admissions, bed allocation, patient care protocols, and discharge readiness.
   - Health insurance coverage, policy clauses, room rent caps, deductibles, co-pays, and pre-authorization.
   - Medical bill line items, claim adjudication, and discharge blockers.
   - MedPass AI features and health data privacy.
2. STRICT REFUSAL: If the user asks about ANYTHING outside these topics (e.g. coding, sports, weather, politics, recipes, pop culture, general trivia), you MUST decline immediately with:
   "I am the MedPass AI Healthcare Assistant. I am strictly bounded to healthcare, hospital workflows, clinical care plans, insurance policies, claims adjudication, and discharge readiness. Please ask a question related to these topics."
3. CONCISENESS: Answer ONLY what is necessary. Avoid lengthy fluff or speculative advice. Keep answers direct, accurate, and professional (under 3 paragraphs or crisp bullet points).
4. CASE AWARENESS: If patient/case context is provided, use those exact figures, diagnosis, and policy parameters.
"""

class ChatbotService:
    @staticmethod
    def is_topic_allowed(prompt: str) -> bool:
        """
        Determines whether the user's prompt is within the healthcare / MedPass domain.
        """
        p_clean = prompt.strip().lower()
        if not p_clean:
            return True

        # Check explicit disallowed patterns first
        for pat in OFF_TOPIC_PATTERNS:
            if re.search(pat, p_clean):
                return False

        # If it contains any known healthcare/insurance domain term, it's allowed
        for kw in HEALTHCARE_KEYWORDS:
            if kw in p_clean:
                return True

        # Common conversational greetings are allowed
        if p_clean in ["hello", "hi", "hey", "good morning", "good evening", "help", "who are you", "what can you do"]:
            return True

        # Short vague queries with no healthcare relevance are rejected
        return False

    @classmethod
    def answer_query(
        cls,
        prompt: str,
        case_context: Optional[Dict[str, Any]] = None,
        custom_api_key: Optional[str] = None,
        provider: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main query handler. Enforces topic bounds, executes LLM call if API key is present,
        or falls back to domain-bounded deterministic response engine.
        """
        prompt_trimmed = prompt.strip()

        # Step 1: Strict Domain Guardrail Check
        if not cls.is_topic_allowed(prompt_trimmed):
            return {
                "reply": STRICT_GUARDRAIL_REFUSAL,
                "bounded": True,
                "status": "OFF_TOPIC_REJECTED",
                "provider": "guardrail"
            }

        # Step 2: Determine available API key and provider
        api_key = custom_api_key or settings.GEMINI_API_KEY or settings.OPENAI_API_KEY
        active_provider = provider

        if not active_provider:
            if custom_api_key:
                active_provider = "openai" if custom_api_key.startswith("sk-") else "gemini"
            elif settings.GEMINI_API_KEY:
                active_provider = "gemini"
            elif settings.OPENAI_API_KEY:
                active_provider = "openai"

        # Prepare context string if a case is active
        context_str = ""
        if case_context:
            context_str = (
                f"\nACTIVE CASE CONTEXT:\n"
                f"- Case Number: {case_context.get('case_number', 'N/A')}\n"
                f"- Patient: {case_context.get('patient_name', 'N/A')}\n"
                f"- Diagnosis: {case_context.get('diagnosis', 'N/A')}\n"
                f"- Status: {case_context.get('status', 'N/A')}\n"
                f"- Readiness Score: {case_context.get('readiness_score', 'N/A')}%\n"
                f"- Active Blockers: {case_context.get('blockers_summary', 'None')}\n"
                f"- Total Billed: ₹{case_context.get('total_gross', 0):,.2f}\n"
                f"- Covered: ₹{case_context.get('total_covered', 0):,.2f}\n"
                f"- Patient Payable: ₹{case_context.get('total_patient_payable', 0):,.2f}\n"
            )

        # Step 3: Try Live LLM (Gemini or OpenAI) if API key is present
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
                logger.warning(f"Gemini call failed: {e}. Falling back to deterministic engine.")

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
                logger.warning(f"OpenAI call failed: {e}. Falling back to deterministic engine.")

        # Step 4: Deterministic Domain-Bounded Response Engine (Zero External Dependency Fallback)
        reply = cls._deterministic_bounded_answer(prompt_trimmed, case_context)
        return {
            "reply": reply,
            "bounded": True,
            "status": "SUCCESS",
            "provider": "deterministic_engine"
        }

    @classmethod
    def get_ai_status(cls) -> Dict[str, Any]:
        """Returns server-side status of AI integrations without exposing secrets."""
        has_gemini = bool(settings.GEMINI_API_KEY)
        has_openai = bool(settings.OPENAI_API_KEY)
        engine_mode = "gemini_server_side" if has_gemini else ("openai_server_side" if has_openai else "deterministic_clinical_fallback")
        return {
            "gemini_active": has_gemini,
            "openai_active": has_openai,
            "engine_mode": engine_mode,
            "topic_boundary": "STRICT_HEALTHCARE_CLAIMS_ONLY",
            "server_side_secured": True,
            "message": "Connected to MedPass AI Gemini Engine (Secure Server-Side)" if has_gemini else "MedPass AI Clinical Engine Active (Deterministic Domain Guarded)"
        }

    @staticmethod
    def _call_gemini(prompt: str, context: str, api_key: str) -> str:
        """Calls Google Gemini REST API using httpx."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        user_content = f"{SYSTEM_PROMPT}\n{context}\nUser Query: {prompt}"
        payload = {
            "contents": [
                {
                    "parts": [{"text": user_content}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 600
            }
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
            raise RuntimeError(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")

    @staticmethod
    def _call_openai(prompt: str, context: str, api_key: str) -> str:
        """Calls OpenAI Chat Completion REST API using httpx."""
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT + (f"\n{context}" if context else "")},
            {"role": "user", "content": prompt}
        ]
        payload = {
            "model": "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 600
        }
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "").strip()
            raise RuntimeError(f"OpenAI API returned HTTP {resp.status_code}: {resp.text}")

    @staticmethod
    def _deterministic_bounded_answer(prompt: str, case_context: Optional[Dict[str, Any]]) -> str:
        """
        High-precision deterministic answers for healthcare and insurance queries.
        Used offline or when external LLM keys are unconfigured.
        """
        p = prompt.lower()

        # 1. Greetings
        if any(w in p for w in ["hello", "hi", "hey", "who are you", "what can you do", "help"]):
            return (
                "Hello! I am MedPass AI Assistant. I can assist you with:\n"
                "• Hospital admissions, bed allocation, and patient care protocols\n"
                "• Diagnosis and clinical treatment verification (ICD-10 codes)\n"
                "• Health insurance coverage breakdown, room rent caps, and deductibles\n"
                "• Discharge readiness scoring and resolving discharge blockers\n\n"
                "How can I help you with your active case or policy query?"
            )

        # 2. Blockers
        if any(w in p for w in ["blocker", "blocked", "stuck", "prevent discharge", "why pending"]):
            if case_context:
                blockers = case_context.get("blockers", [])
                if blockers:
                    b_list = "\n".join([f"• [{b.get('severity', 'HIGH')}] {b.get('type')}: {b.get('description')} (Action: {b.get('action_required', 'Resolve')})" for b in blockers])
                    return f"Active Discharge Blockers for Case {case_context.get('case_number')}:\n{b_list}"
                return f"Case {case_context.get('case_number')} has no active blockers. Current readiness score is {case_context.get('readiness_score')}%, ready for discharge."
            return "Please select an active patient case to view its specific discharge blockers and recommended remediation actions."

        # 3. Room Rent & Policy Deductions
        if any(w in p for w in ["room", "cap", "deductible", "copay", "co-pay", "payable", "deduction"]):
            if case_context and case_context.get("total_gross"):
                return (
                    f"Financial Breakdown for Case {case_context.get('case_number')}:\n"
                    f"• Total Gross Billed: ₹{case_context.get('total_gross'):,.2f}\n"
                    f"• Insurer Covered: ₹{case_context.get('total_covered'):,.2f}\n"
                    f"• Patient Payable: ₹{case_context.get('total_patient_payable'):,.2f}\n\n"
                    f"Clause 3.2 Room Rent Rule: Daily room rent exceeding policy sub-limit is patient-payable along with proportionate deduction. Co-pay applies per policy terms."
                )
            return (
                "Policy Room Rent Rules:\n"
                "Under standard health policies, room rent is capped (typically 1% of Sum Insured for normal room or 2% for ICU per day). "
                "Any tariff above this cap triggers proportionate deductions on associated surgical and nursing charges, which must be paid by the patient."
            )

        # 4. Coverage and Pre-Auth
        if any(w in p for w in ["coverage", "preauth", "pre-auth", "claim", "adjudication", "cashless"]):
            if case_context:
                return (
                    f"Coverage Summary for Case {case_context.get('case_number')}:\n"
                    f"• Patient: {case_context.get('patient_name')}\n"
                    f"• Diagnosis: {case_context.get('diagnosis')}\n"
                    f"• Readiness Score: {case_context.get('readiness_score')}%\n"
                    f"• Authorization Status: {case_context.get('status')}\n"
                    f"• Line Items Approved: Billed treatments have been evaluated under the policy tariff."
                )
            return (
                "Cashless Pre-Authorization:\n"
                "Pre-authorizations are verified against the patient's policy active sum insured, waiting periods for specific illnesses, "
                "and hospital network status. Once verified, initial authorization is issued within the IRDAI 45-minute SLA."
            )

        # 5. Clinical treatment and diseases
        if any(w in p for w in ["appendicitis", "surgery", "laparoscopic", "cholecystitis", "treatment", "procedure", "medicine"]):
            return (
                "Clinical Protocol Summary:\n"
                "• Appendicitis (ICD-10: K35.80): Standard treatment is Laparoscopic Appendectomy with 2-3 days inpatient stay, pre-op panels, and IV antibiotic coverage.\n"
                "• Cholecystitis (ICD-10: K81.0): Laparoscopic Cholecystectomy with ultrasound imaging and liver panel tests.\n"
                "All procedures are itemized into room rent, OT surgical fee, pharmacy, and diagnostics."
            )

        # 6. Default Healthcare Response
        if case_context:
            return (
                f"Case {case_context.get('case_number')} ({case_context.get('patient_name')}):\n"
                f"• Diagnosis: {case_context.get('diagnosis')}\n"
                f"• Status: {case_context.get('status')}\n"
                f"• Readiness: {case_context.get('readiness_score')}%\n"
                f"You can ask me about discharge blockers, coverage calculations, or room rent deductions."
            )

        return (
            "I am ready to assist with healthcare, hospital admissions, clinical treatments, insurance policies, "
            "and discharge workflows. Please specify your question or select an active case."
        )
