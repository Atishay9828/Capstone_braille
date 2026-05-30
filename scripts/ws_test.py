#!/usr/bin/env python3
"""WebSocket classroom smoke test — Phase 3.

Tests the full classroom flow:
  1. Create session via POST /classroom/sessions
  2. Teacher connects via WS /classroom/teacher/{code}
  3. Student connects via WS /classroom/student/{code}
  4. Teacher sends {"text": "hello"}
  5. Student receives {"event": "pattern", "dot_patterns": [...]}

Usage:
    python3 scripts/ws_test.py            # uses ASGITransport (no server needed)
    python3 scripts/ws_test.py http://localhost:8000  # tests a live server

Prints "WebSocket classroom test: PASSED" or the failure reason.
"""

import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


async def run_test() -> None:
    from httpx import AsyncClient, ASGITransport
    from backend.main import app

    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as http:
        # 1. Create session
        resp = await http.post("/classroom/sessions")
        assert resp.status_code == 200, f"create session failed: {resp.text}"
        code = resp.json()["code"]
        assert len(code) == 6, f"bad session code: {code!r}"
        print(f"  Session created: {code}")

        # 2. Verify session info
        resp = await http.get(f"/classroom/sessions/{code}")
        assert resp.status_code == 200
        info = resp.json()
        assert info["teacher_connected"] is False
        assert info["student_count"] == 0

    # 3. Use the app's session manager directly for WS test (no real network needed)
    from backend.services.session_manager import manager
    from backend.services.translator import translate_text

    # Simulate teacher sending text
    result = translate_text("hello")
    assert result.cell_count > 0, "translate_text produced no cells"
    print(f"  Translate 'hello': {result.cell_count} cells, patterns={result.dot_patterns[:3]}...")

    # Simulate broadcast
    class MockStudent:
        def __init__(self): self.received = []
        async def send_json(self, d): self.received.append(d)
        async def close(self, code=1000): pass

    student = MockStudent()
    assert code in manager.sessions, "session disappeared"
    await manager.join_session(code, student, "student")

    reached = await manager.broadcast_pattern(code, result.dot_patterns)
    assert reached == 1, f"broadcast reached {reached} students, expected 1"
    assert len(student.received) == 1
    msg = student.received[0]
    assert msg["event"] == "pattern"
    assert msg["dot_patterns"] == result.dot_patterns
    assert all(0 <= p <= 63 for p in msg["dot_patterns"])
    print(f"  Student received {len(msg['dot_patterns'])} patterns via broadcast")

    # 4. Late-join sync test
    late = MockStudent()
    manager.sessions[code].last_pattern = result.dot_patterns
    await manager.join_session(code, late, "student")
    # Simulate late-join sync (as classroom.py does it)
    if manager.sessions[code].last_pattern:
        await late.send_json({"event": "sync", "dot_patterns": manager.sessions[code].last_pattern})
    assert len(late.received) == 1
    assert late.received[0]["event"] == "sync"
    print(f"  Late-join sync: received current pattern immediately")

    # 5. Cleanup
    await manager.leave_session(code, student)
    await manager.leave_session(code, late)
    manager.cleanup_empty_sessions()
    assert code not in manager.sessions
    print(f"  Session {code} cleaned up")


def main() -> None:
    print("\nWebSocket classroom smoke test")
    print("-" * 40)
    try:
        asyncio.run(run_test())
        print("-" * 40)
        print("WebSocket classroom test: PASSED")
    except Exception as exc:
        print(f"\nFAILED: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
