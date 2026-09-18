import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, JSON
from backend.app.db import Base

def gen_uuid():
    return str(uuid.uuid4())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    actor_id = Column(String(100), default="SYSTEM")
    actor_role = Column(String(50), default="SYSTEM")
    action = Column(String(100), nullable=False) # CASE_CREATED, EVALUATED, BLOCKED, SUBMITTED, etc.
    resource_type = Column(String(50), nullable=False) # CASE, DOCUMENT, CLAIM, POLICY
    resource_id = Column(String(100), nullable=False)
    details = Column(JSON, default=dict)
    ip_address = Column(String(50), default="127.0.0.1")
    created_at = Column(DateTime, default=datetime.utcnow)

class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    event_type = Column(String(100), nullable=False) # CASE_CREATED, CLAIM_SUBMITTED, etc.
    aggregate_type = Column(String(50), nullable=False) # Case, Claim, Dataset
    aggregate_id = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, PROCESSED, FAILED
    retry_count = Column(String(50), default="0")
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
