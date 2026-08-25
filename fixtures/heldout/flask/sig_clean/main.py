import hmac
import hashlib

from fastapi import FastAPI, Request, HTTPException

app = FastAPI()

ledger = {}
SETTLEMENT_KEY = "server-side-only-value"


@app.post("/checkout/{order_id}/finalize")
async def finalize_order(order_id: str, request: Request):
    raw = await request.body()
    signature = request.headers.get("x-gateway-signature", "")
    expected = hmac.new(SETTLEMENT_KEY.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="bad signature")
    body = await request.json()
    entry = ledger.get(order_id)
    incoming_amount = body.get("amount")
    if incoming_amount != entry["amount"]:
        raise HTTPException(status_code=400, detail="amount mismatch")
    entry["status"] = "settled"
    return {"ok": True}
