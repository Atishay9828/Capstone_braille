"""Database engine and session dependency.

Uses SQLite for MVP. The database file is at ./braillix.db in the project root.
Tests use an in-memory SQLite database to avoid touching the file on disk.
"""

from __future__ import annotations

from typing import Generator

from sqlmodel import Session, SQLModel, create_engine

# File-based SQLite for the running application.
_DATABASE_URL = "sqlite:///./braillix.db"

engine = create_engine(
    _DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


def create_all_tables() -> None:
    """Create all SQLModel tables. Called once on app startup."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency: yield a database session per request."""
    with Session(engine) as session:
        yield session
