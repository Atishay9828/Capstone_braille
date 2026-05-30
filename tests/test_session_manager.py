"""Unit tests for SessionManager.

All tests use MockWebSocket — no actual network connections needed.
"""

import asyncio
import pytest

from backend.services.session_manager import Session, SessionManager


# ---------------------------------------------------------------------------
# Mock WebSocket
# ---------------------------------------------------------------------------

class MockWebSocket:
    """Minimal WebSocket stub satisfying WebSocketLike protocol."""

    def __init__(self, client_id: str = "mock") -> None:
        self._id = client_id
        self.sent: list[dict] = []
        self.closed = False
        self._fail_on_send = False

    async def send_json(self, data: dict) -> None:
        if self.closed or self._fail_on_send:
            raise RuntimeError(f"WebSocket {self._id!r} is closed")
        self.sent.append(data)

    async def close(self, code: int = 1000) -> None:
        self.closed = True

    async def accept(self) -> None:
        pass


# ---------------------------------------------------------------------------
# create_session
# ---------------------------------------------------------------------------

class TestCreateSession:
    def test_returns_six_char_code(self):
        sm = SessionManager()
        code = sm.create_session()
        assert len(code) == 6

    def test_code_is_alphanumeric(self):
        sm = SessionManager()
        code = sm.create_session()
        assert code.isalnum()
        assert code == code.upper()

    def test_codes_are_unique(self):
        sm = SessionManager()
        codes = {sm.create_session() for _ in range(50)}
        assert len(codes) == 50

    def test_session_stored_in_sessions_dict(self):
        sm = SessionManager()
        code = sm.create_session()
        assert code in sm.sessions
        assert isinstance(sm.sessions[code], Session)


# ---------------------------------------------------------------------------
# join_session
# ---------------------------------------------------------------------------

class TestJoinSession:
    async def test_teacher_join_returns_true(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWebSocket("teacher")
        result = await sm.join_session(code, ws, "teacher")
        assert result is True

    async def test_teacher_stored_on_session(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWebSocket("teacher")
        await sm.join_session(code, ws, "teacher")
        assert sm.sessions[code].teacher_ws is ws

    async def test_student_join_returns_true(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWebSocket("student")
        result = await sm.join_session(code, ws, "student")
        assert result is True

    async def test_student_added_to_list(self):
        sm = SessionManager()
        code = sm.create_session()
        ws1, ws2 = MockWebSocket("s1"), MockWebSocket("s2")
        await sm.join_session(code, ws1, "student")
        await sm.join_session(code, ws2, "student")
        assert ws1 in sm.sessions[code].student_ws_list
        assert ws2 in sm.sessions[code].student_ws_list

    async def test_invalid_code_returns_false(self):
        sm = SessionManager()
        ws = MockWebSocket()
        result = await sm.join_session("ZZZZZZ", ws, "student")
        assert result is False


# ---------------------------------------------------------------------------
# broadcast_pattern
# ---------------------------------------------------------------------------

class TestBroadcastPattern:
    async def test_reaches_all_students(self):
        sm = SessionManager()
        code = sm.create_session()
        students = [MockWebSocket(f"s{i}") for i in range(3)]
        for ws in students:
            await sm.join_session(code, ws, "student")

        reached = await sm.broadcast_pattern(code, [1, 2, 3])
        assert reached == 3

    async def test_payload_contains_dot_patterns(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWebSocket("s1")
        await sm.join_session(code, ws, "student")

        await sm.broadcast_pattern(code, [19, 10])
        assert ws.sent[-1] == {"event": "pattern", "dot_patterns": [19, 10]}

    async def test_updates_last_pattern(self):
        sm = SessionManager()
        code = sm.create_session()
        await sm.broadcast_pattern(code, [5, 6, 7])
        assert sm.sessions[code].last_pattern == [5, 6, 7]

    async def test_dead_students_removed(self):
        sm = SessionManager()
        code = sm.create_session()
        dead = MockWebSocket("dead")
        dead._fail_on_send = True
        live = MockWebSocket("live")

        await sm.join_session(code, dead, "student")
        await sm.join_session(code, live, "student")

        reached = await sm.broadcast_pattern(code, [1])
        assert reached == 1
        assert dead not in sm.sessions[code].student_ws_list
        assert live in sm.sessions[code].student_ws_list

    async def test_returns_zero_for_missing_session(self):
        sm = SessionManager()
        reached = await sm.broadcast_pattern("XXXXXX", [1, 2])
        assert reached == 0


# ---------------------------------------------------------------------------
# leave_session
# ---------------------------------------------------------------------------

class TestLeaveSession:
    async def test_teacher_leave_clears_teacher_ws(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWebSocket("teacher")
        await sm.join_session(code, ws, "teacher")
        await sm.leave_session(code, ws)
        assert sm.sessions[code].teacher_ws is None

    async def test_student_leave_removes_from_list(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWebSocket("student")
        await sm.join_session(code, ws, "student")
        await sm.leave_session(code, ws)
        assert ws not in sm.sessions[code].student_ws_list

    async def test_leave_nonexistent_session_is_noop(self):
        sm = SessionManager()
        ws = MockWebSocket()
        await sm.leave_session("ZZZZZZ", ws)  # must not raise

    async def test_other_students_unaffected(self):
        sm = SessionManager()
        code = sm.create_session()
        ws1, ws2 = MockWebSocket("s1"), MockWebSocket("s2")
        await sm.join_session(code, ws1, "student")
        await sm.join_session(code, ws2, "student")
        await sm.leave_session(code, ws1)
        assert ws2 in sm.sessions[code].student_ws_list


# ---------------------------------------------------------------------------
# cleanup_empty_sessions
# ---------------------------------------------------------------------------

class TestCleanupEmptySessions:
    def test_removes_sessions_with_no_connections(self):
        sm = SessionManager()
        code = sm.create_session()
        sm.cleanup_empty_sessions()
        assert code not in sm.sessions

    async def test_keeps_sessions_with_teacher(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWebSocket("teacher")
        await sm.join_session(code, ws, "teacher")
        sm.cleanup_empty_sessions()
        assert code in sm.sessions

    async def test_keeps_sessions_with_students(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWebSocket("student")
        await sm.join_session(code, ws, "student")
        sm.cleanup_empty_sessions()
        assert code in sm.sessions

    async def test_only_removes_empty_sessions(self):
        sm = SessionManager()
        empty_code = sm.create_session()
        active_code = sm.create_session()
        ws = MockWebSocket("teacher")
        await sm.join_session(active_code, ws, "teacher")
        sm.cleanup_empty_sessions()
        assert empty_code not in sm.sessions
        assert active_code in sm.sessions


# ---------------------------------------------------------------------------
# get_session_info
# ---------------------------------------------------------------------------

class TestGetSessionInfo:
    def test_missing_session_returns_error(self):
        sm = SessionManager()
        info = sm.get_session_info("ZZZZZZ")
        assert "error" in info

    async def test_info_has_expected_keys(self):
        sm = SessionManager()
        code = sm.create_session()
        ws = MockWebSocket("teacher")
        await sm.join_session(code, ws, "teacher")
        info = sm.get_session_info(code)
        assert "code" in info
        assert "teacher_connected" in info
        assert "student_count" in info
        assert "last_pattern" in info
        assert info["teacher_connected"] is True
        assert info["student_count"] == 0
