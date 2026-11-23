"""
VoiceCare PHC - Pydantic Models for MongoDB
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    PATIENT = "patient"
    DOCTOR  = "doctor"
    ADMIN   = "admin"
    ASHA    = "asha"


class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str
    role: UserRole = UserRole.PATIENT

    model_config = {"json_schema_extra": {"example": {
        "full_name": "Lakshmi Devi",
        "email": "lakshmi.asha@nrhm.gov.in",
        "password": "secure123",
        "confirm_password": "secure123",
        "role": "asha"
    }}}


class LoginRequest(BaseModel):
    email: str
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class UserResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    email_verified: bool
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
