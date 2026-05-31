"""Tests for backend/services/knowledge_tracer.py (Bayesian Knowledge Tracing).

Includes a numerically hand-verified check of the exact BKT update formula.
"""

from datetime import datetime

import pytest

from backend.services.knowledge_tracer import (
    DEFAULT_BKT_PARAMS,
    KnowledgeTracer,
    StudentSkillState,
    params_for,
)


# ---------------------------------------------------------------------------
# Initial state
# ---------------------------------------------------------------------------

class TestInitialState:
    def test_initial_p_knows_is_L0(self):
        t = KnowledgeTracer("s1")
        assert t.get_p_knows("linear") == DEFAULT_BKT_PARAMS["linear"]["L0"]

    def test_unknown_skill_uses_default_params(self):
        t = KnowledgeTracer("s1")
        assert t.get_p_knows("calculus") == DEFAULT_BKT_PARAMS["default"]["L0"]
        assert params_for("calculus") is DEFAULT_BKT_PARAMS["default"]

    def test_no_skills_overall_mastery_zero(self):
        assert KnowledgeTracer("s1").overall_mastery() == 0.0


# ---------------------------------------------------------------------------
# BKT update direction + formula correctness
# ---------------------------------------------------------------------------

class TestBKTUpdate:
    def test_correct_answer_increases_p_knows(self):
        t = KnowledgeTracer("s1")
        before = t.get_p_knows("linear")
        state = t.update("linear", True)
        assert state.p_knows > before

    def test_incorrect_answer_decreases_p_knows(self):
        t = KnowledgeTracer("s1")
        before = t.get_p_knows("linear")
        state = t.update("linear", False)
        assert state.p_knows < before

    def test_bkt_update_formula_correctness_correct(self):
        # linear: L0=0.30, T=0.09, G=0.20, S=0.10
        # posterior = 0.30*0.90 / (0.30*0.90 + 0.70*0.20) = 0.27/0.41
        # p_new = posterior + (1-posterior)*0.09
        t = KnowledgeTracer("s1")
        state = t.update("linear", True)
        assert state.p_knows == pytest.approx(0.6892682926829268, abs=1e-9)

    def test_bkt_update_formula_correctness_incorrect(self):
        # posterior = 0.30*0.10 / (0.30*0.10 + 0.70*0.80) = 0.03/0.59
        # p_new = posterior + (1-posterior)*0.09
        t = KnowledgeTracer("s1")
        state = t.update("linear", False)
        assert state.p_knows == pytest.approx(0.13627118644067796, abs=1e-9)

    def test_multiple_correct_answers_push_toward_mastery(self):
        t = KnowledgeTracer("s1")
        for _ in range(8):
            t.update("linear", True)
        assert t.get_p_knows("linear") > 0.9

    def test_p_knows_stays_in_unit_interval(self):
        t = KnowledgeTracer("s1")
        for correct in [True, False, True, True, False, False, False, True]:
            state = t.update("quadratic", correct)
            assert 0.0 <= state.p_knows <= 1.0

    def test_attempts_and_correct_counters(self):
        t = KnowledgeTracer("s1")
        t.update("linear", True)
        t.update("linear", False)
        t.update("linear", True)
        st = t.skills["linear"]
        assert st.attempts == 3
        assert st.correct == 2

    def test_update_returns_state_with_timestamp(self):
        t = KnowledgeTracer("s1")
        st = t.update("linear", True)
        assert isinstance(st.last_updated, datetime)
        assert st.skill == "linear"


# ---------------------------------------------------------------------------
# Difficulty recommendation
# ---------------------------------------------------------------------------

class TestRecommendDifficulty:
    def test_recommend_easy_when_p_knows_low(self):
        t = KnowledgeTracer("s1")  # quadratic L0 = 0.10
        assert t.recommend_difficulty("quadratic") < 0.3

    def test_recommend_hard_when_p_knows_high(self):
        t = KnowledgeTracer("s1")
        for _ in range(10):
            t.update("linear", True)
        assert t.recommend_difficulty("linear") >= 0.7

    def test_recommend_in_unit_interval(self):
        t = KnowledgeTracer("s1")
        assert 0.0 <= t.recommend_difficulty("fraction") <= 1.0


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

class TestSerialization:
    def test_serialize_deserialize_roundtrip(self):
        t = KnowledgeTracer("s1")
        t.update("linear", True)
        t.update("quadratic", False)
        data = t.to_dict()
        restored = KnowledgeTracer.from_dict("s1", data)
        assert restored.student_id == "s1"
        assert restored.get_p_knows("linear") == pytest.approx(t.get_p_knows("linear"))
        assert restored.get_p_knows("quadratic") == pytest.approx(t.get_p_knows("quadratic"))
        assert restored.skills["linear"].attempts == 1

    def test_from_dict_empty_is_safe(self):
        restored = KnowledgeTracer.from_dict("s1", {})
        assert restored.skills == {}

    def test_skill_state_to_from_dict(self):
        st = StudentSkillState("linear", 0.5, 3, 2, datetime.utcnow())
        st2 = StudentSkillState.from_dict(st.to_dict())
        assert st2.skill == "linear"
        assert st2.p_knows == pytest.approx(0.5)
        assert st2.attempts == 3
        assert st2.correct == 2
