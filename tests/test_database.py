"""Tests for SQLite database models and engine (backend/models/database.py).

All tests use an in-memory SQLite database so no file is created on disk
and tests are perfectly isolated from each other.
"""

import json

import pytest
from sqlmodel import Session, SQLModel, create_engine

from backend.models.database import Book, ClassroomSession, TranslationJob


@pytest.fixture(name="db_session")
def db_session_fixture():
    """In-memory SQLite session — isolated per test, discarded on teardown."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


# ---------------------------------------------------------------------------
# Book
# ---------------------------------------------------------------------------

class TestBook:
    def test_create_and_retrieve(self, db_session: Session):
        book = Book(title="Algebra I", filename="algebra.pdf", page_count=120)
        db_session.add(book)
        db_session.commit()
        db_session.refresh(book)

        fetched = db_session.get(Book, book.id)
        assert fetched is not None
        assert fetched.title == "Algebra I"
        assert fetched.filename == "algebra.pdf"
        assert fetched.page_count == 120

    def test_default_status_is_pending(self, db_session: Session):
        book = Book(title="Test", filename="test.pdf")
        db_session.add(book)
        db_session.commit()
        db_session.refresh(book)
        assert book.status == "pending"
        assert book.is_done() is False

    def test_status_update_to_done(self, db_session: Session):
        book = Book(title="Test", filename="test.pdf")
        db_session.add(book)
        db_session.commit()

        book.status = "done"
        db_session.add(book)
        db_session.commit()
        db_session.refresh(book)
        assert book.is_done() is True

    def test_uploaded_at_set_automatically(self, db_session: Session):
        book = Book(title="Auto Date", filename="f.pdf")
        db_session.add(book)
        db_session.commit()
        db_session.refresh(book)
        assert book.uploaded_at is not None


# ---------------------------------------------------------------------------
# TranslationJob
# ---------------------------------------------------------------------------

class TestTranslationJob:
    def test_create_and_retrieve(self, db_session: Session):
        job = TranslationJob(
            book_id=1,
            page_number=1,
            input_text="hello world",
            braille_unicode="⠓⠑⠇⠇⠕⠀⠺⠕⠗⠇⠙",
            dot_patterns_json=json.dumps([19, 17, 7, 7, 21, 0, 58, 21, 23, 7, 25]),
        )
        db_session.add(job)
        db_session.commit()
        db_session.refresh(job)

        fetched = db_session.get(TranslationJob, job.id)
        assert fetched is not None
        assert fetched.input_text == "hello world"
        assert fetched.page_number == 1

    def test_dot_patterns_property(self, db_session: Session):
        patterns = [19, 17, 7, 7, 21]
        job = TranslationJob(
            page_number=1,
            input_text="hello",
            braille_unicode="⠓⠑⠇⠇⠕",
            dot_patterns_json=json.dumps(patterns),
        )
        db_session.add(job)
        db_session.commit()
        db_session.refresh(job)
        assert job.dot_patterns == patterns

    def test_dot_patterns_setter(self, db_session: Session):
        job = TranslationJob(
            page_number=1,
            input_text="hi",
            braille_unicode="⠓⠊",
        )
        job.dot_patterns = [19, 10]
        db_session.add(job)
        db_session.commit()
        db_session.refresh(job)
        assert json.loads(job.dot_patterns_json) == [19, 10]


# ---------------------------------------------------------------------------
# ClassroomSession
# ---------------------------------------------------------------------------

class TestClassroomSession:
    def test_create_and_retrieve(self, db_session: Session):
        cs = ClassroomSession(
            code="AB3X9K",
            teacher_ip="192.168.1.100",
            student_count_peak=5,
        )
        db_session.add(cs)
        db_session.commit()
        db_session.refresh(cs)

        fetched = db_session.get(ClassroomSession, cs.id)
        assert fetched is not None
        assert fetched.code == "AB3X9K"
        assert fetched.teacher_ip == "192.168.1.100"
        assert fetched.student_count_peak == 5

    def test_ended_at_defaults_to_none(self, db_session: Session):
        cs = ClassroomSession(code="DEMO01")
        db_session.add(cs)
        db_session.commit()
        db_session.refresh(cs)
        assert cs.ended_at is None

    def test_multiple_records(self, db_session: Session):
        for i, code in enumerate(["AAA001", "BBB002", "CCC003"]):
            db_session.add(ClassroomSession(code=code, student_count_peak=i))
        db_session.commit()

        from sqlmodel import select
        results = db_session.exec(select(ClassroomSession)).all()
        assert len(results) == 3
