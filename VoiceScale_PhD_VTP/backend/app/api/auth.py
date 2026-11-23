"""
VoiceCare PHC - Auth API (MongoDB)
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import jwt, JWTError

from app.core.config import get_settings
from app.db.database import users_col
from app.db.models import (
    SignupRequest, LoginRequest, TokenResponse, UserResponse,
    PasswordChangeRequest, ProfileUpdateRequest
)

router = APIRouter()
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login",
    auto_error=False
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def user_doc_to_response(doc: dict) -> UserResponse:
    return UserResponse(
        user_id=doc["user_id"],
        full_name=doc.get("full_name", ""),
        email=doc["email"],
        role=doc.get("role", "patient"),
        email_verified=doc.get("email_verified", False),
        created_at=doc.get("created_at"),
    )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await users_col().find_one({"user_id": user_id})
    if user is None:
        raise credentials_exception
    return user


async def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[dict]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    return await users_col().find_one({"user_id": user_id})


# ─── RBAC (Role-Based Access Control) ───────────────────────────────────────

async def get_current_user_role(token: str = Depends(oauth2_scheme)) -> dict:
    """Get current user with role verification."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await users_col().find_one({"user_id": user_id})
    if user is None:
        raise credentials_exception
    return user


def require_role(required_role: str):
    """Dependency factory to require specific role."""
    async def role_checker(current_user: dict = Depends(get_current_user_role)) -> dict:
        user_role = current_user.get("role", "patient")
        if user_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}"
            )
        return current_user
    return role_checker


def require_any_role(*allowed_roles: str):
    """Dependency factory to require any of the specified roles."""
    async def role_checker(current_user: dict = Depends(get_current_user_role)) -> dict:
        user_role = current_user.get("role", "patient")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required one of: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


# Role-specific dependencies
require_patient = require_role("patient")
require_doctor = require_role("doctor")
require_admin = require_role("admin")
require_doctor_or_admin = require_any_role("doctor", "admin")
require_admin_or_doctor_or_patient = require_any_role("admin", "doctor", "patient")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest):
    # Validate passwords match
    if request.password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Check duplicate email
    existing = await users_col().find_one({"email": request.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    user_doc = {
        "user_id": user_id,
        "full_name": request.full_name,
        "email": request.email.lower(),
        "password_hash": hash_password(request.password),
        "role": request.role.value,
        "email_verified": False,
        "created_at": datetime.utcnow(),
    }
    await users_col().insert_one(user_doc)

    user_response = user_doc_to_response(user_doc)
    access_token = create_access_token(data={"sub": user_id})
    return TokenResponse(access_token=access_token, user=user_response)


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 password flow — username field accepts email."""
    email = form_data.username.lower()
    user = await users_col().find_one({"email": email})
    if not user or not verify_password(form_data.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_response = user_doc_to_response(user)
    access_token = create_access_token(data={"sub": user["user_id"]})
    return TokenResponse(access_token=access_token, user=user_response)


@router.post("/login-json", response_model=TokenResponse)
async def login_json(request: LoginRequest):
    """JSON login endpoint."""
    email = request.email.lower()
    user = await users_col().find_one({"email": email})
    if not user or not verify_password(request.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    user_response = user_doc_to_response(user)
    access_token = create_access_token(data={"sub": user["user_id"]})
    return TokenResponse(access_token=access_token, user=user_response)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_doc_to_response(current_user)


@router.put("/me", response_model=UserResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    update_data = {}
    if request.full_name is not None:
        update_data["full_name"] = request.full_name

    if update_data:
        await users_col().update_one(
            {"user_id": current_user["user_id"]},
            {"$set": update_data}
        )
        current_user.update(update_data)

    return user_doc_to_response(current_user)


@router.post("/change-password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: dict = Depends(get_current_user)
):
    if not verify_password(request.current_password, current_user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    new_hash = hash_password(request.new_password)
    await users_col().update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"password_hash": new_hash}}
    )
    return {"message": "Password changed successfully"}
