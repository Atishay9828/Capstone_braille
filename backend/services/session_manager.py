"""WebSocket session manager for Braillix classroom mode (Phase 3).

In-memory session store — a Python dict is sufficient for demo-scale
(5–10 devices). No Redis needed for MVP.

Architecture:
  Teacher laptop = WebSocket server (this FastAPI app)
  Student Pi devices = WebSocket clients
  Session = one teacher + N students sharing the same display pattern

All methods that touch WebSocket connections are async.
"""

from __future__ import annotations

import asyncio
import random
import string
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol


class WebSocketLike(Protocol):
    """Minimal interface needed from a WebSocket connection."""

    async def send_json(self, data: dict) -> None: ...
    async def close(self, code: int = 1000) -> None: ...


@dataclass
class Session:
    code: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    teacher_ws: WebSocketLike | None = None
    student_ws_list: list[WebSocketLike] = field(default_factory=list)
    last_pattern: list[int] = field(default_factory=list)


class SessionManager:
    """Manages in-memory classroom sessions for the Braillix WebSocket server.

    Thread-safety note: FastAPI runs on a single async event loop. All
    operations are async and non-blocking, so no locking is needed.
    """

    _CODE_CHARS = string.ascii_uppercase + string.digits
    _CODE_LENGTH = 6

    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}

    # ---------------------------------------------------------------------------
    # Session lifecycle
    # ---------------------------------------------------------------------------

    def create_session(self) -> str:
        """Generate a unique 6-character session code and register it.

        Returns:
            Alphanumeric session code like "AB3X9K".
        """
        while True:
            code = "".join(random.choices(self._CODE_CHARS, k=self._CODE_LENGTH))
            if code not in self.sessions:
                self.sessions[code] = Session(code=code)
                return code

    async def join_session(
        self,
        code: str,
        websocket: WebSocketLike,
        role: str,
    ) -> bool:
        """Add a WebSocket connection to a session.

        Args:
            code: Session code (must already exist via create_session).
            websocket: The WebSocket connection to add.
            role: "teacher" or "student".

        Returns:
            True if joined successfully, False if session not found.
        """
        session = self.sessions.get(code)
        if session is None:
            return False

        if role == "teacher":
            session.teacher_ws = websocket
        else:
            session.student_ws_list.append(websocket)

        return True

    async def broadcast_pattern(
        self,
        code: str,
        dot_patterns: list[int],
    ) -> int:
        """Send dot patterns to every student in the session.

        Removes disconnected students silently — a broken pipe is not an error.

        Args:
            code: Session code.
            dot_patterns: List of 6-bit integers (0–63) per Braille cell.

        Returns:
            Number of students successfully reached.
        """
        session = self.sessions.get(code)
        if session is None:
            return 0

        session.last_pattern = dot_patterns
        payload = {"event": "pattern", "dot_patterns": dot_patterns}
        still_connected: list[WebSocketLike] = []
        reached = 0

        for ws in session.student_ws_list:
            try:
                await ws.send_json(payload)
                still_connected.append(ws)
                reached += 1
            except Exception:
                pass  # Dead connection — drop it silently

        session.student_ws_list = still_connected
        return reached

    async def leave_session(self, code: str, websocket: WebSocketLike) -> None:
        """Remove a WebSocket from a session (called on disconnect).

        Args:
            code: Session code.
            websocket: The disconnecting WebSocket.
        """
        session = self.sessions.get(code)
        if session is None:
            return

        if session.teacher_ws is websocket:
            session.teacher_ws = None

        session.student_ws_list = [
            ws for ws in session.student_ws_list if ws is not websocket
        ]

    def cleanup_empty_sessions(self) -> None:
        """Remove sessions that have no teacher and no students connected."""
        empty = [
            code
            for code, s in self.sessions.items()
            if s.teacher_ws is None and len(s.student_ws_list) == 0
        ]
        for code in empty:
            del self.sessions[code]

    def get_session_info(self, code: str) -> dict[str, Any]:
        """Return a JSON-serialisable status snapshot for a session.

        Args:
            code: Session code.

        Returns:
            dict with session metadata, or {"error": "not found"} if missing.
        """
        session = self.sessions.get(code)
        if session is None:
            return {"error": "session not found"}

        return {
            "code": session.code,
            "created_at": session.created_at.isoformat(),
            "teacher_connected": session.teacher_ws is not None,
            "student_count": len(session.student_ws_list),
            "last_pattern": session.last_pattern,
        }


# Module-level singleton used by the classroom router.
manager = SessionManager()
