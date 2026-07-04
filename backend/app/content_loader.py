"""Loads and indexes all learning content from JSON files on disk.

The loader reads every ``*.json`` file under the content sub-directories,
validates it against the Pydantic schemas, and keeps an in-memory index.
Call :func:`get_store` for a lazily-built singleton, or ``reload`` to pick up
edits without restarting the server (handy while authoring content).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

from .config import LEVELS, settings
from .models import (
    ContentSummary,
    GrammarLesson,
    Quiz,
    Story,
    VocabDeck,
)


def _level_sort_key(level: str) -> int:
    try:
        return LEVELS.index(level)
    except ValueError:
        return len(LEVELS)


class ContentStore:
    """In-memory index of all validated content."""

    def __init__(self, content_dir: Path) -> None:
        self.content_dir = content_dir
        self.grammar: Dict[str, GrammarLesson] = {}
        self.vocab: Dict[str, VocabDeck] = {}
        self.stories: Dict[str, Story] = {}
        self.quizzes: Dict[str, Quiz] = {}
        self.errors: List[str] = []
        self.reload()

    # ------------------------------------------------------------------ #
    def reload(self) -> None:
        self.grammar.clear()
        self.vocab.clear()
        self.stories.clear()
        self.quizzes.clear()
        self.errors.clear()

        self._load_dir("grammar", GrammarLesson, self.grammar)
        self._load_dir("vocabulary", VocabDeck, self.vocab)
        self._load_dir("stories", Story, self.stories)
        self._load_dir("tests", Quiz, self.quizzes)

    def _load_dir(self, sub: str, model, target: Dict) -> None:
        directory = self.content_dir / sub
        if not directory.exists():
            return
        for path in sorted(directory.glob("*.json")):
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                self.errors.append(f"{path.name}: could not read/parse ({exc})")
                continue
            items = raw if isinstance(raw, list) else [raw]
            for item in items:
                try:
                    obj = model.model_validate(item)
                except Exception as exc:  # pydantic ValidationError etc.
                    self.errors.append(f"{path.name}: {exc}")
                    continue
                if obj.id in target:
                    self.errors.append(
                        f"{path.name}: duplicate id '{obj.id}' (ignored)"
                    )
                    continue
                target[obj.id] = obj

    # ------------------------------------------------------------------ #
    # Grammar
    # ------------------------------------------------------------------ #
    def grammar_list(self, level: Optional[str] = None) -> List[ContentSummary]:
        lessons = [g for g in self.grammar.values() if not level or g.level == level]
        lessons.sort(key=lambda g: (_level_sort_key(g.level), g.order, g.title))
        return [
            ContentSummary(
                id=g.id,
                level=g.level,
                title=g.title,
                kind="grammar",
                subtitle=g.summary,
                count=len(g.sections),
                tags=g.tags,
            )
            for g in lessons
        ]

    # ------------------------------------------------------------------ #
    # Vocabulary
    # ------------------------------------------------------------------ #
    def vocab_list(self, level: Optional[str] = None) -> List[ContentSummary]:
        decks = [d for d in self.vocab.values() if not level or d.level == level]
        decks.sort(key=lambda d: (_level_sort_key(d.level), d.title))
        return [
            ContentSummary(
                id=d.id,
                level=d.level,
                title=d.title,
                kind="vocab",
                subtitle=d.description or d.theme,
                count=len(d.cards),
                tags=[d.theme],
            )
            for d in decks
        ]

    # ------------------------------------------------------------------ #
    # Stories
    # ------------------------------------------------------------------ #
    def story_list(self, level: Optional[str] = None) -> List[ContentSummary]:
        stories = [s for s in self.stories.values() if not level or s.level == level]
        stories.sort(key=lambda s: (_level_sort_key(s.level), s.title))
        return [
            ContentSummary(
                id=s.id,
                level=s.level,
                title=s.title,
                kind=s.type,
                subtitle=s.summary,
                count=len(s.lines) or len(s.paragraphs),
                tags=[s.type],
            )
            for s in stories
        ]

    # ------------------------------------------------------------------ #
    # Quizzes
    # ------------------------------------------------------------------ #
    def quiz_list(self, level: Optional[str] = None) -> List[ContentSummary]:
        quizzes = [q for q in self.quizzes.values() if not level or q.level == level]
        quizzes.sort(key=lambda q: (_level_sort_key(q.level), q.title))
        return [
            ContentSummary(
                id=q.id,
                level=q.level,
                title=q.title,
                kind="quiz",
                subtitle=q.description or q.topic,
                count=len(q.questions),
                tags=[q.topic],
            )
            for q in quizzes
        ]

    # ------------------------------------------------------------------ #
    def stats(self) -> dict:
        return {
            "grammar": len(self.grammar),
            "vocab_decks": len(self.vocab),
            "vocab_cards": sum(len(d.cards) for d in self.vocab.values()),
            "stories": len(self.stories),
            "quizzes": len(self.quizzes),
            "quiz_questions": sum(len(q.questions) for q in self.quizzes.values()),
            "errors": self.errors,
        }


_store: Optional[ContentStore] = None


def get_store() -> ContentStore:
    global _store
    if _store is None:
        _store = ContentStore(settings.content_dir)
    return _store


def reload_store() -> ContentStore:
    store = get_store()
    store.reload()
    return store
