"""Phase 3 — WebSocket classroom endpoints.

Teacher connects via WS /classroom/teacher/{code}, sends text or LaTeX,
receives translated Braille. All students on the same session code receive
the dot patterns in real time.

Layer contract:
- Translation is done by translator.py service — not inline here.
- HAL is not called from this layer — dot_patterns go over the wire.
- No business logic in route handlers (CLAUDE.md rule).
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from backend.services.session_manager import manager
from backend.services.translator import BrailleGrade, translate_math, translate_text

router = APIRouter(prefix="/classroom", tags=["classroom"])


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

    # Late-join sync: send current display pattern immediately
    if session.last_pattern:
        await websocket.send_json({
            "event": "sync",
            "dot_patterns": session.last_pattern,
        })

    try:
        # Students only receive; hold the connection open.
        while True:
            await websocket.receive_text()  # waits; raises on disconnect
    except WebSocketDisconnect:
        await manager.leave_session(code, websocket)
        manager.cleanup_empty_sessions()
