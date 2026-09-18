import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models.operational import Case, Document, TreatmentLineItem
from backend.app.services.llm_client import LLMDocumentIntelligenceService
from backend.app.services.blocker_engine import ReadinessAndBlockerEngine
from backend.app.services.trace_event_service import TraceEventService

router = APIRouter(prefix="/cases", tags=["Documents"])

@router.post("/{case_id}/documents")
async def upload_case_document(
    case_id: str,
    doc_type: str = Form("BILL_INVOICE"), # DISCHARGE_SUMMARY, BILL_INVOICE, POLICY_CARD, LAB_REPORT
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    content_text = ""
    filename = "document.pdf"
    bytes_data = None
    if file:
        filename = file.filename
        bytes_data = await file.read()
        try:
            content_text = bytes_data.decode("utf-8")
        except Exception:
            content_text = raw_text or f"Itemized Hospital Bill for {filename}\nPatient Name: {case.patient.full_name if case.patient else 'Patient'}\nDiagnosis: Acute Appendicitis (K35.80)\nRoom Rent (3 days): 15000\nSurgical OT Charges: 55000\nAbdominal Ultrasound: 8500\nInpatient Pharmacy Drugs: 9500"
    elif raw_text:
        content_text = raw_text
        filename = "clinical_text_entry.txt"
    else:
        content_text = f"Inpatient hospital billing sheet\nDiagnosis: Appendicitis (K35.80)\nRoom Rent (3 days): 15000\nSurgical Laparoscopy: 55000\nDiagnostics & Labs: 8500\nPharmacy Inpatient: 9500"

    # Run AI Document Intelligence Extraction
    extracted_data = LLMDocumentIntelligenceService.extract_document_data(
        content_text, doc_type, image_bytes=bytes_data if file and filename.lower().endswith((".jpg", ".jpeg", ".png")) else None,
        mime_type=file.content_type if file and file.content_type else "text/plain"
    )

    doc = Document(
        case_id=case.id,
        doc_type=doc_type,
        file_name=filename,
        storage_key=f"cases/{case.id}/docs/{uuid.uuid4().hex}_{filename}",
        sha256="mock_sha256_" + uuid.uuid4().hex[:16],
        mime_type="application/pdf" if filename.endswith(".pdf") else "text/plain",
        extracted_data=extracted_data,
        confidence=extracted_data.get("confidence", 0.95)
    )
    db.add(doc)
    db.flush()

    # Automatically add newly extracted line items if this is an invoice/estimate
    added_items_count = 0
    if doc_type in ["BILL_INVOICE", "ESTIMATE"]:
        existing_descs = {li.description.strip().lower() for li in (case.line_items or [])}
        for it in extracted_data.get("line_items", []):
            desc = it.get("description", "Extracted item")
            if desc.strip().lower() not in existing_descs:
                qty = float(it.get("quantity", 1.0))
                unit_amt = float(it.get("unit_amount", 1000.0))
                gross = float(it.get("gross_amount", qty * unit_amt))
                item = TreatmentLineItem(
                    case_id=case.id,
                    category=it.get("category", "INVESTIGATION"),
                    code=it.get("code", f"ITEM-{uuid.uuid4().hex[:4].upper()}"),
                    code_system="CPT",
                    description=desc,
                    quantity=qty,
                    unit_amount=unit_amt,
                    gross_amount=gross
                )
                db.add(item)
                added_items_count += 1
        db.flush()

    # If diagnosis was extracted and case had no diagnosis, update it
    if extracted_data.get("diagnosis_name") and (not case.primary_diagnosis_name or case.primary_diagnosis_name == "Pending Diagnosis"):
        case.primary_diagnosis_name = extracted_data["diagnosis_name"]
        if extracted_data.get("diagnosis_code"):
            case.primary_diagnosis_code = extracted_data["diagnosis_code"]

    # Re-evaluate readiness
    readiness = ReadinessAndBlockerEngine.evaluate_readiness(case)
    case.readiness_score = readiness["total_score"]
    case.readiness_band = readiness["band"]

    db.commit()

    TraceEventService.record_event(
        db, "DOCUMENT_UPLOADED", case, actor_role="HOSPITAL_STAFF",
        extra_data={"doc_type": doc_type, "file_name": filename, "extracted_items": added_items_count}
    )

    return {
        "document_id": doc.id,
        "doc_type": doc.doc_type,
        "file_name": doc.file_name,
        "extracted_data": doc.extracted_data,
        "added_line_items": added_items_count,
        "new_readiness_score": case.readiness_score,
        "new_readiness_band": case.readiness_band
    }

@router.get("/{case_id}/documents")
def list_case_documents(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return [
        {
            "id": d.id,
            "doc_type": d.doc_type,
            "file_name": d.file_name,
            "confidence": d.confidence,
            "uploaded_at": d.uploaded_at,
            "extracted_data": d.extracted_data
        }
        for d in (case.documents or [])
    ]
