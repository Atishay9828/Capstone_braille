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
