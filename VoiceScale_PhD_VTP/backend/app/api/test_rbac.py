"""
VoiceCare PHC - RBAC Test Endpoints (for testing role protection)
"""
from fastapi import APIRouter, Depends
from app.api.auth import require_patient, require_doctor, require_admin, get_current_user_role

router = APIRouter()


@router.get("/test/public")
async def public_endpoint():
    """Public endpoint - no authentication required"""
    return {"message": "Public access granted", "endpoint": "public"}


@router.get("/test/authenticated")
async def authenticated_endpoint(current_user: dict = Depends(get_current_user_role)):
    """Authenticated endpoint - any role can access"""
    return {
        "message": "Authenticated access granted", 
        "user_id": current_user["user_id"],
        "role": current_user["role"]
    }


@router.get("/test/patient-only")
async def patient_endpoint(current_user: dict = Depends(require_patient)):
    """Patient-only endpoint"""
    return {
        "message": "Patient access granted",
        "user_id": current_user["user_id"],
        "role": current_user["role"]
    }


@router.get("/test/doctor-only")
async def doctor_endpoint(current_user: dict = Depends(require_doctor)):
    """Doctor-only endpoint"""
    return {
        "message": "Doctor access granted",
        "user_id": current_user["user_id"],
        "role": current_user["role"]
    }


@router.get("/test/admin-only")
async def admin_endpoint(current_user: dict = Depends(require_admin)):
    """Admin-only endpoint"""
    return {
        "message": "Admin access granted",
        "user_id": current_user["user_id"],
        "role": current_user["role"]
    }
