"""Phase 4 — classroom × assessment integration tests.

Covers both layers:
  - SessionManager: broadcast_assessment, record_student_answer, performance
    aggregates, late-join question sync, teacher performance push.
  - REST: /broadcast-math, /submit-answer, /performance, wired to the shared
    `manager` singleton and an in-memory DB.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from backend.core.db import get_session
from backend.main import app
from backend.services.mcq_generator import generate_mcq
from backend.services.session_manager import SessionManager, manager

LATEX = "x^2 + 3x + 2 = 0"


class MockWS:
    def __init__(self, name="ws"):
        self.name = name
        self.sent: list[dict] = []
        self._fail = False

    async def send_json(self, data: dict) -> None:
        if self._fail:
            raise RuntimeError("closed")
        self.sent.append(data)

    async def close(self, code: int = 1000) -> None:
        pass


def _question_payload(qid="q1", skill="quadratic"):
    return {"question_id": qid, "question_text": "Roots?", "expression_braille": "X",
            "choices": [{"index": 0, "text": "a", "braille": "A"}], "skill": skill}


# ---------------------------------------------------------------------------
# SessionManager-level
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestSessionManagerAssessment:
    async def test_broadcast_assessment_sends_typed_message(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWS("s1")
        await sm.join_session(code, ws, "student")
        reached = await sm.broadcast_assessment(code, _question_payload())
        assert reached == 1
        assert ws.sent[-1]["type"] == "assessment_question"
        assert ws.sent[-1]["question_id"] == "q1"

    async def test_broadcast_assessment_resets_responses(self):
        sm = SessionManager()
        code = sm.create_session()
        await sm.record_student_answer(code, "alice", "qOld", 0, True, 0.5)
        await sm.broadcast_assessment(code, _question_payload(qid="qNew"))
        assert sm.sessions[code].responses == {}

    async def test_record_answer_updates_aggregates(self):
        sm = SessionManager()
        code = sm.create_session()
        await sm.broadcast_assessment(code, _question_payload(qid="q1"))
        await sm.record_student_answer(code, "alice", "q1", 0, True, 0.4)
        await sm.record_student_answer(code, "bob", "q1", 1, False, 0.1)
        perf = sm.get_session_performance(code)
        assert perf["total_responses"] == 2
        assert perf["correct_responses"] == 1
        assert perf["pct_correct"] == 50.0
        assert len(perf["student_breakdown"]) == 2

    async def test_has_answered_dedupe(self):
        sm = SessionManager()
        code = sm.create_session()
        await sm.broadcast_assessment(code, _question_payload())
        assert sm.has_answered(code, "alice") is False
        await sm.record_student_answer(code, "alice", "q1", 0, True, 0.4)
        assert sm.has_answered(code, "alice") is True

    async def test_late_join_receives_current_question(self):
        sm = SessionManager()
        code = sm.create_session()
        await sm.broadcast_assessment(code, _question_payload(qid="qLive"))
        late = MockWS("late")
        await sm.join_session(code, late, "student")
        await sm.sync_late_joiner(code, late)
        assert any(m.get("type") == "assessment_question" and m["question_id"] == "qLive"
                   for m in late.sent)

    async def test_notify_teacher_performance_sends_to_teacher(self):
        sm = SessionManager()
        code = sm.create_session()
        teacher = MockWS("teacher")
        await sm.join_session(code, teacher, "teacher")
        await sm.broadcast_assessment(code, _question_payload())
        await sm.record_student_answer(code, "alice", "q1", 0, True, 0.4)
        ok = await sm.notify_teacher_performance(code)
        assert ok is True
        assert teacher.sent[-1]["type"] == "class_performance"
        assert teacher.sent[-1]["total_responses"] == 1

    async def test_performance_missing_session_returns_error(self):
        sm = SessionManager()
        assert "error" in sm.get_session_performance("NOPE12")

    async def test_broadcast_assessment_drops_dead_student(self):
        sm = SessionManager()
        code = sm.create_session()
        dead, live = MockWS("dead"), MockWS("live")
        dead._fail = True
        await sm.join_session(code, dead, "student")
        await sm.join_session(code, live, "student")
        reached = await sm.broadcast_assessment(code, _question_payload())
        assert reached == 1
        assert dead not in sm.sessions[code].student_ws_list
        assert live in sm.sessions[code].student_ws_list


# ---------------------------------------------------------------------------
# REST-level
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def _override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _override
    manager.sessions.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
    manager.sessions.clear()
    SQLModel.metadata.drop_all(engine)


async def _new_session(client) -> str:
    r = await client.post("/classroom/sessions")
    assert r.status_code == 200
    return r.json()["code"]


@pytest.mark.asyncio
class TestClassroomRESTIntegration:
    async def test_broadcast_math_generates_assessment(self, client):
        code = await _new_session(client)
        r = await client.post(f"/classroom/sessions/{code}/broadcast-math",
                              json={"latex": LATEX, "generate_assessment": True})
        if r.status_code == 503:
            pytest.skip("liblouis unavailable")
        assert r.status_code == 200
        data = r.json()
        assert data["braille_broadcast"] is True
        assert data["assessment_generated"] is True
        assert data["question_id"]
        assert manager.sessions[code].current_question["question_id"] == data["question_id"]

    async def test_broadcast_math_skips_assessment_when_flag_false(self, client):
        code = await _new_session(client)
        r = await client.post(f"/classroom/sessions/{code}/broadcast-math",
                              json={"latex": LATEX, "generate_assessment": False})
        if r.status_code == 503:
            pytest.skip("liblouis unavailable")
        data = r.json()
        assert data["assessment_generated"] is False
        assert data["question_id"] is None
        assert manager.sessions[code].current_question is None

    async def test_submit_answer_updates_session_aggregates(self, client):
        code = await _new_session(client)
        b = await client.post(f"/classroom/sessions/{code}/broadcast-math",
                              json={"latex": LATEX, "generate_assessment": True})
        if b.status_code == 503:
            pytest.skip("liblouis unavailable")
        qid = b.json()["question_id"]
        correct_idx = generate_mcq(LATEX).correct_index
        s = await client.post(f"/classroom/sessions/{code}/submit-answer",
                              json={"student_id": "alice", "question_id": qid,
                                    "selected_index": correct_idx})
        assert s.status_code == 200
        assert s.json()["correct"] is True

        perf = (await client.get(f"/classroom/sessions/{code}/performance")).json()
        assert perf["total_responses"] == 1
        assert perf["correct_responses"] == 1
        assert perf["pct_correct"] == 100.0

    async def test_performance_endpoint_returns_aggregates(self, client):
        code = await _new_session(client)
        r = await client.get(f"/classroom/sessions/{code}/performance")
        assert r.status_code == 200
        assert r.json()["total_responses"] == 0

    async def test_performance_unknown_session_404(self, client):
        r = await client.get("/classroom/sessions/ZZZZZZ/performance")
        assert r.status_code == 404

    async def test_broadcast_math_unknown_session_404(self, client):
        r = await client.post("/classroom/sessions/ZZZZZZ/broadcast-math",
                              json={"latex": LATEX, "generate_assessment": True})
        assert r.status_code == 404

    async def test_cannot_answer_question_from_different_session(self, client):
        code_a = await _new_session(client)
        code_b = await _new_session(client)
        b = await client.post(f"/classroom/sessions/{code_a}/broadcast-math",
                              json={"latex": LATEX, "generate_assessment": True})
        if b.status_code == 503:
            pytest.skip("liblouis unavailable")
        qid = b.json()["question_id"]
        # Submit session A's question to session B → rejected.
        r = await client.post(f"/classroom/sessions/{code_b}/submit-answer",
                              json={"student_id": "alice", "question_id": qid, "selected_index": 0})
        assert r.status_code == 404

    async def test_double_answer_rejected_409(self, client):
        code = await _new_session(client)
        b = await client.post(f"/classroom/sessions/{code}/broadcast-math",
                              json={"latex": LATEX, "generate_assessment": True})
        if b.status_code == 503:
            pytest.skip("liblouis unavailable")
        qid = b.json()["question_id"]
        payload = {"student_id": "alice", "question_id": qid, "selected_index": 0}
        first = await client.post(f"/classroom/sessions/{code}/submit-answer", json=payload)
        assert first.status_code == 200
        second = await client.post(f"/classroom/sessions/{code}/submit-answer", json=payload)
        assert second.status_code == 409

    async def test_class_performance_pushed_to_teacher_channel(self, client):
        code = await _new_session(client)
        teacher = MockWS("teacher")
        manager.sessions[code].teacher_ws = teacher  # attach a teacher WS directly
        b = await client.post(f"/classroom/sessions/{code}/broadcast-math",
                              json={"latex": LATEX, "generate_assessment": True})
        if b.status_code == 503:
            pytest.skip("liblouis unavailable")
        qid = b.json()["question_id"]
        await client.post(f"/classroom/sessions/{code}/submit-answer",
                          json={"student_id": "alice", "question_id": qid, "selected_index": 0})
        assert any(m.get("type") == "class_performance" for m in teacher.sent)
