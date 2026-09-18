import httpx
import asyncio
from typing import Dict, Any
from backend.app.config import settings

class N8NWebhookDispatcher:
    """
    Asynchronous, decoupled event dispatcher for n8n workflow automations.
    Guarantees core MedPass operations continue unimpeded if n8n is offline.
    """

    @staticmethod
    def dispatch_case_event(event_type: str, case_data: Dict[str, Any]):
        """Fires an asynchronous background HTTP POST to the configured n8n webhook URL."""
        if not settings.N8N_ENABLED or not settings.N8N_WEBHOOK_URL:
            return

        payload = {
            "source": "MedPass AI Operational Hub",
            "event_type": event_type,
            "timestamp": "2026-09-18T10:00:00Z",
            "data": case_data
        }

        # Fire and forget in a separate asyncio task or thread safely
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(N8NWebhookDispatcher._send_post(payload))
        except Exception:
            # Non-blocking: fallback when not inside active asyncio loop
            pass

    @staticmethod
    async def _send_post(payload: Dict[str, Any]):
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                await client.post(settings.N8N_WEBHOOK_URL, json=payload)
        except Exception:
            # Swallow connection errors so n8n downtime never impacts core workflows
            pass
