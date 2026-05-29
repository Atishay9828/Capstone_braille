"""Integration tests for all Braillix API endpoints.

- /health and GET / always return 200 (no liblouis dependency).
- /translate and /translate-math may return 503 if liblouis is not installed;
  tests accept both 200 and 503 for those endpoints.
- /translate/cam-angles has no liblouis dependency and always returns 200.
"""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Health / root
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestHealthEndpoint:
    async def test_health_returns_200(self, test_client: AsyncClient) -> None:
        resp = await test_client.get("/health")
        assert resp.status_code == 200

    async def test_health_has_status_field(self, test_client: AsyncClient) -> None:
        data = (await test_client.get("/health")).json()
        assert "status" in data
        assert data["status"] in ("ok", "degraded")

    async def test_health_has_tables_field(self, test_client: AsyncClient) -> None:
        data = (await test_client.get("/health")).json()
        assert "tables" in data
        assert isinstance(data["tables"], dict)

    async def test_health_has_liblouis_available_field(self, test_client: AsyncClient) -> None:
        data = (await test_client.get("/health")).json()
        assert "liblouis_available" in data
        assert isinstance(data["liblouis_available"], bool)

    async def test_root_returns_200(self, test_client: AsyncClient) -> None:
        resp = await test_client.get("/")
        assert resp.status_code == 200

    async def test_root_has_service_field(self, test_client: AsyncClient) -> None:
        data = (await test_client.get("/")).json()
        assert data["service"] == "Braillix API"
        assert "docs" in data
        assert "health" in data


# ---------------------------------------------------------------------------
# POST /translate
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestTranslateTextEndpoint:
    async def test_valid_request_accepted(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": "hello"})
        assert resp.status_code in (200, 503)

    async def test_response_structure_when_200(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": "hello"})
        if resp.status_code == 200:
            data = resp.json()
            assert "input" in data
            assert "grade" in data
            assert "braille_unicode" in data
            assert "dot_patterns" in data
            assert isinstance(data["dot_patterns"], list)
            assert "cell_count" in data

    async def test_empty_text_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": ""})
        assert resp.status_code == 422

    async def test_whitespace_only_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": "   "})
        assert resp.status_code == 422

    async def test_invalid_grade_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": "hi", "grade": "grade99"})
        assert resp.status_code == 422

    async def test_missing_text_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"grade": "grade1"})
        assert resp.status_code == 422

    async def test_default_grade_is_grade1(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": "hi"})
        if resp.status_code == 200:
            assert resp.json()["grade"] == "grade1"

    async def test_grade2_accepted(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": "hi", "grade": "grade2"})
        assert resp.status_code in (200, 503)

    async def test_grade1_explicit(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": "hi", "grade": "grade1"})
        assert resp.status_code in (200, 503)

    async def test_dot_patterns_in_range_when_200(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": "abc"})
        if resp.status_code == 200:
            for p in resp.json()["dot_patterns"]:
                assert 0 <= p <= 63

    async def test_cell_count_matches_dot_patterns_when_200(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate", json={"text": "abc"})
        if resp.status_code == 200:
            data = resp.json()
            assert data["cell_count"] == len(data["dot_patterns"])


# ---------------------------------------------------------------------------
# POST /translate-math
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestTranslateMathEndpoint:
    async def test_valid_latex_accepted(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate-math", json={"latex": "x^2 + 1 = 0"})
        assert resp.status_code in (200, 503)

    async def test_response_structure_when_200(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate-math", json={"latex": "x"})
        if resp.status_code == 200:
            data = resp.json()
            assert "input_latex" in data
            assert "braille_unicode" in data
            assert "dot_patterns" in data
            assert "cell_count" in data

    async def test_dollar_signs_stripped(self, test_client: AsyncClient) -> None:
        # "$x^2$" → strips to "x^2" before processing; must not be rejected at 422.
        resp = await test_client.post("/translate-math", json={"latex": "$x^2$"})
        assert resp.status_code in (200, 503)

    async def test_double_dollar_signs_stripped(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate-math", json={"latex": "$$x + 1$$"})
        assert resp.status_code in (200, 503)

    async def test_empty_latex_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate-math", json={"latex": ""})
        assert resp.status_code == 422

    async def test_dollar_only_rejected(self, test_client: AsyncClient) -> None:
        # "$$" after stripping becomes "" which is too short.
        resp = await test_client.post("/translate-math", json={"latex": "$$"})
        assert resp.status_code == 422

    async def test_missing_latex_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post("/translate-math", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /translate/cam-angles  (no liblouis dependency — always 200)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestCamAnglesEndpoint:
    async def test_known_patterns(self, test_client: AsyncClient) -> None:
        resp = await test_client.post(
            "/translate/cam-angles", json={"dot_patterns": [0, 1, 63]}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["angles_degrees"] == pytest.approx([0.0, 5.625, 354.375])

    async def test_blank_pattern(self, test_client: AsyncClient) -> None:
        resp = await test_client.post(
            "/translate/cam-angles", json={"dot_patterns": [0]}
        )
        assert resp.status_code == 200
        assert resp.json()["angles_degrees"] == pytest.approx([0.0])

    async def test_all_64_patterns_valid(self, test_client: AsyncClient) -> None:
        resp = await test_client.post(
            "/translate/cam-angles", json={"dot_patterns": list(range(64))}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["cell_count"] == 64
        assert len(data["angles_degrees"]) == 64

    async def test_pattern_64_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post(
            "/translate/cam-angles", json={"dot_patterns": [64]}
        )
        assert resp.status_code == 422

    async def test_pattern_negative_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post(
            "/translate/cam-angles", json={"dot_patterns": [-1]}
        )
        assert resp.status_code == 422

    async def test_empty_list_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post(
            "/translate/cam-angles", json={"dot_patterns": []}
        )
        assert resp.status_code == 422

    async def test_cell_count_matches_input_length(self, test_client: AsyncClient) -> None:
        patterns = [0, 10, 20, 30]
        resp = await test_client.post(
            "/translate/cam-angles", json={"dot_patterns": patterns}
        )
        assert resp.status_code == 200
        assert resp.json()["cell_count"] == len(patterns)

    async def test_dot_patterns_echoed_in_response(self, test_client: AsyncClient) -> None:
        patterns = [0, 1, 2]
        resp = await test_client.post(
            "/translate/cam-angles", json={"dot_patterns": patterns}
        )
        assert resp.status_code == 200
        assert resp.json()["dot_patterns"] == patterns

    async def test_mixed_valid_invalid_rejected(self, test_client: AsyncClient) -> None:
        resp = await test_client.post(
            "/translate/cam-angles", json={"dot_patterns": [0, 1, 64]}
        )
        assert resp.status_code == 422
