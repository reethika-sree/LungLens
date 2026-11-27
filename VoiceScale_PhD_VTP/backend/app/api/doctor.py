"""
VoiceCare PHC - Doctor Portal API
Reads real patient records from MongoDB patient_records collection.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.api.auth import require_doctor
from app.db.database import patient_records_col

router = APIRouter()

RISK_PRIORITY = {"high": "P1", "medium": "P2", "low": "P3"}
RISK_COLOR    = {"high": "#ef4444", "medium": "#f7bb4a", "low": "#3ee8a0"}

def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


@router.get("/doctor/queue")
async def get_patient_queue(current_user: dict = Depends(require_doctor)):
    """Live queue — all records with prediction, sorted by risk score desc."""
    docs = await patient_records_col().find(
        {"status": "prediction_complete"},
        sort=[("tb_risk_score", -1), ("created_at", 1)],
    ).to_list(length=100)

    queue = []
    for i, d in enumerate(docs):
        risk  = d.get("tb_risk_level", "low")
        score = d.get("tb_risk_score", 0)
        queue.append({
            "record_id":         d["record_id"],
            "patient_name":      d.get("patient_name", "Unknown"),
            "language":          d.get("language", ""),
            "tb_risk_level":     risk,
            "tb_risk_score":     score,
            "tb_confidence":     d.get("tb_confidence", 0),
            "priority":          RISK_PRIORITY.get(risk, "P3"),
            "risk_color":        RISK_COLOR.get(risk, "#8899b8"),
            "created_at":        d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else d.get("created_at", ""),
            "symptoms_positive": sum(
                1 for k, v in d.get("symptom_answers", {}).items()
                if v in ("yes", True, 1) or (k == "cough_weeks" and isinstance(v, (int, float)) and v > 0)
            ),
            "l2_referred":       d.get("l2_referred", False),
            # PDF info for queue badge
            "l2_pdf_name":       d.get("l2_pdf_name"),
            "l2_pdf_uploaded_at": d.get("l2_pdf_uploaded_at").isoformat() if isinstance(d.get("l2_pdf_uploaded_at"), datetime) else d.get("l2_pdf_uploaded_at"),
        })
    return {"queue": queue, "total": len(queue)}


@router.get("/doctor/patient/{record_id}")
async def get_patient_details(record_id: str, current_user: dict = Depends(require_doctor)):
    """Full patient record for doctor detail view — includes L2 PDF info."""
    doc = await patient_records_col().find_one({"record_id": record_id})
    if not doc:
        raise HTTPException(404, "Patient record not found")

    serialized = _serialize(doc)

    # Never send raw PDF base64 in the detail view (too large) — only send metadata.
    # Doctor can download via the dedicated endpoint below.
    if "l2_pdf_data" in serialized:
        del serialized["l2_pdf_data"]

    return serialized


@router.get("/doctor/patient/{record_id}/download-pdf")
async def download_l2_pdf(record_id: str, current_user: dict = Depends(require_doctor)):
    """Return base64 PDF data so doctor can download the L2 report."""
    doc = await patient_records_col().find_one(
        {"record_id": record_id},
        {"l2_pdf_data": 1, "l2_pdf_name": 1},
    )
    if not doc:
        raise HTTPException(404, "Patient record not found")
    if not doc.get("l2_pdf_data"):
        raise HTTPException(404, "No PDF uploaded for this patient")

    return {
        "pdf_data": doc["l2_pdf_data"],
        "pdf_name": doc.get("l2_pdf_name", "report.pdf"),
    }


@router.get("/doctor/stats")
async def get_doctor_stats(current_user: dict = Depends(require_doctor)):
    """Summary counts for doctor dashboard header."""
    total   = await patient_records_col().count_documents({})
    high    = await patient_records_col().count_documents({"tb_risk_level": "high"})
    medium  = await patient_records_col().count_documents({"tb_risk_level": "medium"})
    low     = await patient_records_col().count_documents({"tb_risk_level": "low"})
    pending = await patient_records_col().count_documents({"status": {"$ne": "prediction_complete"}})
    return {
        "total": total, "high_risk": high,
        "medium_risk": medium, "low_risk": low, "pending": pending,
    }


@router.post("/doctor/clinical-action")
async def save_clinical_action(data: dict, current_user: dict = Depends(require_doctor)):
    """Save doctor's clinical actions (tests ordered, referrals, notes)."""
    record_id = data.get("record_id")
    if record_id:
        await patient_records_col().update_one(
            {"record_id": record_id},
            {"$set": {"clinical_action": data, "updated_at": datetime.utcnow()}},
        )
    return {"status": "saved"}


# ─── L2 TB Detection Referral ─────────────────────────────────────────────────

class DoctorNotesRequest(BaseModel):
    notes: str


@router.post("/doctor/patient/{record_id}/notes")
async def save_doctor_notes(
    record_id: str,
    body: DoctorNotesRequest,
    current_user: dict = Depends(require_doctor),
):
    """Save doctor's clinical notes for a patient record."""
    doc = await patient_records_col().find_one({"record_id": record_id})
    if not doc:
        raise HTTPException(404, "Patient record not found")

    now = datetime.utcnow()
    await patient_records_col().update_one(
        {"record_id": record_id},
        {"$set": {
            "doctor_notes":    body.notes,
            "doctor_notes_by": current_user.get("full_name", current_user.get("user_id", "Doctor")),
            "doctor_notes_at": now,
            "updated_at":      now,
        }},
    )
    return {"success": True, "message": "Notes saved", "saved_at": now.isoformat()}


class L2ReferralRequest(BaseModel):
    notes: Optional[str] = ""


@router.post("/doctor/refer-l2/{record_id}")
async def refer_patient_to_l2(
    record_id: str,
    body: L2ReferralRequest,
    current_user: dict = Depends(require_doctor),
):
    """
    Doctor refers a patient to L2 TB Detection.
    Sets l2_referred=True on the patient record so it shows up in PatientProfilePage.
    """
    doc = await patient_records_col().find_one({"record_id": record_id})
    if not doc:
        raise HTTPException(404, "Patient record not found")

    referred_at  = datetime.utcnow()
    referred_by  = current_user.get("full_name", current_user.get("user_id", "Doctor"))

    await patient_records_col().update_one(
        {"record_id": record_id},
        {"$set": {
            "l2_referred":       True,
            "l2_referred_at":    referred_at,
            "l2_referred_by":    referred_by,
            "l2_referral_notes": body.notes or "",
            "updated_at":        referred_at,
        }},
    )
    return {
        "success":       True,
        "record_id":     record_id,
        "message":       "Patient referred to L2 TB Detection",
        "l2_referred_at": referred_at.isoformat(),
    }