"""Problem generators for knowledge tests and reinforcement practice.

Every problem is *provably correct* because it is derived directly from
already-authored, validated content:
  * Vocabulary cards (pt / en / emoji / example) are ground truth.
  * Grammar lessons carry authored ``commonMistakes`` (wrong vs right) and
    ``examples`` (pt + en) we can turn into questions with no guesswork.
  * Phrase collections carry authored pt/en pairs.

Problems are randomized (selection, distractors, modality, option order) using a
fresh RNG each call, so a session is different every time. The reinforcement
generator only draws from content the learner has marked complete.
"""
from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from ..content_loader import ContentStore


# --------------------------------------------------------------------------- #
# Term pool (a normalised view over vocabulary cards)
# --------------------------------------------------------------------------- #
@dataclass
class Term:
    pt: str
    en: str
    emoji: Optional[str]
    example_pt: Optional[str]
    example_en: Optional[str]
    level: str
    deck_id: str
    card_id: str


def _terms_from_decks(store: ContentStore, deck_ids: List[str]) -> List[Term]:
    terms: List[Term] = []
    for did in deck_ids:
        deck = store.vocab.get(did)
        if not deck:
            continue
        for c in deck.cards:
            ex = getattr(c, "example", None)
            terms.append(
                Term(
                    pt=c.pt,
                    en=c.en,
                    emoji=getattr(c, "emoji", None),
                    example_pt=ex.pt if ex else None,
                    example_en=ex.en if ex else None,
                    level=deck.level,
                    deck_id=deck.id,
                    card_id=c.id,
                )
            )
    return terms


def _distinct_sample(
    rng: random.Random,
    pool: List[str],
    exclude: List[str],
    n: int,
) -> List[str]:
    """Sample up to n items from pool, case-insensitively distinct and not in exclude."""
    seen = {e.strip().lower() for e in exclude}
    out: List[str] = []
    for item in rng.sample(pool, len(pool)) if pool else []:
        key = item.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= n:
            break
    return out


_PROB_COUNTER = 0


def _pid() -> str:
    global _PROB_COUNTER
    _PROB_COUNTER += 1
    return f"p{_PROB_COUNTER}"


@dataclass
class ProblemBuilder:
    rng: random.Random
    terms: List[Term]
    options_target: int = 4

    # caches
    _pt_pool: List[str] = field(default_factory=list)
    _en_pool: List[str] = field(default_factory=list)
    _emoji_pool: List[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._pt_pool = list({t.pt for t in self.terms})
        self._en_pool = list({t.en for t in self.terms})
        self._emoji_pool = list({t.emoji for t in self.terms if t.emoji})

    # -- individual problem makers (return None if not enough material) -- #
    def mc_word_to_translation(self, t: Term) -> Optional[dict]:
        distractors = _distinct_sample(self.rng, self._en_pool, [t.en], self.options_target - 1)
        if len(distractors) < 1:
            return None
        options = distractors + [t.en]
        self.rng.shuffle(options)
        return {
            "id": _pid(),
            "kind": "mc_text",
            "instruction": "What does this word mean?",
            "prompt_text": t.pt,
            "audio_text": t.pt,
            "options": options,
            "options_are_emoji": False,
            "answer": t.en,
            "translation": t.en,
            "source": f"{t.deck_id}/{t.card_id}",
        }

    def mc_translation_to_word(self, t: Term) -> Optional[dict]:
        distractors = _distinct_sample(self.rng, self._pt_pool, [t.pt], self.options_target - 1)
        if len(distractors) < 1:
            return None
        options = distractors + [t.pt]
        self.rng.shuffle(options)
        return {
            "id": _pid(),
            "kind": "mc_text",
            "instruction": "Which word means:",
            "prompt_text": t.en,
            "options": options,
            "options_are_emoji": False,
            "answer": t.pt,
            "translation": t.en,
            "speak_options": True,
            "source": f"{t.deck_id}/{t.card_id}",
        }

    def picture_to_word(self, t: Term) -> Optional[dict]:
        if not t.emoji:
            return None
        distractors = _distinct_sample(self.rng, self._pt_pool, [t.pt], self.options_target - 1)
        if len(distractors) < 1:
            return None
        options = distractors + [t.pt]
        self.rng.shuffle(options)
        return {
            "id": _pid(),
            "kind": "picture_to_word",
            "instruction": "Which word matches this picture?",
            "prompt_emoji": t.emoji,
            "options": options,
            "options_are_emoji": False,
            "answer": t.pt,
            "translation": t.en,
            "speak_options": True,
            "source": f"{t.deck_id}/{t.card_id}",
        }

    def word_to_picture(self, t: Term) -> Optional[dict]:
        if not t.emoji or len(self._emoji_pool) < self.options_target:
            return None
        distractors = _distinct_sample(self.rng, self._emoji_pool, [t.emoji], self.options_target - 1)
        if len(distractors) < 2:
            return None
        options = distractors + [t.emoji]
        self.rng.shuffle(options)
        return {
            "id": _pid(),
            "kind": "word_to_picture",
            "instruction": "Pick the picture for this word:",
            "prompt_text": t.pt,
            "audio_text": t.pt,
            "options": options,
            "options_are_emoji": True,
            "answer": t.emoji,
            "translation": t.en,
            "source": f"{t.deck_id}/{t.card_id}",
        }

    def listening_meaning(self, t: Term) -> Optional[dict]:
        distractors = _distinct_sample(self.rng, self._en_pool, [t.en], self.options_target - 1)
        if len(distractors) < 1:
            return None
        options = distractors + [t.en]
        self.rng.shuffle(options)
        return {
            "id": _pid(),
            "kind": "listening",
            "instruction": "Listen and pick the meaning:",
            "audio_text": t.pt,
            "options": options,
            "options_are_emoji": False,
            "answer": t.en,
            "reveal_text": t.pt,
            "translation": t.en,
            "source": f"{t.deck_id}/{t.card_id}",
        }

    def cloze(self, t: Term) -> Optional[dict]:
        if not t.example_pt:
            return None
        # Only build a cloze if the target word appears as a whole word.
        pattern = re.compile(rf"\b{re.escape(t.pt)}\b", re.IGNORECASE)
        if not pattern.search(t.example_pt):
            return None
        blanked = pattern.sub("_____", t.example_pt, count=1)
        distractors = _distinct_sample(self.rng, self._pt_pool, [t.pt], self.options_target - 1)
        if len(distractors) < 1:
            return None
        options = distractors + [t.pt]
        self.rng.shuffle(options)
        return {
            "id": _pid(),
            "kind": "cloze",
            "instruction": "Fill in the blank:",
            "prompt_text": blanked,
            "options": options,
            "options_are_emoji": False,
            "answer": t.pt,
            "reveal_text": t.example_pt,
            "translation": t.example_en,
            "speak_options": True,
            "source": f"{t.deck_id}/{t.card_id}",
        }

    def pronounce(self, t: Term) -> Optional[dict]:
        target = t.example_pt or t.pt
        return {
            "id": _pid(),
            "kind": "pronounce",
            "instruction": "Say this out loud, then record:",
            "prompt_text": target,
            "audio_text": target,
            "target": target,
            "translation": t.example_en or t.en,
            "source": f"{t.deck_id}/{t.card_id}",
        }


# --------------------------------------------------------------------------- #
# Reinforcement session
# --------------------------------------------------------------------------- #
# Modality weights. Pronunciation is included but rarer (it takes longer).
_REINFORCE_MAKERS = [
    ("mc_word_to_translation", 3),
    ("mc_translation_to_word", 3),
    ("picture_to_word", 3),
    ("word_to_picture", 2),
    ("listening_meaning", 3),
    ("cloze", 3),
    ("pronounce", 2),
]


def generate_reinforcement(
    store: ContentStore,
    deck_ids: List[str],
    count: int = 12,
    include_pronunciation: bool = True,
    seed: Optional[int] = None,
) -> List[dict]:
    rng = random.Random(seed)
    terms = _terms_from_decks(store, deck_ids)
    if not terms:
        return []
    builder = ProblemBuilder(rng=rng, terms=terms)

    makers = [(m, w) for m, w in _REINFORCE_MAKERS if include_pronunciation or m != "pronounce"]

    problems: List[dict] = []
    attempts = 0
    max_attempts = count * 12
    used_signatures = set()
    while len(problems) < count and attempts < max_attempts:
        attempts += 1
        maker_name = rng.choices([m for m, _ in makers], weights=[w for _, w in makers])[0]
        term = rng.choice(terms)
        prob = getattr(builder, maker_name)(term)
        if not prob:
            continue
        sig = (maker_name, prob.get("source"))
        if sig in used_signatures:
            continue
        used_signatures.add(sig)
        problems.append(prob)
    return problems


# --------------------------------------------------------------------------- #
# Per-section knowledge tests
# --------------------------------------------------------------------------- #
def knowledge_for_deck(store: ContentStore, deck_id: str) -> Optional[dict]:
    deck = store.vocab.get(deck_id)
    if not deck:
        return None
    # Distractor pool: this deck, widened with same-level decks if the deck is small.
    deck_ids = [deck_id]
    if len(deck.cards) < 5:
        deck_ids += [d.id for d in store.vocab.values() if d.level == deck.level and d.id != deck_id]
    terms = _terms_from_decks(store, deck_ids)
    own = [t for t in terms if t.deck_id == deck_id]
    rng = random.Random()
    builder = ProblemBuilder(rng=rng, terms=terms)

    problems: List[dict] = []
    for t in own:
        maker = rng.choice(["mc_word_to_translation", "mc_translation_to_word", "cloze"])
        prob = getattr(builder, maker)(t) or builder.mc_word_to_translation(t)
        if prob:
            problems.append(prob)
    rng.shuffle(problems)
    return {
        "id": f"know-{deck_id}",
        "title": f"{deck.title} — knowledge test",
        "kind": "knowledge",
        "section": {"type": "vocab", "id": deck_id, "title": deck.title, "level": deck.level},
        "problems": problems,
    }


def knowledge_for_grammar(store: ContentStore, lesson_id: str) -> Optional[dict]:
    lesson = store.grammar.get(lesson_id)
    if not lesson:
        return None
    rng = random.Random()
    problems: List[dict] = []

    mistakes = list(getattr(lesson, "commonMistakes", []) or [])
    wrong_pool = [m.wrong for m in mistakes if getattr(m, "wrong", None)]
    for m in mistakes:
        right = getattr(m, "right", None)
        if not right:
            continue
        distractors = _distinct_sample(rng, wrong_pool, [right], 3)
        if not distractors:
            continue
        options = distractors + [right]
        rng.shuffle(options)
        problems.append(
            {
                "id": _pid(),
                "kind": "mc_text",
                "instruction": "Choose the correct sentence:",
                "prompt_text": None,
                "options": options,
                "options_are_emoji": False,
                "answer": right,
                "explanation": getattr(m, "note", None),
                "speak_options": True,
                "source": f"{lesson_id}",
            }
        )

    # Example-based comprehension: which Portuguese sentence means <en>?
    examples = []
    for s in getattr(lesson, "sections", []) or []:
        for ex in getattr(s, "examples", []) or []:
            if getattr(ex, "pt", None) and getattr(ex, "en", None):
                examples.append((ex.pt, ex.en))
    pt_pool = [pt for pt, _ in examples]
    for pt, en in examples:
        distractors = _distinct_sample(rng, pt_pool, [pt], 3)
        if len(distractors) < 1:
            continue
        options = distractors + [pt]
        rng.shuffle(options)
        problems.append(
            {
                "id": _pid(),
                "kind": "mc_text",
                "instruction": "Which Portuguese sentence means:",
                "prompt_text": en,
                "options": options,
                "options_are_emoji": False,
                "answer": pt,
                "translation": en,
                "speak_options": True,
                "source": f"{lesson_id}",
            }
        )

    rng.shuffle(problems)
    problems = problems[:12]
    if not problems:
        return None
    return {
        "id": f"know-{lesson_id}",
        "title": f"{lesson.title} — knowledge test",
        "kind": "knowledge",
        "section": {"type": "grammar", "id": lesson_id, "title": lesson.title, "level": lesson.level},
        "problems": problems,
    }


def knowledge_for_phrases(store: ContentStore, collection_id: str) -> Optional[dict]:
    col = store.phrases.get(collection_id)
    if not col:
        return None
    rng = random.Random()
    pts = [p.pt for p in col.phrases]
    ens = [p.en for p in col.phrases]
    problems: List[dict] = []
    for p in col.phrases:
        kind = rng.choice(["meaning", "listening"])
        if kind == "meaning":
            distractors = _distinct_sample(rng, ens, [p.en], 3)
            if len(distractors) < 1:
                continue
            options = distractors + [p.en]
            rng.shuffle(options)
            problems.append(
                {
                    "id": _pid(),
                    "kind": "mc_text",
                    "instruction": "What does this phrase mean?",
                    "prompt_text": p.pt,
                    "audio_text": p.pt,
                    "options": options,
                    "options_are_emoji": False,
                    "answer": p.en,
                    "translation": p.en,
                    "source": f"{collection_id}/{p.id}",
                }
            )
        else:
            distractors = _distinct_sample(rng, ens, [p.en], 3)
            if len(distractors) < 1:
                continue
            options = distractors + [p.en]
            rng.shuffle(options)
            problems.append(
                {
                    "id": _pid(),
                    "kind": "listening",
                    "instruction": "Listen and pick the meaning:",
                    "audio_text": p.pt,
                    "options": options,
                    "options_are_emoji": False,
                    "answer": p.en,
                    "reveal_text": p.pt,
                    "translation": p.en,
                    "source": f"{collection_id}/{p.id}",
                }
            )
    rng.shuffle(problems)
    problems = problems[:12]
    if not problems:
        return None
    return {
        "id": f"know-{collection_id}",
        "title": f"{col.title} — knowledge test",
        "kind": "knowledge",
        "section": {"type": "phrases", "id": collection_id, "title": col.title, "level": col.level},
        "problems": problems,
    }
