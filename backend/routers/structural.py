"""Structural / engineering endpoints — stubs until McKee / paperboard models are wired."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class PaperboardPreviewRequest(BaseModel):
    L: float = Field(gt=0, description="Inner length mm")
    W: float = Field(gt=0, description="Inner width mm")
    H: float = Field(gt=0, description="Inner height mm")
    board_grade: str = "SBB 350gsm"
    style: str = "straight-tuck"


@router.post("/paperboard-preview")
def paperboard_preview(body: PaperboardPreviewRequest):
    """
    Placeholder for a future paperboard compression / BCT-style preview.
    Frontend can call this to verify the API stack; values are illustrative only.
    """
    area_cm2 = (body.L * body.W * 2 + body.L * body.H * 2 + body.W * body.H * 2) / 100.0
    return {
        "ok": True,
        "version": "stub-0.1",
        "input": body.model_dump(),
        "metrics": {
            "surface_area_cm2": round(area_cm2, 2),
            "note": "Replace with board-specific structural model in a later phase.",
        },
    }
