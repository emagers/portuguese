"""Pydantic schemas describing all learning content.

Content lives as JSON files under ``backend/content`` and is validated against
these models on load. Keeping the schema permissive (optional fields, extra
allowed) makes it easy to grow the curriculum without breaking the loader.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Level = Literal["A1", "A2", "B1", "B2", "C1", "C2"]


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow")


# --------------------------------------------------------------------------- #
# Grammar
# --------------------------------------------------------------------------- #
class Example(_Base):
    pt: str
    en: str
    note: Optional[str] = None


class Mistake(_Base):
    wrong: str
    right: str
    note: Optional[str] = None


class GrammarSection(_Base):
    heading: str
    body: str = ""  # markdown
    examples: List[Example] = Field(default_factory=list)


class GrammarLesson(_Base):
    id: str
    level: Level
    order: int = 0
    title: str
    titlePt: Optional[str] = None
    summary: str = ""
    tags: List[str] = Field(default_factory=list)
    sections: List[GrammarSection] = Field(default_factory=list)
    keyPoints: List[str] = Field(default_factory=list)
    commonMistakes: List[Mistake] = Field(default_factory=list)
    relatedVocab: List[str] = Field(default_factory=list)
    quizId: Optional[str] = None


# --------------------------------------------------------------------------- #
# Vocabulary
# --------------------------------------------------------------------------- #
class VocabCard(_Base):
    id: str
    pt: str
    en: str
    pos: Optional[str] = None  # part of speech
    gender: Optional[str] = None  # m / f / None
    ipa: Optional[str] = None
    emoji: Optional[str] = None  # picture for this word (rendered via OpenMoji)
    example: Optional[Example] = None
    tags: List[str] = Field(default_factory=list)


class VocabDeck(_Base):
    id: str
    level: Level
    title: str
    theme: str = "general"
    description: str = ""
    cards: List[VocabCard] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Phrasebook (common phrases grouped by situation/topic)
# --------------------------------------------------------------------------- #
class Phrase(_Base):
    id: str
    pt: str
    en: str
    ipa: Optional[str] = None
    literal: Optional[str] = None  # word-for-word gloss, when helpful
    note: Optional[str] = None


class PhraseCollection(_Base):
    id: str
    level: Level
    title: str
    topic: str = "general"  # category, e.g. food, travel, social
    situation: str = ""  # short human description of the situation
    description: str = ""
    phrases: List[Phrase] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Stories & conversations
# --------------------------------------------------------------------------- #
class DialogueLine(_Base):
    speaker: str
    pt: str
    en: str
    note: Optional[str] = None


class Paragraph(_Base):
    pt: str
    en: str


class GlossaryItem(_Base):
    pt: str
    en: str
    note: Optional[str] = None


class ComprehensionQuestion(_Base):
    id: str
    question: str
    options: List[str] = Field(default_factory=list)
    answer: str
    explanation: Optional[str] = None


class Story(_Base):
    id: str
    level: Level
    type: Literal["story", "conversation"] = "story"
    title: str
    titlePt: Optional[str] = None
    summary: str = ""
    lines: List[DialogueLine] = Field(default_factory=list)
    paragraphs: List[Paragraph] = Field(default_factory=list)
    glossary: List[GlossaryItem] = Field(default_factory=list)
    comprehension: List[ComprehensionQuestion] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Quizzes / knowledge tests
# --------------------------------------------------------------------------- #
QuestionType = Literal[
    "multiple_choice",
    "fill_blank",
    "translate_pt_en",
    "translate_en_pt",
    "listening",
]


class Question(_Base):
    id: str
    type: QuestionType = "multiple_choice"
    prompt: str
    promptPt: Optional[str] = None
    options: List[str] = Field(default_factory=list)
    answer: str
    explanation: Optional[str] = None
    hint: Optional[str] = None
    # For listening questions: the pt-BR text to synthesise as audio.
    audioText: Optional[str] = None


class Quiz(_Base):
    id: str
    level: Level
    title: str
    topic: str = "mixed"  # grammar | vocab | listening | mixed
    description: str = ""
    questions: List[Question] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Lightweight summaries returned by list endpoints
# --------------------------------------------------------------------------- #
class ContentSummary(_Base):
    id: str
    level: Level
    title: str
    kind: str
    subtitle: Optional[str] = None
    count: Optional[int] = None
    tags: List[str] = Field(default_factory=list)
