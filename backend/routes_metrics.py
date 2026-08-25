from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/api/metrics")
async def get_metrics():
    raise HTTPException(status_code=501, detail="metrics not wired up yet")
