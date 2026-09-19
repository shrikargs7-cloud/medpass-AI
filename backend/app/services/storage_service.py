import os
import hashlib
import logging
from typing import Dict, Any, Optional
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from backend.app.config import settings

logger = logging.getLogger("medpass_storage")

class StorageService:
    """
    Enterprise S3-compatible cloud object storage service for MedPass.
    Connects to S3 storage (Bunny Storage / AWS S3) with automatic local disk caching.
    """

    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            try:
                cls._client = boto3.client(
                    "s3",
                    endpoint_url=settings.S3_ENDPOINT_URL,
                    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
                    region_name=settings.S3_REGION_NAME,
                    config=Config(signature_version="s3v4")
                )
            except Exception as e:
                logger.error(f"Failed to initialize S3 client: {e}")
                cls._client = None
        return cls._client

    @classmethod
    def upload_file(
        cls,
        file_bytes: bytes,
        key: str,
        content_type: str = "application/octet-stream"
    ) -> Dict[str, Any]:
        """
        Uploads file bytes to S3 object storage and mirrors locally in STORAGE_DIR.
        """
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        size_bytes = len(file_bytes)

        # 1. Save to local storage cache for instant offline fallback
        local_path = os.path.join(settings.STORAGE_DIR, key.replace("/", os.sep))
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        try:
            with open(local_path, "wb") as f:
                f.write(file_bytes)
        except Exception as e:
            logger.warning(f"Local storage mirror failed: {e}")

        # 2. Upload to Cloud S3 Storage
        s3_uploaded = False
        s3_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{key}"
        if settings.S3_STORAGE_ENABLED:
            client = cls.get_client()
            if client:
                try:
                    client.put_object(
                        Bucket=settings.S3_BUCKET_NAME,
                        Key=key,
                        Body=file_bytes,
                        ContentType=content_type
                    )
                    s3_uploaded = True
                    logger.info(f"✓ Uploaded {key} ({size_bytes} bytes) to S3 bucket {settings.S3_BUCKET_NAME}")
                except Exception as e:
                    logger.error(f"S3 upload failed for {key}: {e}. Local fallback preserved.")

        return {
            "storage_key": key,
            "bucket": settings.S3_BUCKET_NAME if s3_uploaded else "local_disk",
            "url": s3_url if s3_uploaded else f"/api/storage/{key}",
            "sha256": sha256_hash,
            "size_bytes": size_bytes,
            "s3_uploaded": s3_uploaded,
            "provider": "bunny_s3" if s3_uploaded else "local_storage"
        }

    @classmethod
    def get_file_bytes(cls, key: str) -> Optional[bytes]:
        """
        Retrieves file bytes from S3, with local cache fallback.
        """
        # Try S3 first
        if settings.S3_STORAGE_ENABLED:
            client = cls.get_client()
            if client:
                try:
                    res = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
                    return res["Body"].read()
                except Exception as e:
                    logger.warning(f"S3 download failed for {key} ({e}), checking local cache...")

        # Fallback to local disk
        local_path = os.path.join(settings.STORAGE_DIR, key.replace("/", os.sep))
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()

        return None

    @classmethod
    def check_health(cls) -> Dict[str, Any]:
        """
        Verifies active connectivity to S3 cloud storage.
        """
        if not settings.S3_STORAGE_ENABLED:
            return {"status": "disabled", "provider": "local_disk"}

        client = cls.get_client()
        if not client:
            return {"status": "unreachable", "error": "Client failed to initialize"}

        try:
            res = client.list_objects_v2(Bucket=settings.S3_BUCKET_NAME, MaxKeys=1)
            return {
                "status": "connected",
                "provider": "bunny_s3",
                "bucket": settings.S3_BUCKET_NAME,
                "endpoint": settings.S3_ENDPOINT_URL,
                "region": settings.S3_REGION_NAME
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
