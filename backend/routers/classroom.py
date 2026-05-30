"""Phase 3 — WebSocket classroom endpoints.

Teacher connects via WS /classroom/teacher/{code}, sends text or LaTeX,
receives translated Braille. All students on the same session code receive
the dot patterns in real time.

Layer contract:
- Translation is done by translator.py service — not inline here.
- HAL is not called from this layer — dot_patterns go over the wire.
- No business logic in route handlers (CLAUDE.md rule).
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlmodel import Session

from backend.core.db import get_session as get_db_session  # avoid clash with the
                                                            # GET /sessions/{code} handler named get_session
from backend.models.database import AssessmentQuestion
from backend.models.schemas import AssessmentSubmitResponse
from backend.routers.assessment import build_question, grade_core
from backend.services.session_manager import manager
from backend.services.translator import BrailleGrade, translate_math, translate_text

router = APIRouter(prefix="/classroom", tags=["classroom"])

# Internal owner id for class-wide questions (per-student BKT updates happen at
# answer time under each real student_id).
_CLASS_OWNER = "__classroom__"


# ---------------------------------------------------------------------------
# REST — session lifecycle
# ---------------------------------------------------------------------------

@router.post("/sessions")
async def create_session() -> dict:
    """Create a new classroom session and return its join code."""
    code = manager.create_session()
    return {
        "code": code,
        "teacher_url": f"/classroom/teacher/{code}",
        "student_url": f"/classroom/student/{code}",
    }


@router.get("/sessions/{code}")
async def get_session(code: str) -> dict:
    """Return session status: teacher connected, student count, last pattern."""
    info = manager.get_session_info(code)
    if "error" in info:
        raise HTTPException(status_code=404, detail=info["error"])
    return info


@router.delete("/sessions/{code}")
async def delete_session(code: str) -> dict:
    """Remove a session and disconnect all clients."""
    if code not in manager.sessions:
        raise HTTPException(status_code=404, detail="session not found")
    del manager.sessions[code]
    return {"deleted": code}


# ---------------------------------------------------------------------------
# Phase 4 — connected classroom: broadcast math + live assessment
# ---------------------------------------------------------------------------

class BroadcastMathRequest(BaseModel):
    latex: str = Field(..., min_length=1, max_length=5000)
    generate_assessment: bool = True


class ClassroomAnswerRequest(BaseModel):
    student_id: str = Field(..., min_length=1, max_length=128)
    question_id: str
    selected_index: int = Field(..., ge=0, le=3)


@router.post("/sessions/{code}/broadcast-math")
async def broadcast_math(
    code: str,
    req: BroadcastMathRequest,
    session: Session = Depends(get_db_session),
) -> dict:
    """Broadcast a math expression to a session as Braille, and (optionally) an MCQ.

    1. Translate LaTeX → Nemeth and broadcast dot patterns to all students.
    2. If generate_assessment: generate one MCQ, persist it, and broadcast it as
       an "assessment_question" so every student gets the question simultaneously.
    """
    sess = manager.sessions.get(code)
    if sess is None:
        raise HTTPException(status_code=404, detail="session not found")

    try:
        result = translate_math(req.latex)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    await manager.broadcast_pattern(code, result.dot_patterns)

    question_id: str | None = None
    assessment_generated = False
    if req.generate_assessment:
        gen = build_question(session, req.latex, student_id=_CLASS_OWNER, session_id=code)
        await manager.broadcast_assessment(code, {
            "question_id": gen.question_id,
            "question_text": gen.question_text,
            "expression_braille": gen.expression_braille,
            "choices": [c.model_dump() for c in gen.choices],
            "skill": gen.skill,
        })
        question_id = gen.question_id
        assessment_generated = True

    return {
        "braille_broadcast": True,
        "assessment_generated": assessment_generated,
        "question_id": question_id,
        "student_count": len(sess.student_ws_list),
    }


@router.post("/sessions/{code}/submit-answer", response_model=AssessmentSubmitResponse)
async def submit_answer(
    code: str,
    req: ClassroomAnswerRequest,
    session: Session = Depends(get_db_session),
) -> AssessmentSubmitResponse:
    """A student answers the session's current MCQ; update their BKT + class aggregates."""
    if code not in manager.sessions:
        raise HTTPException(status_code=404, detail="session not found")

    row = session.get(AssessmentQuestion, req.question_id)
    if row is None:
        raise HTTPException(status_code=404, detail="question_id not found")
    if row.session_id != code:
        raise HTTPException(status_code=404, detail="question does not belong to this session")
    if manager.has_answered(code, req.student_id):
        raise HTTPException(status_code=409, detail="student already answered this question")

    resp = grade_core(session, row, req.student_id, req.selected_index)
    await manager.record_student_answer(
        code, req.student_id, req.question_id, req.selected_index,
        resp.correct, resp.p_knows_after,
    )
    await manager.notify_teacher_performance(code)
    return resp


@router.get("/sessions/{code}/performance")
async def session_performance(code: str) -> dict:
    """Aggregated live class performance for the teacher dashboard (poll every ~5s)."""
    perf = manager.get_session_performance(code)
    if "error" in perf:
        raise HTTPException(status_code=404, detail=perf["error"])
    return perf


# ---------------------------------------------------------------------------
# WebSocket — teacher
# ---------------------------------------------------------------------------

@router.websocket("/teacher/{code}")
async def teacher_ws(websocket: WebSocket, code: str) -> None:
    """Teacher WebSocket endpoint.

    Expects JSON messages in one of two forms:
        {"text": "hello world", "grade": "grade1"}   — plain text
        {"latex": "x^2 + 3x + 2 = 0"}               — math expression

    On each message: translates → broadcasts dot_patterns to all students.
    On disconnect: removes teacher from session, cleans up if empty.
    """
    await websocket.accept()

    session = manager.sessions.get(code)
    if session is None:
        await websocket.close(code=4004)
        return

    await manager.join_session(code, websocket, "teacher")

    try:
        while True:
            data = await websocket.receive_json()

            try:
                if "latex" in data:
                    result = translate_math(data["latex"])
                elif "text" in data:
                    grade_str = data.get("grade", "grade1")
                    grade = BrailleGrade(grade_str) if grade_str in ("grade1", "grade2") else BrailleGrade.GRADE_1
                    result = translate_text(data["text"], grade)
                else:
                    await websocket.send_json({"error": "send {text:...} or {latex:...}"})
                    continue
            except (RuntimeError, ValueError) as exc:
                await websocket.send_json({"error": str(exc)})
                continue

            reached = await manager.broadcast_pattern(code, result.dot_patterns)
            await websocket.send_json({
                "event": "sent",
                "dot_patterns": result.dot_patterns,
                "cell_count": result.cell_count,
                "students_reached": reached,
            })

    except WebSocketDisconnect:
        await manager.leave_session(code, websocket)
        manager.cleanup_empty_sessions()


# ---------------------------------------------------------------------------
# WebSocket — student
# ---------------------------------------------------------------------------

@router.websocket("/student/{code}")
async def student_ws(websocket: WebSocket, code: str) -> None:
    """Student WebSocket endpoint.

    On connect: immediately sends the last known pattern (late-join sync).
    On teacher broadcast: receives {"event": "pattern", "dot_patterns": [...]}.
    On disconnect: removes from session, cleans up if empty.
    """
    await websocket.accept()

    session = manager.sessions.get(code)
    if session is None:
        await websocket.close(code=4004)
        return

    await manager.join_session(code, websocket, "student")

    # Late-join sync: restore the current Braille pattern AND any active MCQ.
    await manager.sync_late_joiner(code, websocket)

    try:
        # Students only receive; hold the connection open.
        while True:
            await websocket.receive_text()  # waits; raises on disconnect
    except WebSocketDisconnect:
        await manager.leave_session(code, websocket)
        manager.cleanup_empty_sessions()
