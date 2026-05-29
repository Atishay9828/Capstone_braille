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
