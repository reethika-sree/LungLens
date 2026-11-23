"""
VoiceCare PHC - MongoDB Connection via Motor (async)
Includes seamless in-memory fallback with verified pre-seeded demo users when external MongoDB is offline.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings
from datetime import datetime
import uuid

settings = get_settings()

_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None
_connected: bool = False

# ── Mock Storage Engine for Offline / Standalone Execution ────────────────────

class MockCursor:
    def __init__(self, docs):
        self._docs = list(docs)
        self._sort_key = None
        self._sort_dir = 1
        self._limit_n = None

    def sort(self, key_or_list, direction=1):
        if isinstance(key_or_list, list):
            self._sort_key, self._sort_dir = key_or_list[0]
        else:
            self._sort_key = key_or_list
            self._sort_dir = direction
        return self

    def limit(self, n):
        self._limit_n = n
        return self

    async def to_list(self, length=None):
        docs = list(self._docs)
        if self._sort_key:
            rev = (self._sort_dir == -1)
            docs.sort(key=lambda d: d.get(self._sort_key) or "", reverse=rev)
        if length is not None:
            docs = docs[:length]
        elif self._limit_n is not None:
            docs = docs[:self._limit_n]
        return docs

class InsertOneResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id

class UpdateResult:
    def __init__(self, matched_count=1, modified_count=1):
        self.matched_count = matched_count
        self.modified_count = modified_count

class MockCollection:
    def __init__(self, name, initial_docs=None):
        self.name = name
        self.docs = list(initial_docs) if initial_docs else []

    def _matches(self, doc, query):
        for k, v in query.items():
            if isinstance(v, dict) and "$in" in v:
                if doc.get(k) not in v["$in"]:
                    return False
            elif doc.get(k) != v:
                return False
        return True

    async def create_index(self, *args, **kwargs):
        return "mock_index"

    async def find_one(self, query=None, sort=None):
        query = query or {}
        matches = [d for d in self.docs if self._matches(d, query)]
        if not matches:
            return None
        if sort:
            key, direction = sort[0] if isinstance(sort, list) else sort
            matches.sort(key=lambda d: d.get(key) or "", reverse=(direction == -1))
        return dict(matches[0])

    def find(self, query=None, projection=None):
        query = query or {}
        matches = [d for d in self.docs if self._matches(d, query)]
        return MockCursor(matches)

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = str(uuid.uuid4())
        self.docs.append(d)
        return InsertOneResult(d["_id"])

    async def update_one(self, filter_query, update_dict, upsert=False):
        matched = False
        for i, d in enumerate(self.docs):
            if self._matches(d, filter_query):
                matched = True
                if "$set" in update_dict:
                    self.docs[i].update(update_dict["$set"])
                break
        if not matched and upsert:
            new_doc = dict(filter_query)
            if "$set" in update_dict:
                new_doc.update(update_dict["$set"])
            await self.insert_one(new_doc)
            return UpdateResult(0, 1)
        return UpdateResult(1 if matched else 0, 1 if matched else 0)

    async def count_documents(self, query=None):
        query = query or {}
        return len([d for d in self.docs if self._matches(d, query)])

# Pre-seeded official demo accounts with verified bcrypt hashes
_DEFAULT_USERS = [
    {
        "user_id": "pt-ramesh-101",
        "email": "patient@phc.gov.in",
        "full_name": "Ramesh Kumar (Patient)",
        "role": "patient",
        "password_hash": "$2b$12$y06LcSK/KsQsQUA.x7WpTut4LsVq16R6ziePLEMERiRPYn/xqQjre", # patient123
        "email_verified": True,
        "created_at": datetime.utcnow()
    },
    {
        "user_id": "doc-ananya-201",
        "email": "doctor@phc.gov.in",
        "full_name": "Dr. Ananya Sharma (PHC Doctor)",
        "role": "doctor",
        "password_hash": "$2b$12$2qDPujYOvmVBtKQuzl4Oqumo2fzSuBSyZeHakXUJ6wROP1KejA6Xe", # doctor123
        "email_verified": True,
        "created_at": datetime.utcnow()
    },
    {
        "user_id": "asha-lakshmi-301",
        "email": "asha@phc.gov.in",
        "full_name": "Lakshmi Devi (ASHA Worker)",
        "role": "asha",
        "password_hash": "$2b$12$nvBlVBTV4rhEBzvnPG8zq.Apm2UHiptTOseJ3uG15HW9S6T4e3G0y", # asha123
        "email_verified": True,
        "created_at": datetime.utcnow()
    },
    {
        "user_id": "adm-dho-401",
        "email": "admin@phc.gov.in",
        "full_name": "District Health Officer (Admin)",
        "role": "admin",
        "password_hash": "$2b$12$4SNPFFJA9LbREPBKPF615eIhugV5eXycyZc1HQtmAa2EVfq93n2mO", # admin123
        "email_verified": True,
        "created_at": datetime.utcnow()
    }
]

_DEFAULT_PATIENT_RECORDS = [
    {
        "record_id": "rec-pt-001",
        "patient_id": "PT-2026-001",
        "user_id": "pt-ramesh-101",
        "patient_name": "Ramesh Kumar",
        "age": 46,
        "sex": "Male",
        "village": "Kuppam Block",
        "phone": "+91 98480 12345",
        "language": "Telugu",
        "voice_transcript": "నాకు మూడు వారాలుగా దగ్గు ఉంది, రాత్రి వేళల్లో జ్వరం వస్తుంది.",
        "symptom_answers": {"coughPhlegm": "yes", "nightFever": "yes", "weightLoss": "yes"},
        "tb_risk_level": "high",
        "tb_risk_score": 88,
        "tb_confidence": 92.5,
        "priority": "P1",
        "status": "prediction_complete",
        "dots_active": True,
        "dots_day": 14,
        "dots_month": 1,
        "adherence_pct": 92.8,
        "today_taken": True,
        "missed_last_7": 0,
        "consecutive_missed": 0,
        "screening_due": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    },
    {
        "record_id": "rec-pt-002",
        "patient_id": "PT-2026-002",
        "user_id": "pt-suresh-102",
        "patient_name": "Suresh Babu",
        "age": 52,
        "sex": "Male",
        "village": "Tirupati Rural",
        "phone": "+91 98480 54321",
        "language": "Telugu",
        "voice_transcript": "దగ్గు రెండు వారాలుగా ఉంది, రక్తం పడలేదు.",
        "symptom_answers": {"coughPhlegm": "yes", "coughingBlood": "no"},
        "tb_risk_level": "medium",
        "tb_risk_score": 54,
        "tb_confidence": 85.0,
        "priority": "P2",
        "status": "prediction_complete",
        "dots_active": True,
        "dots_day": 28,
        "dots_month": 1,
        "adherence_pct": 89.2,
        "today_taken": False,
        "missed_last_7": 1,
        "consecutive_missed": 1,
        "screening_due": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
]

_fallback_db = {
    "users": MockCollection("users", _DEFAULT_USERS),
    "patient_records": MockCollection("patient_records", _DEFAULT_PATIENT_RECORDS),
    "dots_checkins": MockCollection("dots_checkins", []),
    "asha_visits": MockCollection("asha_visits", []),
    "sessions": MockCollection("sessions", [])
}

async def connect_db():
    global _client, _db, _connected
    try:
        _client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=2000)
        _db = _client[settings.MONGODB_DB_NAME]

        # ── Indexes ────────────────────────────────────────────────────────────────
        await _db.users.create_index("email", unique=True)
        await _db.users.create_index("username")

        await _db.patient_records.create_index("patient_id")
        await _db.patient_records.create_index("user_id")
        await _db.patient_records.create_index("created_at")
        await _db.patient_records.create_index("tb_risk_level")

        # DOTS checkins collection — new
        await _db.dots_checkins.create_index("patient_user_id")
        await _db.dots_checkins.create_index("date")
        await _db.dots_checkins.create_index([("patient_user_id", 1), ("date", -1)])

        # ASHA visit logs collection — new
        await _db.asha_visits.create_index("patient_user_id")
        await _db.asha_visits.create_index("logged_by")
        await _db.asha_visits.create_index("date")

        _connected = True
        print(f"[DB] Connected to MongoDB: {settings.MONGODB_DB_NAME}")
    except Exception as e:
        _connected = False
        print(f"[DB] MongoDB offline fallback mode enabled: {e}")


async def close_db():
    global _client, _connected
    if _client:
        _client.close()
        _connected = False
        print("[DB] MongoDB connection closed")


def get_db():
    return _db if _connected else _fallback_db


def is_db_connected() -> bool:
    """Check if MongoDB connection is active and responsive."""
    return _connected


# ── Collection helpers ─────────────────────────────────────────────────────────
def users_col():
    return _db["users"] if _connected else _fallback_db["users"]


def sessions_col():
    return _db["sessions"] if _connected else _fallback_db["sessions"]


def patient_records_col():
    return _db["patient_records"] if _connected else _fallback_db["patient_records"]


def dots_checkins_col():
    """Daily DOTS pill check-in records."""
    return _db["dots_checkins"] if _connected else _fallback_db["dots_checkins"]


def asha_visits_col():
    """ASHA worker visit log entries."""
    return _db["asha_visits"] if _connected else _fallback_db["asha_visits"]
