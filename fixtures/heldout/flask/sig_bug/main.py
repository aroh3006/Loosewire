from fastapi import FastAPI, Request

app = FastAPI()

ledger = {}


@app.post("/checkout/{order_id}/finalize")
async def finalize_order(order_id: str, request: Request):
    body = await request.json()
    entry = ledger.get(order_id)
    incoming_amount = body.get("amount")
    if incoming_amount != entry["amount"]:
        return {"error": "amount mismatch"}
    entry["status"] = "settled"
    entry["reference"] = body.get("reference")
    return {"ok": True}
