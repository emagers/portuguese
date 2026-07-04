"""Grapheme-to-phoneme via espeak-ng (for reference pronunciation).

espeak-ng converts target Brazilian Portuguese text into IPA phonemes. We use
this as the *reference* against which the learner's speech is compared. If
espeak-ng is not installed, phoneme-level analysis is skipped and the app falls
back to word-level scoring.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Optional

_STRESS_LEN = re.compile(r"[ˈˌː]")
_LANG_SWITCH = re.compile(r"\([^)]*\)")


def find_espeak() -> Optional[str]:
    exe = shutil.which("espeak-ng") or shutil.which("espeak")
    if exe:
        return exe
    for c in [
        r"C:\Program Files\eSpeak NG\espeak-ng.exe",
        r"C:\Program Files (x86)\eSpeak NG\espeak-ng.exe",
    ]:
        if Path(c).exists():
            return c
    return None


def status() -> dict:
    exe = find_espeak()
    return {
        "available": bool(exe),
        "engine": "espeak-ng" if exe else "none",
        "path": exe,
        "reason": None if exe else "espeak-ng not installed (phoneme tips disabled).",
    }


def clean_phonemes(raw: str, keep_stress: bool = False) -> str:
    """Normalise espeak IPA output for alignment."""
    raw = _LANG_SWITCH.sub(" ", raw)
    raw = raw.replace("\n", " ").replace("_", " ")
    if not keep_stress:
        raw = _STRESS_LEN.sub("", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw


def phonemize(text: str, voice: str = "pt-br", keep_stress: bool = False) -> Optional[str]:
    """Return space-separated IPA phonemes for ``text`` or None if unavailable."""
    exe = find_espeak()
    text = (text or "").strip()
    if not exe or not text:
        return None
    try:
        proc = subprocess.run(
            [exe, "-q", "-v", voice, "--ipa"],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )
    except Exception:
        return None
    if proc.returncode != 0:
        return None
    out = proc.stdout.decode("utf-8", "ignore")
    return clean_phonemes(out, keep_stress=keep_stress)
