"""L5 — Bayesian Knowledge Tracing (BKT) student model.

=== RESEARCH NOTEBOOK (2026-05-31) ===

WHAT THIS IS:
  BKT is the classic student-modelling algorithm from Corbett & Anderson (1995),
  used in Cognitive Tutor and many ITS since. It models, per skill, a hidden
  binary state — "student knows the skill" — and updates the probability of that
  state from each observed correct/incorrect answer using Bayes' rule plus a
  learning-transition step. It is a 2-state Hidden Markov Model per skill.

FOUR PARAMETERS (per skill):
  L0 (p-init)    prior P(knows skill) before any practice
  T  (p-transit) P(not-known -> known) after one practice opportunity
  G  (p-guess)   P(correct | does NOT know the skill)   — lucky guess
  S  (p-slip)    P(incorrect | DOES know the skill)     — careless slip

  Research best practice (well-established): keep G < 0.3 and S < 0.1 so the
  model stays identifiable and a correct answer is genuinely evidence of
  knowing. Our defaults below comply.

UPDATE RULES (the exact BKT equations):
  After a CORRECT answer:
    P(L|obs) = P(L)(1-S) / [ P(L)(1-S) + (1-P(L))G ]
  After an INCORRECT answer:
    P(L|obs) = P(L)S     / [ P(L)S     + (1-P(L))(1-G) ]
  Then apply the learning transition (can learn from any opportunity):
    P(L_new) = P(L|obs) + (1 - P(L|obs)) * T

WHY FROM SCRATCH (no pyBKT dependency):
  pyBKT (CAHLR/pyBKT) is excellent but built for OFFLINE parameter FITTING from
  large response-log datasets (its 150-600x speedup is for EM fitting). We do
  not fit parameters — we use fixed, research-derived parameters and perform
  ONLINE posterior updates, one answer at a time. That is ~15 lines of exact
  arithmetic, fully explainable to faculty, with zero heavy dependencies and no
  training data required. Defensibility > library convenience here.

DIFFICULTY RECOMMENDATION:
  We map the current mastery estimate to a target difficulty in [0,1] (the
  "zone of proximal development" idea, an IRT-lite heuristic without full IRT):
  low mastery -> easy items, high mastery -> hard items. See recommend_difficulty.

Sources: Corbett & Anderson 1995; Wikipedia "Bayesian knowledge tracing";
  Badrinath/Wang/Pardos, "pyBKT" (EDM 2021); Bulut et al., Psych 2023.

=== END RESEARCH NOTEBOOK ===
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict

# Research-derived defaults. Harder skills start with lower priors (L0) and
# slower transitions (T). Guess/slip held at the conventional 0.2 / 0.1.
DEFAULT_BKT_PARAMS: Dict[str, Dict[str, float]] = {
    "linear":    {"L0": 0.30, "T": 0.09, "G": 0.20, "S": 0.10},
    "quadratic": {"L0": 0.10, "T": 0.06, "G": 0.20, "S": 0.10},
    "fraction":  {"L0": 0.25, "T": 0.08, "G": 0.20, "S": 0.10},
    "radical":   {"L0": 0.15, "T": 0.07, "G": 0.20, "S": 0.10},
    "trig":      {"L0": 0.12, "T": 0.06, "G": 0.20, "S": 0.10},
    "default":   {"L0": 0.20, "T": 0.08, "G": 0.20, "S": 0.10},
}


def params_for(skill: str) -> Dict[str, float]:
    """Return BKT parameters for a skill, falling back to 'default'."""
    return DEFAULT_BKT_PARAMS.get(skill, DEFAULT_BKT_PARAMS["default"])


@dataclass
class StudentSkillState:
    """Per-skill mastery state for one student."""

    skill: str
    p_knows: float
    attempts: int
    correct: int
    last_updated: datetime

    def to_dict(self) -> dict:
        return {
            "skill": self.skill,
            "p_knows": self.p_knows,  # full precision — avoids roundtrip drift
            "attempts": self.attempts,
            "correct": self.correct,
            "last_updated": self.last_updated.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "StudentSkillState":
        return cls(
            skill=data["skill"],
            p_knows=float(data["p_knows"]),
            attempts=int(data["attempts"]),
            correct=int(data["correct"]),
            last_updated=_parse_dt(data.get("last_updated")),
        )


def _parse_dt(value) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            pass
    return datetime.utcnow()


class KnowledgeTracer:
    """Online BKT model of one student's mastery across math skills."""

    def __init__(self, student_id: str) -> None:
        self.student_id = student_id
        self.skills: Dict[str, StudentSkillState] = {}

    # -- queries ----------------------------------------------------------

    def get_p_knows(self, skill: str) -> float:
        """Current P(knows skill). Returns the skill's prior L0 if never seen."""
        state = self.skills.get(skill)
        if state is not None:
            return state.p_knows
        return params_for(skill)["L0"]

    # -- the BKT update ---------------------------------------------------

    def update(self, skill: str, correct: bool) -> StudentSkillState:
        """Update mastery after one answered question. Returns the new state.

        Applies the exact BKT posterior for the observation, then the learning
        transition. Never raises; an unknown skill uses 'default' parameters.
        """
        p = params_for(skill)
        L0, T, G, S = p["L0"], p["T"], p["G"], p["S"]

        prev = self.skills.get(skill)
        p_prior = prev.p_knows if prev is not None else L0

        # Bayesian posterior given the observation.
        if correct:
            numerator = p_prior * (1.0 - S)
            denominator = p_prior * (1.0 - S) + (1.0 - p_prior) * G
        else:
            numerator = p_prior * S
            denominator = p_prior * S + (1.0 - p_prior) * (1.0 - G)

        p_posterior = numerator / denominator if denominator > 0 else p_prior

        # Learning transition: a practice opportunity can move not-known -> known.
        p_new = p_posterior + (1.0 - p_posterior) * T
        p_new = min(1.0, max(0.0, p_new))

        state = StudentSkillState(
            skill=skill,
            p_knows=p_new,
            attempts=(prev.attempts if prev else 0) + 1,
            correct=(prev.correct if prev else 0) + (1 if correct else 0),
            last_updated=datetime.utcnow(),
        )
        self.skills[skill] = state
        return state

    # -- difficulty recommendation ----------------------------------------

    def recommend_difficulty(self, skill: str) -> float:
        """Recommend the next question's difficulty in [0,1] for this skill.

        Zone-of-proximal-development heuristic: target difficulty tracks current
        mastery so the student is challenged but not overwhelmed.
          p_knows < 0.3  -> easy   (0.0-0.3): student needs the basics
          0.3 <= p < 0.7 -> medium (0.3-0.7): building knowledge
          p_knows >= 0.7 -> hard   (0.7-1.0): ready for more
        Returning p_knows directly lands in the correct band by construction.
        """
        return round(min(1.0, max(0.0, self.get_p_knows(skill))), 3)

    def overall_mastery(self) -> float:
        """Mean mastery across all attempted skills (0.0 if none attempted)."""
        if not self.skills:
            return 0.0
        return sum(s.p_knows for s in self.skills.values()) / len(self.skills)

    # -- serialization ----------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "student_id": self.student_id,
            "skills": {name: st.to_dict() for name, st in self.skills.items()},
        }

    @classmethod
    def from_dict(cls, student_id: str, data: dict) -> "KnowledgeTracer":
        tracer = cls(student_id)
        for name, st in (data.get("skills") or {}).items():
            tracer.skills[name] = StudentSkillState.from_dict(st)
        return tracer
