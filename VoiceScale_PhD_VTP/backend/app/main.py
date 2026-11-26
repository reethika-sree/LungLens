"""
VoiceCare PHC - Main FastAPI Application
"""
import logging
import logging.config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.db.database import connect_db, close_db, is_db_connected
from app.api import auth, patient, doctor, admin, test_rbac, asha, voice, chat

settings = get_settings()

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
# Silence noisy third-party loggers but keep ours verbose
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("multipart").setLevel(logging.WARNING)
logging.getLogger("voicecare").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    version="3.0.0",
    description="LungLens — AI-powered TB triage | 4 roles: Patient · Doctor · Admin · ASHA",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# The browser only ever talks to THIS FastAPI server.
# FastAPI proxies voice requests to the Colab/ngrok endpoint server-side,
# so the browser never touches ngrok and CORS on ngrok is irrelevant.
_CORS_ORIGINS = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",
    "http://localhost:4173",   # Vite preview
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
]

# Also read CORS_ORIGINS from env (comma-separated) for prod deploys
import os as _os
_extra = _os.getenv("CORS_ORIGINS", "")
if _extra:
    _CORS_ORIGINS += [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_origin_regex=r"https?://localhost:\d+",  # catch any localhost port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router,     prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Auth"])
app.include_router(patient.router,  prefix=f"{settings.API_V1_PREFIX}",      tags=["Patient"])
app.include_router(doctor.router,   prefix=f"{settings.API_V1_PREFIX}",      tags=["Doctor"])
app.include_router(admin.router,    prefix=f"{settings.API_V1_PREFIX}",      tags=["Admin"])
app.include_router(asha.router,     prefix=f"{settings.API_V1_PREFIX}",      tags=["ASHA Worker"])
app.include_router(test_rbac.router,prefix=f"{settings.API_V1_PREFIX}",      tags=["Test RBAC"])
app.include_router(voice.router,    prefix=f"{settings.API_V1_PREFIX}",      tags=["Voice"])
app.include_router(chat.router,     prefix=f"{settings.API_V1_PREFIX}",      tags=["Chat"])


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": "3.0.0",
        "database": "connected" if is_db_connected() else "offline",
        "roles": ["patient", "doctor", "admin", "asha"],
    }