"""
LungLens — L2 TB Detection Unified API Router
Mounts Chest X-ray (DenseNet121), Blood Test (XGBoost), GeneXpert Lab, and Weighted Fusion
directly inside the main LungLens backend under /api/v1/l2.
"""

import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Add L2-TbDetection backend package root to sys.path so existing ML modules load cleanly
_L2_BACKEND_DIR = Path(__file__).resolve().parents[3] / "L2-TbDetection" / "backend"
if str(_L2_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_L2_BACKEND_DIR))

from chest_xray.inference import predict_xray  # noqa: E402
from blood_test.inference import predict_blood  # noqa: E402
from lab_test.logic import predict_lab  # noqa: E402
from fusion.combine import predict_final  # noqa: E402

router = APIRouter()


class BloodTestInput(BaseModel):
    hemoglobin: float
    wbc_count: float
    esr: float
    crp: float


class LabTestInput(BaseModel):
    genexpert_result: str
    rifampicin_resistance: str


class FinalPredictionInput(BaseModel):
    xray_prob: Optional[float] = None
    blood_prob: Optional[float] = None
    lab_result: Optional[bool] = None


@router.get("/health")
async def l2_health_check():
    return {"status": "ok", "service": "LungLens L2 TB Detection"}


@router.post("/predict/xray")
async def l2_xray_prediction(file: UploadFile = File(...)):
    """Analyze chest X-ray image (JPG/PNG) for pulmonary TB markers."""
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Only JPG/PNG images accepted.")

    try:
        contents = await file.read()
        result = predict_xray(contents)
        return JSONResponse(content={
            "module": "chest_xray",
            "tb_positive": result["tb_positive"],
            "confidence": result["confidence"],
            "probability": result["probability"],
            "message": result["message"],
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"X-ray inference failed: {str(e)}")


@router.post("/predict/blood")
async def l2_blood_prediction(data: BloodTestInput):
    """Evaluate CBC and inflammatory blood markers (Hb, WBC, ESR, CRP)."""
    try:
        result = predict_blood(
            hemoglobin=data.hemoglobin,
            wbc_count=data.wbc_count,
            esr=data.esr,
            crp=data.crp,
        )
        return JSONResponse(content={
            "module": "blood_test",
            "tb_positive": result["tb_positive"],
            "confidence": result["confidence"],
            "probability": result["probability"],
            "message": result["message"],
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blood test inference failed: {str(e)}")


@router.post("/predict/lab")
async def l2_lab_prediction(data: LabTestInput):
    """Interpret GeneXpert MTB/RIF and Rifampicin resistance test results."""
    try:
        result = predict_lab(
            genexpert_result=data.genexpert_result.lower(),
            rifampicin_resistance=data.rifampicin_resistance.lower(),
        )
        return JSONResponse(content={
            "module": "lab_test",
            "tb_positive": result["tb_positive"],
            "confidence": result["confidence"],
            "rifampicin_resistant": result["rifampicin_resistant"],
            "message": result["message"],
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lab test inference failed: {str(e)}")


@router.post("/predict/final")
async def l2_final_prediction(data: FinalPredictionInput):
    """Fuse available L2 module results into a final TB determination."""
    try:
        result = predict_final(
            xray_prob=data.xray_prob,
            blood_prob=data.blood_prob,
            lab_result=data.lab_result,
        )
        return JSONResponse(content={
            "module": "fusion",
            "tb_positive": result["tb_positive"],
            "confidence": result["confidence"],
            "probability": result["probability"],
            "risk_level": result["risk_level"],
            "recommendation": result["recommendation"],
            "contributing_factors": result["contributing_factors"],
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Final prediction failed: {str(e)}")
