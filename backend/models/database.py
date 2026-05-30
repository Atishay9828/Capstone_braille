"""SQLite data models via SQLModel.

Tables:
  Book            — uploaded PDFs, status tracking
  TranslationJob  — per-page translation results with cached dot patterns
  ClassroomSession — classroom session history

SQLModel uses SQLAlchemy under the hood; all models are both ORM models
AND Pydantic schemas, so they work natively with FastAPI.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class Book(SQLModel, table=True):
    """A PDF book uploaded by a teacher for Braille translation."""

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    filename: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    page_count: int = Field(default=0)
    status: str = Field(default="pending")  # pending | done | error

    def is_done(self) -> bool:
        return self.status == "done"


class TranslationJob(SQLModel, table=True):
    """A single page's Braille translation result, cached for replay."""

    id: Optional[int] = Field(default=None, primary_key=True)
    book_id: Optional[int] = Field(default=None, foreign_key="book.id", index=True)
    page_number: int
    input_text: str
    braille_unicode: str
    dot_patterns_json: str = Field(default="[]")  # JSON-encoded list[int]
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def dot_patterns(self) -> list[int]:
        return json.loads(self.dot_patterns_json)

    @dot_patterns.setter
    def dot_patterns(self, patterns: list[int]) -> None:
        self.dot_patterns_json = json.dumps(patterns)


class ClassroomSession(SQLModel, table=True):
    """Persisted record of a Braillix classroom session."""

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = Field(default=None)
    teacher_ip: Optional[str] = Field(default=None)
    student_count_peak: int = Field(default=0)


# ---------------------------------------------------------------------------
# Phase 3 — adaptive assessment
# ---------------------------------------------------------------------------

class AssessmentQuestion(SQLModel, table=True):
    """A generated MCQ and its answered state. One row per /assessment/generate."""

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    student_id: str = Field(index=True)
    session_id: Optional[str] = Field(default=None)
    latex: str
    question_type: str
    skill: str
    difficulty: float
    correct_index: int
    choices_json: str = Field(default="[]")  # JSON list of {value, distractor_type}
    answered: bool = Field(default=False)
    selected_index: Optional[int] = Field(default=None)
    correct: Optional[bool] = Field(default=None)
    p_knows_before: Optional[float] = Field(default=None)
    p_knows_after: Optional[float] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def choices(self) -> list[dict]:
        return json.loads(self.choices_json)

    @choices.setter
    def choices(self, value: list[dict]) -> None:
        self.choices_json = json.dumps(value)


class StudentKnowledge(SQLModel, table=True):
    """Per-(student, skill) BKT mastery state. One row per skill a student tries."""

    __table_args__ = (UniqueConstraint("student_id", "skill", name="uq_student_skill"),)

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    student_id: str = Field(index=True)
    skill: str
    p_knows: float
    attempts: int = Field(default=0)
    correct: int = Field(default=0)
    state_json: str = Field(default="{}")  # serialized StudentSkillState
    updated_at: datetime = Field(default_factory=datetime.utcnow)
