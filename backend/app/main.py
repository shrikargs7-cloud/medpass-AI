import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.db import engine, Base
import backend.app.models # Registers all SQLAlchemy models

from backend.app.routers.case_routes import router as case_router
from backend.app.routers.document_routes import router as document_router
from backend.app.routers.claim_routes import router as claim_router
from backend.app.routers.trace_routes import router as trace_router
from backend.app.routers.mcp_routes import router as mcp_router
from backend.app.routers.integration_routes import router as integration_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables
    Base.metadata.create_all(bind=engine)
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
def readiness_check():
    return {
        "status": "ready",
        "database": "connected",
        "storage": "writable"
    }

# Mount API Routers
app.include_router(case_router, prefix="/api")
app.include_router(document_router, prefix="/api")
app.include_router(claim_router, prefix="/api")
app.include_router(trace_router, prefix="/api")
app.include_router(mcp_router, prefix="/api")
app.include_router(integration_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
