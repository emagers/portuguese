"""Learner progress endpoints: spaced repetition, quiz results, lessons."""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from .. import db

db.init_db()

router = APIRouter(prefix="/api/progress", tags=["progress"])


class ReviewIn(BaseModel):
    card_id: str
    deck_id: str
    grade: int  # 0-5


class QuizResultIn(BaseModel):
    quiz_id: str
    level: Optional[str] = None
    score: int
    total: int
    details: Optional[dict] = None


class LessonIn(BaseModel):
    lesson_id: str
    status: str = "completed"


class DeckIn(BaseModel):
    deck_id: str
    status: str = "completed"


@router.get("/summary")
def summary():
    return {
        "vocab": db.vocab_stats(),
        "activity": db.activity_summary(),
        "recent_quizzes": db.quiz_history(limit=10),
        "lessons": db.lesson_statuses(),
        "decks": db.deck_statuses(),
    }


# --- Vocabulary spaced repetition --- #
@router.post("/vocab/review")
def vocab_review(body: ReviewIn):
    return db.review_card(body.card_id, body.deck_id, body.grade)


@router.get("/vocab/due")
def vocab_due(deck: Optional[str] = None):
    return {"due": db.due_cards(deck)}


@router.get("/vocab/stats")
def vocab_stats():
    return db.vocab_stats()


# --- Quizzes --- #
@router.post("/quiz")
def quiz_result(body: QuizResultIn):
    rid = db.save_quiz_result(
        body.quiz_id,
        body.level,
        body.score,
        body.total,
        json.dumps(body.details or {}),
    )
    return {"id": rid}


@router.get("/quiz/history")
def quiz_hist(limit: int = 50):
    return db.quiz_history(limit)


# --- Lessons --- #
@router.post("/lesson")
def lesson(body: LessonIn):
    db.set_lesson_status(body.lesson_id, body.status)
    return {"ok": True}


# --- Vocabulary deck completion --- #
@router.post("/deck")
def deck(body: DeckIn):
    db.set_deck_status(body.deck_id, body.status)
    return {"ok": True}


# --- Pronunciation history --- #
@router.get("/pronunciation/history")
def pron_hist(limit: int = 50):
    return db.pronunciation_history(limit)
