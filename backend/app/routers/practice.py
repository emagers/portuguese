"""Reinforcement practice + per-section knowledge tests.

* Knowledge tests are generated per learning section (grammar lesson, vocab
  deck, phrase collection) from that section's authored content.
* Reinforcement sessions mix modalities (word<->translation, picture, listening,
  cloze, pronunciation) and draw ONLY from content the learner has completed.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from .. import db
from ..content_loader import get_store
from ..services import generator

router = APIRouter(prefix="/api/practice", tags=["practice"])


# --------------------------------------------------------------------------- #
# Per-section knowledge tests
# --------------------------------------------------------------------------- #
@router.get("/knowledge/vocab/{deck_id}")
def knowledge_vocab(deck_id: str):
    test = generator.knowledge_for_deck(get_store(), deck_id)
    if not test:
        raise HTTPException(404, f"No knowledge test available for deck '{deck_id}'")
    return test


@router.get("/knowledge/grammar/{lesson_id}")
def knowledge_grammar(lesson_id: str):
    test = generator.knowledge_for_grammar(get_store(), lesson_id)
    if not test:
        raise HTTPException(404, f"No knowledge test available for lesson '{lesson_id}'")
    return test


@router.get("/knowledge/phrases/{collection_id}")
def knowledge_phrases(collection_id: str):
    test = generator.knowledge_for_phrases(get_store(), collection_id)
    if not test:
        raise HTTPException(404, f"No knowledge test available for '{collection_id}'")
    return test


# --------------------------------------------------------------------------- #
# Reinforcement
# --------------------------------------------------------------------------- #
@router.get("/reinforcement/status")
def reinforcement_status():
    """What the learner has unlocked for reinforcement (completed content)."""
    store = get_store()
    completed_decks = db.completed_deck_ids()
    completed_phrases = db.completed_phrase_ids()
    terms = sum(len(store.vocab[d].cards) for d in completed_decks if d in store.vocab)
    return {
        "completed_decks": [
            {"id": d, "title": store.vocab[d].title, "level": store.vocab[d].level}
            for d in completed_decks
            if d in store.vocab
        ],
        "completed_phrase_collections": [
            {"id": c, "title": store.phrases[c].title, "level": store.phrases[c].level}
            for c in completed_phrases
            if c in store.phrases
        ],
        "term_count": terms,
        "ready": terms >= 4,
    }


@router.get("/reinforcement/session")
def reinforcement_session(
    scope: str = Query("all"),
    count: int = Query(12, ge=1, le=40),
    pronunciation: bool = Query(True),
):
    """Generate a randomized reinforcement session from completed content.

    ``scope`` is ``all`` (everything completed) or ``deck:<id>`` for a single
    completed deck.
    """
    store = get_store()
    completed = db.completed_deck_ids()

    if scope.startswith("deck:"):
        did = scope.split(":", 1)[1]
        if did not in completed:
            raise HTTPException(
                409,
                "Finish this deck first — reinforcement only uses content you've completed.",
            )
        deck_ids = [did]
    else:
        deck_ids = completed

    if not deck_ids:
        raise HTTPException(
            409,
            "Nothing to reinforce yet. Complete a vocabulary deck to unlock reinforcement practice.",
        )

    problems = generator.generate_reinforcement(
        store, deck_ids, count=count, include_pronunciation=pronunciation
    )
    if not problems:
        raise HTTPException(409, "Not enough completed material to build a session yet.")
    return {"scope": scope, "count": len(problems), "problems": problems}
