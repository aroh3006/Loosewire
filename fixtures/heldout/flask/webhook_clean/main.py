import hmac
import hashlib

from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
EVENTS_SECRET = "server-side-only-value"


@app.post("/integrations/gateway-callback")
async def gateway_callback(request: Request):
    raw = await request.body()
    signature = request.headers.get("x-gateway-signature", "")
    expected = hmac.new(EVENTS_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="bad signature")
    payload = await request.json()
    return {"received": True}
