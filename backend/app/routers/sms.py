from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

router = APIRouter(prefix="/api/sms", tags=["sms"])

class SmsRequest(BaseModel):
    to: str
    body: str

@router.post("/send")
async def send_sms(req: SmsRequest):
    """Send an SMS message. Requires hospital or insurer role."""
    provider = os.getenv("SMS_PROVIDER")
    if provider == "twilio":
        try:
            from twilio.rest import Client
            client = Client(os.getenv("SMS_ACCOUNT_SID"), os.getenv("SMS_AUTH_TOKEN"))
            message = client.messages.create(
                to=req.to,
                from_=os.getenv("SMS_FROM_NUMBER"),
                body=req.body,
            )
            return {"status": "queued", "sid": message.sid}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    # Mock response when no provider is configured
    return {"status": "mock", "to": req.to, "body": req.body, "message": "SMS provider not configured. Message logged."}
