"""
VoiceCare PHC - Patient Portal API
Stores: voice capture text, symptom answers, TB prediction → MongoDB patient_records
Also exposes: my-checkins (real DOTS adherence data)
"""
import uuid
import base64
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.auth import require_patient
from app.db.database import patient_records_col, dots_checkins_col
from app.agents.asha_agent import DOTSAgent

router = APIRouter()
_dots_agent = DOTSAgent()


# ─── Models ────────────────────────────────────────────────────────────────────
class VoiceCaptureRequest(BaseModel):
    language:         str
    voice_transcript: str


class SymptomAnswers(BaseModel):
    coughPhlegm:      Optional[str] = ""
    coughingBlood:    Optional[str] = ""
    sputumBlood:      Optional[str] = ""
    shortnessBreath:  Optional[str] = ""
    fever:            Optional[str] = ""
    nightSweats:      Optional[str] = ""
    weightLoss:       Optional[str] = ""
    tiredBody:        Optional[str] = ""
    chestPain:        Optional[str] = ""
    backPain:         Optional[str] = ""
    swollenLymph:     Optional[str] = ""
    lumpsArmpitsNeck: Optional[str] = ""
    lossAppetite:     Optional[str] = ""


class TBPredictionRequest(BaseModel):
    record_id:   str
    risk:        str
    confidence:  float
    risk_score:  int
    explanation: list[str]


class L2PDFUploadRequest(BaseModel):
    patient_id:  str
    pdf_data:    str   # base64-encoded PDF
    pdf_name:    str   # original filename shown in UI
    report_type: Optional[str] = "patient_upload"


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


# ─── Routes ───────────────────────────────────────────────────────────────────
@router.get("/patient/profile")
async def get_patient_profile(current_user: dict = Depends(require_patient)):
    return {
        "user_id":   current_user["user_id"],
        "full_name": current_user.get("full_name"),
        "role":      current_user["role"],
    }


@router.post("/patient/voice-intake")
async def submit_voice_intake(
    body: VoiceCaptureRequest,
    current_user: dict = Depends(require_patient),
):
    """Step 1 — save voice transcript. Returns record_id."""
    record_id = str(uuid.uuid4())
    doc = {
        "record_id":       record_id,
        "user_id":         current_user["user_id"],
        "patient_name":    current_user.get("full_name", ""),
        "language":        body.language,
        "voice_transcript": body.voice_transcript,
        "symptom_answers": {},
        "tb_risk_level":   None,
        "tb_risk_score":   None,
        "tb_confidence":   None,
        "tb_explanation":  [],
        "status":          "voice_captured",
        "created_at":      datetime.utcnow(),
        "updated_at":      datetime.utcnow(),
    }
    await patient_records_col().insert_one(doc)
    return {"record_id": record_id, "status": "voice_captured"}


@router.post("/patient/symptom-answers")
async def submit_symptom_answers(
    body: SymptomAnswers,
    current_user: dict = Depends(require_patient),
):
    """Step 2 — save symptom questionnaire."""
    # Find most recent pending record for this user
    existing = await patient_records_col().find_one(
        {"user_id": current_user["user_id"], "status": {"$in": ["voice_captured", "pending"]}},
        sort=[("created_at", -1)],
    )

    answers = body.model_dump()

    if existing:
        await patient_records_col().update_one(
            {"record_id": existing["record_id"]},
            {"$set": {"symptom_answers": answers, "status": "pending", "updated_at": datetime.utcnow()}},
        )
        return {"record_id": existing["record_id"], "status": "pending"}

    # No existing record — create a fresh one
    record_id = str(uuid.uuid4())
    doc = {
        "record_id":       record_id,
        "user_id":         current_user["user_id"],
        "patient_name":    current_user.get("full_name", ""),
        "language":        "English",
        "voice_transcript": "",
        "symptom_answers": answers,
        "tb_risk_level":   None,
        "tb_risk_score":   None,
        "tb_confidence":   None,
        "tb_explanation":  [],
        "status":          "pending",
        "created_at":      datetime.utcnow(),
        "updated_at":      datetime.utcnow(),
    }
    await patient_records_col().insert_one(doc)
    return {"record_id": record_id, "status": "pending"}


@router.post("/patient/tb-prediction")
async def save_tb_prediction(
    body: TBPredictionRequest,
    current_user: dict = Depends(require_patient),
):
    """Step 3 — save ML prediction result."""
    priority_map = {"high": "P1", "medium": "P2", "low": "P3"}
    await patient_records_col().update_one(
        {"record_id": body.record_id, "user_id": current_user["user_id"]},
        {"$set": {
            "tb_risk_level":  body.risk,
            "tb_risk_score":  body.risk_score,
            "tb_confidence":  body.confidence,
            "tb_explanation": body.explanation,
            "priority":       priority_map.get(body.risk, "P3"),
            "status":         "prediction_complete",
            "updated_at":     datetime.utcnow(),
        }},
    )
    return {"status": "saved"}


@router.get("/patient/my-records")
async def get_my_records(current_user: dict = Depends(require_patient)):
    docs = await patient_records_col().find(
        {"user_id": current_user["user_id"]},
        sort=[("created_at", -1)],
    ).to_list(length=50)
    return [_serialize(d) for d in docs]


@router.get("/patient/my-checkins")
async def get_my_checkins(
    days: int = 30,
    current_user: dict = Depends(require_patient),
):
    since = datetime.utcnow() - timedelta(days=days)
    checkins_raw = await dots_checkins_col().find(
        {"patient_user_id": current_user["user_id"], "date": {"$gte": since.strftime("%Y-%m-%d")}},
        sort=[("date", -1)],
    ).to_list(length=days + 5)

    checkins = [{k: v for k, v in c.items() if k != "_id"} for c in checkins_raw]

    # Build 30-day grid
    grid = []
    for i in range(days):
        d = (datetime.utcnow() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        match = next((c for c in checkins if c.get("date") == d), None)
        grid.append({
            "date":  d,
            "taken": match["taken"] if match else None,
            "note":  match.get("note", "") if match else "",
        })

    # Compute real adherence stats
    stats = _dots_agent.compute_adherence_stats(checkins)

    return {
        "grid":      grid,
        "checkins":  checkins,
        "stats":     stats,
        "days":      days,
    }


@router.get("/patient/l2-status")
async def get_l2_status(current_user: dict = Depends(require_patient)):
    """Check if patient has been referred to L2 TB Detection."""
    # Search ALL records for this user where l2_referred is True
    my_record = await patient_records_col().find_one(
        {"user_id": current_user["user_id"], "l2_referred": True},
        sort=[("created_at", -1)],
    )
    if not my_record:
        return {"l2_referred": False, "l2_status": "not_referred"}

    return {
        "l2_referred":       my_record.get("l2_referred", False),
        "l2_referred_at":    my_record.get("l2_referred_at"),
        "l2_referred_by":    my_record.get("l2_referred_by"),
        "l2_referral_notes": my_record.get("l2_referral_notes", ""),
        "l2_status":         "referred",
        # PDF info if uploaded
        "l2_pdf_name":       my_record.get("l2_pdf_name"),
        "l2_pdf_uploaded_at": my_record.get("l2_pdf_uploaded_at"),
    }


@router.get("/patient/queue-status")
async def get_queue_status(current_user: dict = Depends(require_patient)):
    """Live queue position for the patient."""
    my_record = await patient_records_col().find_one(
        {"user_id": current_user["user_id"], "status": "prediction_complete"},
        sort=[("created_at", -1)],
    )
    if not my_record:
        return {"in_queue": False}

    my_score = my_record.get("tb_risk_score", 0)
    ahead = await patient_records_col().count_documents({
        "status": "prediction_complete",
        "tb_risk_score": {"$gt": my_score},
    })
    return {
        "in_queue":    True,
        "position":    ahead + 1,
        "risk_score":  my_score,
        "priority":    my_record.get("priority", "P3"),
    }


# ─── L2 PDF Upload ─────────────────────────────────────────────────────────────
@router.post("/patient/upload-l2-pdf")
async def upload_l2_pdf(
    body: L2PDFUploadRequest,
    current_user: dict = Depends(require_patient),
):
    """
    Patient uploads their L2 TB Detection PDF report.
    Stores base64 PDF + filename on the most recent l2_referred record.
    Doctor can then see it on the patient detail page.
    """
    # Validate base64
    try:
        pdf_bytes = base64.b64decode(body.pdf_data)
        if len(pdf_bytes) < 100:
            raise HTTPException(400, "PDF data appears to be invalid or too small")
    except Exception:
        raise HTTPException(400, "Invalid base64 PDF data")

    # Find the record that was referred to L2
    record = await patient_records_col().find_one(
        {"user_id": current_user["user_id"], "l2_referred": True},
        sort=[("created_at", -1)],
    )

    if not record:
        raise HTTPException(404, "No L2 referral found for this patient")

    await patient_records_col().update_one(
        {"record_id": record["record_id"]},
        {"$set": {
            "l2_pdf_data":        body.pdf_data,      # base64 string stored in DB
            "l2_pdf_name":        body.pdf_name,       # original filename
            "l2_pdf_uploaded_at": datetime.utcnow(),
            "l2_pdf_size_kb":     round(len(pdf_bytes) / 1024, 1),
            "updated_at":         datetime.utcnow(),
        }},
    )

    return {
        "success":     True,
        "record_id":   record["record_id"],
        "pdf_name":    body.pdf_name,
        "size_kb":     round(len(pdf_bytes) / 1024, 1),
        "uploaded_at": datetime.utcnow().isoformat(),
    }