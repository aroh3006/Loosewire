from fastapi import APIRouter

from evaluation.metrics import compute_metrics

router = APIRouter()


@router.get("/api/metrics")
async def get_metrics():
    return compute_metrics()
