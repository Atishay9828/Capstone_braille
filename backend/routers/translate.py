from fastapi import APIRouter, HTTPException

from backend.models.schemas import (
    CamAnglesRequest,
    CamAnglesResponse,
    TranslateMathRequest,
    TranslateMathResponse,
    TranslateTextRequest,
    TranslateTextResponse,
)
from backend.services.cam_angles import braille_sequence_to_angles
from backend.services.translator import BrailleGrade, translate_math, translate_text

router = APIRouter(prefix="/translate", tags=["translate"])


@router.post("", response_model=TranslateTextResponse)
async def translate_text_endpoint(request: TranslateTextRequest) -> TranslateTextResponse:
    """Translate plain text to Grade 1 or Grade 2 Braille."""
    try:
        result = translate_text(request.text, BrailleGrade(request.grade))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return TranslateTextResponse(
        input=result.input_text,
        grade=result.grade.value,
        braille_unicode=result.braille_unicode,
        dot_patterns=result.dot_patterns,
        cell_count=result.cell_count,
    )


@router.post("-math", response_model=TranslateMathResponse)
async def translate_math_endpoint(request: TranslateMathRequest) -> TranslateMathResponse:
    """Translate a LaTeX math expression to Nemeth Braille."""
    try:
        result = translate_math(request.latex)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return TranslateMathResponse(
        input_latex=result.input_text,
        braille_unicode=result.braille_unicode,
        dot_patterns=result.dot_patterns,
        cell_count=result.cell_count,
    )


@router.post("/cam-angles", response_model=CamAnglesResponse)
async def cam_angles_endpoint(request: CamAnglesRequest) -> CamAnglesResponse:
    """Convert a list of Braille dot patterns to cam angles in degrees."""
    try:
        angles = braille_sequence_to_angles(request.dot_patterns)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return CamAnglesResponse(
        dot_patterns=request.dot_patterns,
        angles_degrees=angles,
        cell_count=len(angles),
    )
