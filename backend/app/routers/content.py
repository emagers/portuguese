"""Content endpoints: grammar, vocabulary, stories and quizzes."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import LEVEL_NAMES, LEVELS
from ..content_loader import get_store, reload_store

router = APIRouter(prefix="/api/content", tags=["content"])


@router.get("/levels")
def list_levels():
    """CEFR levels with human-friendly names and per-level content counts."""
    store = get_store()
    result = []
    for lvl in LEVELS:
        result.append(
            {
                "level": lvl,
                "name": LEVEL_NAMES[lvl],
                "grammar": len(store.grammar_list(lvl)),
                "vocab": len(store.vocab_list(lvl)),
                "stories": len(store.story_list(lvl)),
                "quizzes": len(store.quiz_list(lvl)),
            }
        )
    return result


@router.get("/stats")
def content_stats():
    return get_store().stats()


@router.post("/reload")
def reload_content():
    """Re-read content from disk (useful while authoring)."""
    store = reload_store()
    return store.stats()


# --------------------------------------------------------------------------- #
# Grammar
# --------------------------------------------------------------------------- #
@router.get("/grammar")
def grammar_list(level: Optional[str] = Query(None)):
    return get_store().grammar_list(level)


@router.get("/grammar/{lesson_id}")
def grammar_detail(lesson_id: str):
    lesson = get_store().grammar.get(lesson_id)
    if not lesson:
        raise HTTPException(404, f"Grammar lesson '{lesson_id}' not found")
    return lesson


# --------------------------------------------------------------------------- #
# Vocabulary
# --------------------------------------------------------------------------- #
@router.get("/vocab")
def vocab_list(level: Optional[str] = Query(None)):
    return get_store().vocab_list(level)


@router.get("/vocab/{deck_id}")
def vocab_detail(deck_id: str):
    deck = get_store().vocab.get(deck_id)
    if not deck:
        raise HTTPException(404, f"Vocabulary deck '{deck_id}' not found")
    return deck


# --------------------------------------------------------------------------- #
# Stories & conversations
# --------------------------------------------------------------------------- #
@router.get("/stories")
def story_list(level: Optional[str] = Query(None)):
    return get_store().story_list(level)


@router.get("/stories/{story_id}")
def story_detail(story_id: str):
    story = get_store().stories.get(story_id)
    if not story:
        raise HTTPException(404, f"Story '{story_id}' not found")
    return story


# --------------------------------------------------------------------------- #
# Quizzes / knowledge tests
# --------------------------------------------------------------------------- #
@router.get("/quizzes")
def quiz_list(level: Optional[str] = Query(None)):
    return get_store().quiz_list(level)


@router.get("/quizzes/{quiz_id}")
def quiz_detail(quiz_id: str):
    quiz = get_store().quizzes.get(quiz_id)
    if not quiz:
        raise HTTPException(404, f"Quiz '{quiz_id}' not found")
    return quiz
