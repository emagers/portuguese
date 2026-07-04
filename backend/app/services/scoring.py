"""Pronunciation scoring: sequence alignment, error classification and tips.

This module is pure Python (no heavy deps) so it can be unit-tested on its own.
It provides:
  * Needleman-Wunsch alignment for words and phonemes.
  * Word-level and phoneme-level diffing.
  * A Brazilian-Portuguese-specific tip generator keyed on IPA symbols.
"""
from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from typing import List, Optional, Tuple

# --------------------------------------------------------------------------- #
# Normalisation
# --------------------------------------------------------------------------- #
_PUNCT = re.compile(r"[^\w\sà-ÿÀ-ß]", re.UNICODE)


def normalize(text: str, strip_accents: bool = False) -> str:
    text = (text or "").lower().strip()
    text = _PUNCT.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if strip_accents:
        text = "".join(
            c for c in unicodedata.normalize("NFD", text)
            if unicodedata.category(c) != "Mn"
        )
    return text


def words(text: str) -> List[str]:
    return normalize(text).split()


# --------------------------------------------------------------------------- #
# Generic Needleman-Wunsch alignment
# --------------------------------------------------------------------------- #
def align(a: List[str], b: List[str]) -> List[Tuple[Optional[str], Optional[str]]]:
    """Global alignment of two token lists. Returns pairs; None marks a gap."""
    n, m = len(a), len(b)
    gap = -1
    match_s, mismatch_s = 2, -1
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = i * gap
    for j in range(1, m + 1):
        dp[0][j] = j * gap
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            s = match_s if a[i - 1] == b[j - 1] else mismatch_s
            dp[i][j] = max(
                dp[i - 1][j - 1] + s,
                dp[i - 1][j] + gap,
                dp[i][j - 1] + gap,
            )
    # Traceback
    i, j = n, m
    out: List[Tuple[Optional[str], Optional[str]]] = []
    while i > 0 and j > 0:
        s = match_s if a[i - 1] == b[j - 1] else mismatch_s
        if dp[i][j] == dp[i - 1][j - 1] + s:
            out.append((a[i - 1], b[j - 1]))
            i, j = i - 1, j - 1
        elif dp[i][j] == dp[i - 1][j] + gap:
            out.append((a[i - 1], None))
            i -= 1
        else:
            out.append((None, b[j - 1]))
            j -= 1
    while i > 0:
        out.append((a[i - 1], None))
        i -= 1
    while j > 0:
        out.append((None, b[j - 1]))
        j -= 1
    out.reverse()
    return out


# --------------------------------------------------------------------------- #
# Word-level diff
# --------------------------------------------------------------------------- #
def word_diff(target: str, hypothesis: str) -> dict:
    tgt = words(target)
    hyp = words(hypothesis)
    pairs = align(tgt, hyp)

    tokens = []
    correct = subs = dels = ins = 0
    tgt_idx = 0
    for a, b in pairs:
        if a is not None and b is not None:
            if a == b:
                status = "correct"
                correct += 1
            else:
                status = "substituted"
                subs += 1
            tokens.append({"expected": a, "heard": b, "status": status, "index": tgt_idx})
            tgt_idx += 1
        elif a is not None:  # in target, missing from speech
            status = "missing"
            dels += 1
            tokens.append({"expected": a, "heard": None, "status": status, "index": tgt_idx})
            tgt_idx += 1
        else:  # extra word said
            ins += 1
            tokens.append({"expected": None, "heard": b, "status": "extra", "index": None})

    total = max(1, len(tgt))
    wer = (subs + dels + ins) / total
    word_accuracy = max(0.0, 1.0 - wer)
    return {
        "tokens": tokens,
        "correct": correct,
        "substituted": subs,
        "missing": dels,
        "extra": ins,
        "target_word_count": len(tgt),
        "word_accuracy": round(word_accuracy, 4),
    }


def string_similarity(target: str, hypothesis: str) -> float:
    return SequenceMatcher(None, normalize(target), normalize(hypothesis)).ratio()


# --------------------------------------------------------------------------- #
# Phoneme-level diff
# --------------------------------------------------------------------------- #
def _phoneme_tokens(ph: str) -> List[str]:
    """Split a phoneme string into individual IPA symbols.

    Works for both espeak-ng output (phonemes grouped per word, space-separated
    between words) and the acoustic model (one phoneme per space): we always
    split into individual symbols and drop spaces, keeping combining marks and
    modifier letters attached to their base symbol so both sources become
    directly comparable.
    """
    ph = (ph or "").strip()
    if not ph:
        return []
    out: List[str] = []
    for ch in ph:
        if ch.isspace():
            continue
        if (unicodedata.combining(ch) or ch in "ːˈˌʲʷʰ̃ⁿ") and out:
            out[-1] += ch
        else:
            out.append(ch)
    return out


def phoneme_diff(ref_ph: str, hyp_ph: str) -> dict:
    ref = _phoneme_tokens(ref_ph)
    hyp = _phoneme_tokens(hyp_ph)
    pairs = align(ref, hyp)
    correct = subs = dels = ins = 0
    errors = []
    for a, b in pairs:
        if a is not None and b is not None:
            if a == b:
                correct += 1
            else:
                subs += 1
                errors.append({"expected": a, "heard": b, "type": "substituted"})
        elif a is not None:
            dels += 1
            errors.append({"expected": a, "heard": None, "type": "missing"})
        else:
            ins += 1
            errors.append({"expected": None, "heard": b, "type": "extra"})
    total = max(1, len(ref))
    per = (subs + dels + ins) / total  # phoneme error rate
    accuracy = max(0.0, 1.0 - per)
    return {
        "reference": ref,
        "hypothesis": hyp,
        "correct": correct,
        "substituted": subs,
        "missing": dels,
        "extra": ins,
        "errors": errors,
        "phoneme_accuracy": round(accuracy, 4),
    }


# --------------------------------------------------------------------------- #
# Brazilian-Portuguese pronunciation tips (keyed on IPA symbols)
# --------------------------------------------------------------------------- #
PHONEME_TIPS = {
    "ɐ̃": "Nasal 'ã/an/am' — let air flow through the nose; don't add a hard 'n'.",
    "ã": "Nasal 'ã' — nasalise the vowel; avoid a separate 'n' sound.",
    "õ": "Nasal 'õ/om/on' — round the lips and nasalise, as in 'bom'.",
    "ẽ": "Nasal 'em/en' — nasalise, as in 'tem'.",
    "ĩ": "Nasal 'im/in' — nasalise, as in 'sim'.",
    "ũ": "Nasal 'um/un' — nasalise, as in 'um'.",
    "ʁ": "The strong Brazilian 'r' (rr, or r at word start) — pronounce like a throaty 'h'.",
    "x": "Word-initial/double 'r' often sounds like English 'h' in Brazil.",
    "h": "This 'r' is aspirated like an English 'h' (e.g. 'carro', 'rato').",
    "ɾ": "The soft tapped 'r' between vowels — a quick flap, like the 'tt' in American 'butter'.",
    "ʎ": "The 'lh' sound — like the 'lli' in 'million'; press the tongue to the palate.",
    "ɲ": "The 'nh' sound — like the 'ny' in 'canyon'.",
    "dʒ": "'di/de' before 'i'-sounds palatalises to 'dj' (like 'j' in 'jeep'): 'dia' ≈ 'jia'.",
    "tʃ": "'ti/te' before 'i'-sounds palatalises to 'tch' (like 'ch' in 'cheese'): 'tia' ≈ 'tcheea'.",
    "w": "Final/‑l after a vowel becomes a 'w' sound in Brazil: 'Brasil' ≈ 'Braziw'.",
    "ɫ": "Syllable-final 'l' becomes a 'w' glide in Brazilian Portuguese.",
    "e": "Closed 'ê' — a tighter 'e' than English; keep the tongue high.",
    "ɛ": "Open 'é' — like the 'e' in 'bet', mouth more open.",
    "o": "Closed 'ô' — round the lips, like the 'o' in 'go' without the glide.",
    "ɔ": "Open 'ó' — like the 'aw' in 'law'.",
    "u": "Unstressed final '-o' is pronounced 'u': 'gato' ≈ 'gatu'.",
    "i": "Unstressed final '-e' is pronounced 'i': 'noite' ≈ 'noitchi'.",
    "z": "'s' between vowels is voiced like 'z': 'casa' ≈ 'caza'.",
    "s": "Keep this 's' crisp and unvoiced.",
}


def tips_from_errors(errors: List[dict]) -> List[str]:
    seen = []
    out: List[str] = []
    for e in errors:
        sym = e.get("expected") or ""
        # Try full symbol, then base character.
        tip = PHONEME_TIPS.get(sym)
        if not tip:
            for ch in sym:
                if ch in PHONEME_TIPS:
                    tip = PHONEME_TIPS[ch]
                    break
        if tip and tip not in seen:
            seen.append(tip)
            out.append(tip)
        if len(out) >= 5:
            break
    return out


# --------------------------------------------------------------------------- #
# Overall score + verdict
# --------------------------------------------------------------------------- #
def overall_score(
    word_accuracy: float,
    similarity: float,
    phoneme_accuracy: Optional[float] = None,
    mean_confidence: Optional[float] = None,
) -> int:
    """Blend available signals into a single 0-100 pronunciation score."""
    parts = [(word_accuracy, 0.45), (similarity, 0.25)]
    if phoneme_accuracy is not None:
        parts.append((phoneme_accuracy, 0.30))
    if mean_confidence is not None:
        parts.append((mean_confidence, 0.10))
    total_w = sum(w for _, w in parts)
    score = sum(v * w for v, w in parts) / total_w
    return int(round(max(0.0, min(1.0, score)) * 100))


def verdict(score: int) -> str:
    if score >= 90:
        return "Excellent — you sound very natural!"
    if score >= 75:
        return "Great job — very understandable with minor slips."
    if score >= 60:
        return "Good — understandable, but a few sounds need work."
    if score >= 40:
        return "Keep practising — focus on the highlighted words and sounds."
    return "Let's slow down and try again, one word at a time."
