import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.routes_metrics import router as metrics_router
from backend.routes_scan import router as scan_router

app = FastAPI(title="Loosewire", description="Static scanner for checkout integration code")

app.include_router(scan_router)
app.include_router(metrics_router)

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
