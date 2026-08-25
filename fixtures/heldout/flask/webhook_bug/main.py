from fastapi import FastAPI, Request

app = FastAPI()


@app.post("/integrations/gateway-callback")
async def gateway_callback(request: Request):
    payload = await request.json()
    kind = payload.get("type")
    if kind == "charge.settled":
        pass
    return {"received": True}
