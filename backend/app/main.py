import os
import sys
from pathlib import Path

# Add project root directory to sys.path so 'backend.app' imports work regardless of execution directory
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from backend.app.config import settings
from backend.app.db import engine, Base, SessionLocal
import backend.app.models # Registers all SQLAlchemy models

from backend.app.routers.case_routes import router as case_router
from backend.app.routers.document_routes import router as document_router
from backend.app.routers.claim_routes import router as claim_router
from backend.app.routers.trace_routes import router as trace_router
from backend.app.routers.mcp_routes import router as mcp_router
from backend.app.routers.integration_routes import router as integration_router
from backend.app.routers.auth_routes import router as auth_router
from backend.app.routers.admin_routes import router as admin_router
from backend.app.routers import sms

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables
    Base.metadata.create_all(bind=engine)
    try:
        with SessionLocal() as db:
            from backend.app.models.operational import Case
            if db.query(Case).count() == 0:
                print("Fresh database detected: auto-seeding golden demo cases and trace data...")
                from scripts.seed_demo import seed as seed_demo
                from scripts.seed_trace import seed_trace_population
                seed_demo()
                seed_trace_population(100)
                print("Auto-seeding completed successfully!")
    except Exception as e:
        print(f"Auto-seed notification: {e}")
    yield
    # Shutdown

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise Healthcare Workflow & Governed Longitudinal Data Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoints for Render Cloud Deployment Track
@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "medpass-ai-backend",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT
    }

@app.get("/ready", tags=["Health"])
def readiness_check(response: Response):
    checks = {
        "database": "checking",
        "storage": "checking"
    }
    healthy = True

    # 1. Test database connectivity
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        checks["database"] = "connected"
    except Exception as e:
        checks["database"] = f"unreachable: {str(e)}"
        healthy = False

    # 2. Test storage writability
    try:
        test_file = os.path.join(settings.EXPORT_DIR, ".probe_test")
        with open(test_file, "w") as f:
            f.write("probe")
        if os.path.exists(test_file):
            os.remove(test_file)
        checks["storage"] = "writable"
    except Exception as e:
        checks["storage"] = f"unwritable: {str(e)}"
        healthy = False

    # 3. Test S3 Cloud Storage
    try:
        from backend.app.services.storage_service import StorageService
        s3_stat = StorageService.check_health()
        checks["cloud_s3"] = s3_stat
    except Exception as e:
        checks["cloud_s3"] = {"status": "error", "error": str(e)}

    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "checks": checks}

    return {"status": "ready", "checks": checks}

# Mount API Routers
app.include_router(case_router, prefix="/api")
app.include_router(document_router, prefix="/api")
app.include_router(claim_router, prefix="/api")
app.include_router(trace_router, prefix="/api")
app.include_router(mcp_router, prefix="/api")
app.include_router(integration_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(sms.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
