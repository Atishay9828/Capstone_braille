"""L5 — Adaptive assessment endpoints.

Ties together three services to deliver adaptive math practice:
  - mcq_generator   (L5): LaTeX -> 4-choice MCQ with error-based distractors
  - translator      (L3): question + choices -> Braille (Nemeth / Grade 1)
  - knowledge_tracer(L5): BKT model updated from each answer, drives difficulty

Flow:
  POST /assessment/generate -> stores the MCQ, returns it (with Braille)
  POST /assessment/submit   -> grades it, updates BKT, returns feedback
  GET  /assessment/student/{id} -> the student's mastery profile

Route handlers validate + orchestrate + persist; the algorithms live in services.
"""

from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from backend.core.db import get_session
from backend.models.database import AssessmentQuestion, StudentKnowledge
from backend.models.schemas import (
    AssessmentGenerateRequest,
    AssessmentGenerateResponse,
    AssessmentSubmitRequest,
    AssessmentSubmitResponse,
    MCQChoiceOut,
    SkillSummary,
    StudentProfileResponse,
)
from backend.services.knowledge_tracer import (
    KnowledgeTracer,
    StudentSkillState,
)
from backend.services.mcq_generator import generate_mcq
from backend.services.translator import BrailleGrade, translate_math, translate_text

router = APIRouter(prefix="/assessment", tags=["assessment"])


# ---------------------------------------------------------------------------
# Braille helpers — never raise; an unavailable translator yields "" Braille
# so the assessment flow still works (the plain text is always present).
# ---------------------------------------------------------------------------

def _braille_text(text: str) -> str:
    try:
        return translate_text(text, BrailleGrade.GRADE_1).braille_unicode
    except Exception:
        return ""


def _braille_math(latex: str) -> str:
    try:
        return translate_math(latex).braille_unicode
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Knowledge-tracer persistence
# ---------------------------------------------------------------------------

def _load_tracer(session: Session, student_id: str) -> KnowledgeTracer:
    tracer = KnowledgeTracer(student_id)
    rows = session.exec(
        select(StudentKnowledge).where(StudentKnowledge.student_id == student_id)
    ).all()
    for r in rows:
        tracer.skills[r.skill] = StudentSkillState(
            skill=r.skill, p_knows=r.p_knows, attempts=r.attempts,
            correct=r.correct, last_updated=r.updated_at,
        )
    return tracer


def _persist_skill(session: Session, student_id: str, state: StudentSkillState) -> None:
    row = session.exec(
        select(StudentKnowledge).where(
            StudentKnowledge.student_id == student_id,
            StudentKnowledge.skill == state.skill,
        )
    ).first()
    if row is None:
        row = StudentKnowledge(student_id=student_id, skill=state.skill,
                               p_knows=state.p_knows)
    row.p_knows = state.p_knows
    row.attempts = state.attempts
    row.correct = state.correct
    row.state_json = json.dumps(state.to_dict())
    row.updated_at = datetime.utcnow()
    session.add(row)
    session.commit()


# ---------------------------------------------------------------------------
# Feedback text
# ---------------------------------------------------------------------------

_ERROR_REASONS = {
    "sign_error": "sign mistake when moving a term across the equals sign",
    "dropped_term": "one term in the equation was ignored",
    "arithmetic_error": "a small arithmetic slip",
    "add_across": "numerators and denominators were added directly "
                  "(a/b + c/d is NOT (a+c)/(b+d))",
    "wrong_denominator": "the numerator is right but the common denominator is wrong",
    "wrong_numerator": "the denominator is right but the numerator is wrong",
    "one_root": "only one root was found; a quadratic equation has two",
    "wrong_category": "this is a different type of expression",
}


def _explanation(correct: bool, selected: dict, correct_text: str) -> str:
    if correct:
        return f"Correct! The answer is {correct_text}."
    reason = _ERROR_REASONS.get(selected.get("distractor_type"), "that is not correct")
    return (f"You chose {selected['value']}. The correct answer is {correct_text}. "
            f"Common error: {reason}.")


def _recommendation(skill: str, p_after: float) -> str:
    if p_after >= 0.7:
        return f"Strong grasp of {skill} — ready for harder {skill} problems."
    if p_after < 0.3:
        return f"Keep practicing {skill} basics."
    return f"Building {skill} skills — keep going."


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=AssessmentGenerateResponse)
async def generate(
    req: AssessmentGenerateRequest,
    session: Session = Depends(get_session),
) -> AssessmentGenerateResponse:
    """Generate an MCQ for a math expression and persist it for grading."""
    mcq = generate_mcq(req.latex)

    choices_out: list[MCQChoiceOut] = []
    choices_store: list[dict] = []
    for i, ch in enumerate(mcq.choices):
        choices_out.append(MCQChoiceOut(index=i, text=ch.value, braille=_braille_text(ch.value)))
        choices_store.append({"value": ch.value, "distractor_type": ch.distractor_type})

    row = AssessmentQuestion(
        student_id=req.student_id,
        session_id=req.session_id,
        latex=req.latex,
        question_type=mcq.question_type,
        skill=mcq.skill,
        difficulty=mcq.difficulty,
        correct_index=mcq.correct_index,
    )
    row.choices = choices_store
    session.add(row)
    session.commit()
    session.refresh(row)

    return AssessmentGenerateResponse(
        question_id=row.id,
        question_text=mcq.question_text,
        question_braille=_braille_text(mcq.question_text),
        expression=req.latex,
        expression_braille=_braille_math(req.latex),
        choices=choices_out,
        difficulty=mcq.difficulty,
        question_type=mcq.question_type,
        skill=mcq.skill,
    )


@router.post("/submit", response_model=AssessmentSubmitResponse)
async def submit(
    req: AssessmentSubmitRequest,
    session: Session = Depends(get_session),
) -> AssessmentSubmitResponse:
    """Grade an answer, update the BKT model, and return adaptive feedback."""
    row = session.get(AssessmentQuestion, req.question_id)
    if row is None:
        raise HTTPException(status_code=404, detail="question_id not found")
    if row.answered:
        raise HTTPException(status_code=409, detail="question already answered")

    choices = row.choices
    if not (0 <= req.selected_index < len(choices)):
        raise HTTPException(status_code=422, detail="selected_index out of range")

    correct = req.selected_index == row.correct_index
    skill = row.skill

    tracer = _load_tracer(session, req.student_id)
    p_before = tracer.get_p_knows(skill)
    state = tracer.update(skill, correct)
    p_after = state.p_knows
    _persist_skill(session, req.student_id, state)

    # Mark the question answered (idempotency guard for the 409 above).
    row.answered = True
    row.selected_index = req.selected_index
    row.correct = correct
    row.p_knows_before = p_before
    row.p_knows_after = p_after
    session.add(row)
    session.commit()

    correct_text = choices[row.correct_index]["value"]
    return AssessmentSubmitResponse(
        correct=correct,
        correct_index=row.correct_index,
        correct_answer_text=correct_text,
        explanation=_explanation(correct, choices[req.selected_index], correct_text),
        p_knows_before=round(p_before, 4),
        p_knows_after=round(p_after, 4),
        skill=skill,
        next_recommended_difficulty=tracer.recommend_difficulty(skill),
        recommendation=_recommendation(skill, p_after),
    )


@router.get("/student/{student_id}", response_model=StudentProfileResponse)
async def student_profile(
    student_id: str,
    session: Session = Depends(get_session),
) -> StudentProfileResponse:
    """Return the student's BKT mastery profile across all attempted skills."""
    rows = session.exec(
        select(StudentKnowledge).where(StudentKnowledge.student_id == student_id)
    ).all()

    skills = {
        r.skill: SkillSummary(p_knows=round(r.p_knows, 4), attempts=r.attempts, correct=r.correct)
        for r in rows
    }
    overall = sum(r.p_knows for r in rows) / len(rows) if rows else 0.0
    return StudentProfileResponse(
        student_id=student_id,
        skills=skills,
        overall_mastery=round(overall, 4),
        total_questions=sum(r.attempts for r in rows),
        total_correct=sum(r.correct for r in rows),
    )
