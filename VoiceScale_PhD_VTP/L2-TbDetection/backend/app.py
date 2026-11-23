"""
TB Detection System - FastAPI Main Application
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
import numpy as np
import os
import base64
from datetime import datetime

from chest_xray.inference import predict_xray
from blood_test.inference import predict_blood
from lab_test.logic import predict_lab
from fusion.combine import predict_final

app = FastAPI(
    title="TB Detection System API",
    description="Modular AI-powered Tuberculosis Detection API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Models ──────────────────────────────────────────────────────────

class BloodTestInput(BaseModel):
    hemoglobin: float
    wbc_count: float
    esr: float
    crp: float


class LabTestInput(BaseModel):
    genexpert_result: str          # "positive" | "negative"
    rifampicin_resistance: str     # "yes" | "no"


class FinalPredictionInput(BaseModel):
    xray_prob: Optional[float] = None
    blood_prob: Optional[float] = None
    lab_result: Optional[bool] = None


class PDFReportInput(BaseModel):
    patient_id: str
    pdf_data: str  # base64 encoded PDF
    report_type: str = "l2_complete"  # l2_complete, xray_only, blood_only, etc.


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "TB Detection API is running"}


@app.post("/predict/xray")
async def xray_prediction(file: UploadFile = File(...)):
    """
    Accepts a chest X-ray image (JPEG/PNG) and returns TB probability.
    """
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
            "message": result["message"]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"X-ray inference failed: {str(e)}")


@app.post("/predict/blood")
async def blood_prediction(data: BloodTestInput):
    """
    Accepts blood test values and returns TB probability.
    """
    try:
        result = predict_blood(
            hemoglobin=data.hemoglobin,
            wbc_count=data.wbc_count,
            esr=data.esr,
            crp=data.crp
        )
        return JSONResponse(content={
            "module": "blood_test",
            "tb_positive": result["tb_positive"],
            "confidence": result["confidence"],
            "probability": result["probability"],
            "message": result["message"]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blood test inference failed: {str(e)}")


@app.post("/predict/lab")
async def lab_prediction(data: LabTestInput):
    """
    Accepts GeneXpert result and rifampicin resistance flag.
    Returns rule-based TB determination.
    """
    try:
        result = predict_lab(
            genexpert_result=data.genexpert_result.lower(),
            rifampicin_resistance=data.rifampicin_resistance.lower()
        )
        return JSONResponse(content={
            "module": "lab_test",
            "tb_positive": result["tb_positive"],
            "confidence": result["confidence"],
            "rifampicin_resistant": result["rifampicin_resistant"],
            "message": result["message"]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lab test inference failed: {str(e)}")


@app.post("/predict/final")
async def final_prediction(data: FinalPredictionInput):
    """
    Combines available module outputs into a final fused TB prediction.
    """
    try:
        result = predict_final(
            xray_prob=data.xray_prob,
            blood_prob=data.blood_prob,
            lab_result=data.lab_result
        )
        return JSONResponse(content={
            "module": "fusion",
            "tb_positive": result["tb_positive"],
            "confidence": result["confidence"],
            "probability": result["probability"],
            "risk_level": result["risk_level"],
            "recommendation": result["recommendation"],
            "contributing_factors": result["contributing_factors"]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Final prediction failed: {str(e)}")


# ── PDF Report Upload ───────────────────────────────────────────────────

@app.post("/upload-pdf-report")
async def upload_pdf_report(data: PDFReportInput):
    """
    Accepts PDF report (base64 encoded) and stores it in database.
    Links to patient record via patient_id.
    """
    try:
        # Decode base64 PDF data
        pdf_bytes = base64.b64decode(data.pdf_data)
        
        # Store PDF report (simple file-based storage for now)
        pdf_filename = f"l2_report_{data.patient_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        pdf_path = os.path.join("reports", pdf_filename)
        
        # Create reports directory if it doesn't exist
        os.makedirs("reports", exist_ok=True)
        
        # Save PDF to file
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        
        return JSONResponse(content={
            "success": True,
            "patient_id": data.patient_id,
            "report_type": data.report_type,
            "pdf_filename": pdf_filename,
            "pdf_path": pdf_path,
            "message": "PDF report uploaded successfully",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF upload failed: {str(e)}")


@app.get("/get-pdf-reports/{patient_id}")
async def get_pdf_reports(patient_id: str):
    """
    Retrieve all PDF reports for a specific patient.
    Used by admin dashboard to show uploaded reports.
    """
    try:
        reports_dir = "reports"
        if not os.path.exists(reports_dir):
            return JSONResponse(content={"reports": [], "patient_id": patient_id})
        
        # Find all PDF reports for this patient
        patient_reports = []
        for filename in os.listdir(reports_dir):
            if filename.startswith(f"l2_report_{patient_id}_") and filename.endswith(".pdf"):
                file_path = os.path.join(reports_dir, filename)
                # Get file creation time
                file_time = datetime.fromtimestamp(os.path.getctime(file_path))
                patient_reports.append({
                    "filename": filename,
                    "path": file_path,
                    "upload_time": file_time.isoformat(),
                    "size": os.path.getsize(file_path)
                })
        
        # Sort by upload time (newest first)
        patient_reports.sort(key=lambda x: x["upload_time"], reverse=True)
        
        return JSONResponse(content={
            "reports": patient_reports,
            "patient_id": patient_id,
            "count": len(patient_reports)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve reports: {str(e)}")


# ── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
