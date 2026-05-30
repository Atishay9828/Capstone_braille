"""Pydantic v2 request/response schemas for the Braillix API."""

from pydantic import BaseModel, Field, field_validator


class TranslateTextRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Plain text to translate into Braille.",
        examples=["hello world"],
    )
    grade: str = Field(
        default="grade1",
        pattern=r"^(grade1|grade2)$",
        description="Braille grade: 'grade1' (uncontracted) or 'grade2' (contracted).",
        examples=["grade1"],
    )

    @field_validator("text", mode="before")
    @classmethod
    def strip_text(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class TranslateTextResponse(BaseModel):
    input: str = Field(description="Original input text.")
    grade: str = Field(description="Grade used for translation.")
    braille_unicode: str = Field(description="Translated string in Unicode Braille (U+2800–U+283F).")
    dot_patterns: list[int] = Field(description="6-bit dot patterns (0–63) per Braille cell.")
    cell_count: int = Field(description="Number of Braille cells produced.")


class TranslateMathRequest(BaseModel):
    latex: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="LaTeX math expression to translate into Nemeth Braille.",
        examples=["x^2 + 3x + 2 = 0"],
    )

    @field_validator("latex", mode="before")
    @classmethod
    def strip_and_unwrap_latex(cls, v: object) -> object:
        if not isinstance(v, str):
            return v
        v = v.strip()
        # Remove display-math $$ wrappers before inline-math $ wrappers.
        # No length guard — stripping "$$" → "" is intentional; min_length=1 will reject it.
        if v.startswith("$$") and v.endswith("$$"):
            v = v[2:-2].strip()
        elif v.startswith("$") and v.endswith("$") and len(v) > 1:
            v = v[1:-1].strip()
        return v


class TranslateMathResponse(BaseModel):
    input_latex: str = Field(description="Original (unwrapped) LaTeX expression.")
    braille_unicode: str = Field(description="Nemeth Braille string in Unicode Braille block.")
    dot_patterns: list[int] = Field(description="6-bit dot patterns (0–63) per Braille cell.")
    cell_count: int = Field(description="Number of Braille cells produced.")


class HealthResponse(BaseModel):
    status: str = Field(description="'ok' or 'degraded'.")
    liblouis_available: bool = Field(description="Whether liblouis is importable.")
    tables: dict[str, bool] = Field(description="Availability of each liblouis translation table.")
    version: str = Field(default="0.1.0", description="API version.")


class CamAnglesRequest(BaseModel):
    dot_patterns: list[int] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of 6-bit Braille dot patterns (0–63) to convert to cam angles.",
        examples=[[0, 1, 63]],
    )

    @field_validator("dot_patterns")
    @classmethod
    def validate_patterns_in_range(cls, v: list[int]) -> list[int]:
        for pattern in v:
            if not (0 <= pattern <= 63):
                raise ValueError(
                    f"dot pattern {pattern!r} is out of range — must be 0–63"
                )
        return v


class CamAnglesResponse(BaseModel):
    dot_patterns: list[int] = Field(description="Input dot patterns.")
    angles_degrees: list[float] = Field(description="Corresponding cam angles in degrees.")
    cell_count: int = Field(description="Number of cells (length of both lists).")


# ---------------------------------------------------------------------------
# Phase 2 — math image OCR (L4 Input Processor)
# ---------------------------------------------------------------------------

class OCRImageResponse(BaseModel):
    """Raw OCR result for POST /ocr/image."""

    filename: str = Field(description="Original uploaded filename.")
    latex: str | None = Field(description="Extracted LaTeX, or null if OCR failed.")
    confidence: float = Field(description="Heuristic confidence in [0.0, 1.0].")
    preprocessing_applied: bool = Field(description="Whether image preprocessing ran.")
    inference_time_ms: float = Field(description="pix2tex inference time in milliseconds.")
    success: bool = Field(description="True if usable LaTeX was extracted.")
    error: str | None = Field(default=None, description="Human-readable error if success is false.")


class PipelineStages(BaseModel):
    """Per-stage timing for the image → Braille pipeline (milliseconds)."""

    preprocessing_ms: float = Field(description="Image preprocessing time.")
    ocr_ms: float = Field(description="pix2tex inference time.")
    translation_ms: float = Field(description="LaTeX → Nemeth translation time.")


class ImageToBrailleResponse(BaseModel):
    """Full image → Nemeth Braille result for POST /ocr/image-to-braille."""

    filename: str = Field(description="Original uploaded filename.")
    latex: str | None = Field(description="Raw OCR LaTeX output (for debugging).")
    braille_unicode: str = Field(description="Nemeth Braille string (empty if pipeline failed).")
    dot_patterns: list[int] = Field(description="6-bit dot patterns (0–63) per cell.")
    cell_count: int = Field(description="Number of Braille cells produced.")
    ocr_confidence: float = Field(description="OCR confidence in [0.0, 1.0].")
    total_time_ms: float = Field(description="End-to-end wallclock time in milliseconds.")
    pipeline_stages: PipelineStages = Field(description="Per-stage timing breakdown.")
    success: bool = Field(description="True if Braille was produced from the image.")
    error: str | None = Field(default=None, description="Human-readable error if success is false.")


# ---------------------------------------------------------------------------
# Phase 3 — adaptive assessment
# ---------------------------------------------------------------------------

class AssessmentGenerateRequest(BaseModel):
    latex: str = Field(..., min_length=1, max_length=5000,
                       description="Math expression to quiz on.", examples=["x^2 + 3x + 2 = 0"])
    student_id: str = Field(..., min_length=1, max_length=128,
                            description="Stable identifier for the student.", examples=["demo_student"])
    session_id: str | None = Field(default=None, description="Classroom session code, if any.")


class MCQChoiceOut(BaseModel):
    index: int = Field(description="Choice index (0–3).")
    text: str = Field(description="Plain-text answer (Braille-friendly ASCII).")
    braille: str = Field(description="Unicode Braille of the choice text.")


class AssessmentGenerateResponse(BaseModel):
    question_id: str = Field(description="UUID — pass to /assessment/submit.")
    question_text: str = Field(description="Plain-English question prompt.")
    question_braille: str = Field(description="Braille of the question prompt.")
    expression: str = Field(description="Original LaTeX expression.")
    expression_braille: str = Field(description="Nemeth Braille of the expression.")
    choices: list[MCQChoiceOut] = Field(description="Exactly 4 choices with Braille.")
    difficulty: float = Field(description="Estimated difficulty 0.0–1.0.")
    question_type: str = Field(description="solve_for_x | simplify | identify_type.")
    skill: str = Field(description="Skill key used by the knowledge tracer.")


class AssessmentSubmitRequest(BaseModel):
    question_id: str = Field(..., description="The question_id returned by /generate.")
    student_id: str = Field(..., min_length=1, max_length=128)
    selected_index: int = Field(..., ge=0, le=3, description="Chosen choice index (0–3).")


class AssessmentSubmitResponse(BaseModel):
    correct: bool
    correct_index: int
    correct_answer_text: str
    explanation: str = Field(description="Plain-English feedback on the answer/error.")
    p_knows_before: float = Field(description="BKT mastery before this answer.")
    p_knows_after: float = Field(description="BKT mastery after this answer.")
    skill: str
    next_recommended_difficulty: float
    recommendation: str


class SkillSummary(BaseModel):
    p_knows: float
    attempts: int
    correct: int


class StudentProfileResponse(BaseModel):
    student_id: str
    skills: dict[str, SkillSummary]
    overall_mastery: float = Field(description="Mean p_knows across attempted skills.")
    total_questions: int
    total_correct: int
