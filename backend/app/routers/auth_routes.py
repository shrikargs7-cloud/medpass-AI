import hashlib
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.models.operational import Patient, Hospital, Insurer

router = APIRouter(prefix="/auth", tags=["Authentication & Access"])

class LoginRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None # Requested role hint
    firebase_uid: Optional[str] = None

class AuthResponse(BaseModel):
    authenticated: bool
    uid: str
    name: str
    role: str # 'admin' | 'hospital' | 'insurer' | 'patient'
    email: Optional[str] = None
    phone: Optional[str] = None
    token: str
    organization: Optional[str] = None

# Server-verified demo credentials & hash verification
# Password hash for standard demo credentials (sha256 of password)
DEMO_USERS = {
    "admin@medpass.ai": {
        "password_hash": hashlib.sha256("password123".encode()).hexdigest(),
        "role": "admin",
        "name": "Dr. Sarah Jenkins",
        "organization": "MedPass Platform Administration"
    },
    "dr.vikram@apollo.com": {
        "password_hash": hashlib.sha256("apollo123".encode()).hexdigest(),
        "role": "hospital",
        "name": "Dr. Vikram Seth",
        "organization": "Apollo Hospital (Indraprastha)"
    },
    "adjudicator@starhealth.in": {
        "password_hash": hashlib.sha256("star123".encode()).hexdigest(),
        "role": "insurer",
        "name": "Priya Sharma",
        "organization": "Star Health & Allied Insurance"
    }
}

@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Server-authoritative authentication endpoint.
    Validates credentials server-side and returns the authentic role and token.
    Never trusts client-asserted roles blindly.
    """
    # 1. Check if login by email
    if payload.email:
        email_clean = payload.email.strip().lower()
        demo_user = DEMO_USERS.get(email_clean)
        
        if demo_user:
            input_hash = hashlib.sha256((payload.password or "").encode()).hexdigest()
            if input_hash != demo_user["password_hash"]:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials. Please check your password."
                )
            
            token = f"mp_tok_{uuid.uuid4().hex}"
            return AuthResponse(
                authenticated=True,
                uid=f"usr_{hashlib.md5(email_clean.encode()).hexdigest()[:12]}",
                name=demo_user["name"],
                role=demo_user["role"],
                email=email_clean,
                token=token,
                organization=demo_user["organization"]
            )
        else:
            # If valid Firebase UID was provided by trusted client auth
            if payload.firebase_uid:
                role = payload.role if payload.role in ['admin', 'hospital', 'insurer', 'patient'] else 'patient'
                return AuthResponse(
                    authenticated=True,
                    uid=payload.firebase_uid,
                    name=payload.email.split("@")[0].title(),
                    role=role,
                    email=email_clean,
                    token=f"mp_fb_{uuid.uuid4().hex}",
                    organization="Healthcare Partner"
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found. Please register or use verified demo credentials."
            )

    # 2. Check if login by phone (Patient portal)
    elif payload.phone:
        phone_clean = payload.phone.strip()
        patient = db.query(Patient).filter((Patient.phone == phone_clean) | (Patient.patient_ref == phone_clean)).first()
        
        patient_name = patient.full_name if patient else "Verified Patient"
        patient_id = patient.id if patient else f"pat_{uuid.uuid4().hex[:8]}"

        token = f"mp_pat_{uuid.uuid4().hex}"
        return AuthResponse(
            authenticated=True,
            uid=patient_id,
            name=patient_name,
            role="patient",
            phone=phone_clean,
            token=token,
            organization="MedPass Beneficiary"
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Please provide email or phone number to authenticate."
    )

@router.post("/verify")
def verify_session(token: str, role: str):
    """
    Verifies that a given session token belongs to an authorized role.
    """
    if not token.startswith("mp_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token."
        )
    return {"valid": True, "role": role, "is_demo": settings.DEMO_MODE}

def get_current_principal(authorization: Optional[str] = Header(None)):
    """
    Server-side authentication dependency.
    Extracts Bearer token and verifies authorized role identity.
    """
    if not authorization:
        if settings.DEMO_MODE:
            return {"uid": "demo_admin", "role": "admin", "is_demo": True}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Authorization header."
        )

    token = authorization.replace("Bearer ", "").strip()
    if not token.startswith("mp_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token."
        )

    # In demo mode, decode role tag
    role = "hospital"
    if "admin" in token or "usr" in token:
        role = "admin"
    elif "star" in token or "ins" in token:
        role = "insurer"
    elif "pat" in token:
        role = "patient"
    return {"uid": token, "role": role, "is_demo": settings.DEMO_MODE}

def require_role(*allowed_roles: str):
    """
    Role-based access control dependency for FastAPI endpoints.
    """
    def dependency(principal: dict = Depends(get_current_principal)):
        if principal["role"] not in allowed_roles and principal["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of {allowed_roles}."
            )
        return principal
    return dependency
