"""Integration tests for the Phase 3 adaptive assessment endpoints.

Uses an isolated in-memory SQLite database (shared across requests within a
test via StaticPool) by overriding the get_session dependency.

The MCQ generator is deterministic, so a test can compute the expected correct
index for a given expression without the /generate endpoint ever leaking it.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from backend.core.db import get_session
from backend.main import app
from backend.services.mcq_generator import generate_mcq

LINEAR = "2x + 3 = 7"  # -> x = 2


@pytest_asyncio.fixture
async def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # one shared in-memory DB for the whole test
    )
    SQLModel.metadata.create_all(engine)

    def _override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
    SQLModel.metadata.drop_all(engine)


async def _generate(client, latex=LINEAR, student="s1"):
    r = await client.post("/assessment/generate",
                          json={"latex": latex, "student_id": student})
    assert r.status_code == 200, r.text
    return r.json()


def _correct_index(latex: str) -> int:
    return generate_mcq(latex).correct_index


# ---------------------------------------------------------------------------
# /generate
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestGenerate:
    async def test_returns_4_choices(self, client):
        data = await _generate(client)
        assert len(data["choices"]) == 4
        assert data["question_id"]

    async def test_choices_have_braille_and_text(self, client):
        data = await _generate(client)
        for i, ch in enumerate(data["choices"]):
            assert ch["index"] == i
            assert isinstance(ch["text"], str) and ch["text"]
            assert "braille" in ch and isinstance(ch["braille"], str)

    async def test_does_not_leak_correct_index(self, client):
        data = await _generate(client)
        assert "correct_index" not in data  # the answer must not be exposed here

    async def test_expression_and_question_present(self, client):
        data = await _generate(client)
        assert data["expression"] == LINEAR
        assert data["question_text"].lower().startswith("solve for x")
        assert data["skill"] == "linear"


# ---------------------------------------------------------------------------
# /submit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestSubmit:
    async def test_correct_answer_returns_true(self, client):
        data = await _generate(client)
        idx = _correct_index(LINEAR)
        r = await client.post("/assessment/submit", json={
            "question_id": data["question_id"], "student_id": "s1", "selected_index": idx,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["correct"] is True
        assert body["correct_answer_text"] == "x = 2"

    async def test_wrong_answer_returns_false(self, client):
        data = await _generate(client)
        wrong = (_correct_index(LINEAR) + 1) % 4
        r = await client.post("/assessment/submit", json={
            "question_id": data["question_id"], "student_id": "s1", "selected_index": wrong,
        })
        body = r.json()
        assert body["correct"] is False
        assert "Common error" in body["explanation"]

    async def test_correct_updates_bkt_upward(self, client):
        data = await _generate(client)
        idx = _correct_index(LINEAR)
        body = (await client.post("/assessment/submit", json={
            "question_id": data["question_id"], "student_id": "s1", "selected_index": idx,
        })).json()
        assert body["p_knows_after"] > body["p_knows_before"]
        assert body["skill"] == "linear"
        assert 0.0 <= body["next_recommended_difficulty"] <= 1.0

    async def test_wrong_updates_bkt_downward(self, client):
        data = await _generate(client)
        wrong = (_correct_index(LINEAR) + 1) % 4
        body = (await client.post("/assessment/submit", json={
            "question_id": data["question_id"], "student_id": "s1", "selected_index": wrong,
        })).json()
        assert body["p_knows_after"] < body["p_knows_before"]

    async def test_returns_explanation_and_recommendation(self, client):
        data = await _generate(client)
        idx = _correct_index(LINEAR)
        body = (await client.post("/assessment/submit", json={
            "question_id": data["question_id"], "student_id": "s1", "selected_index": idx,
        })).json()
        assert body["explanation"].startswith("Correct")
        assert "linear" in body["recommendation"]

    async def test_unknown_question_id_404(self, client):
        r = await client.post("/assessment/submit", json={
            "question_id": "does-not-exist", "student_id": "s1", "selected_index": 0,
        })
        assert r.status_code == 404

    async def test_cannot_submit_twice_409(self, client):
        data = await _generate(client)
        payload = {"question_id": data["question_id"], "student_id": "s1", "selected_index": 0}
        first = await client.post("/assessment/submit", json=payload)
        assert first.status_code == 200
        second = await client.post("/assessment/submit", json=payload)
        assert second.status_code == 409

    async def test_selected_index_out_of_range_422(self, client):
        data = await _generate(client)
        r = await client.post("/assessment/submit", json={
            "question_id": data["question_id"], "student_id": "s1", "selected_index": 5,
        })
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# /student/{id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestStudentProfile:
    async def test_initial_profile_empty(self, client):
        r = await client.get("/assessment/student/newbie")
        assert r.status_code == 200
        body = r.json()
        assert body["skills"] == {}
        assert body["overall_mastery"] == 0.0
        assert body["total_questions"] == 0

    async def test_profile_accumulates_across_questions(self, client):
        # Answer two linear questions correctly.
        for _ in range(2):
            data = await _generate(client, student="learner")
            idx = _correct_index(LINEAR)
            await client.post("/assessment/submit", json={
                "question_id": data["question_id"], "student_id": "learner", "selected_index": idx,
            })
        r = await client.get("/assessment/student/learner")
        body = r.json()
        assert "linear" in body["skills"]
        assert body["skills"]["linear"]["attempts"] == 2
        assert body["skills"]["linear"]["correct"] == 2
        assert body["total_questions"] == 2
        assert body["overall_mastery"] > 0.3  # two corrects lifted mastery
