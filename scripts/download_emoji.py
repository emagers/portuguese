#!/usr/bin/env python
"""Download the OpenMoji SVGs used by the vocabulary content.

Scans every vocabulary card for an ``emoji`` field, resolves each emoji to its
OpenMoji SVG (by Unicode code point), downloads only those SVGs into
``frontend/public/openmoji/`` and writes a ``manifest.json`` mapping each emoji
character to its SVG filename. The frontend renders pictures from these local
files (with a fallback to the system emoji when one is missing).

OpenMoji is free and open-source (CC BY-SA 4.0): https://openmoji.org
Re-running is safe; existing files are skipped.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOCAB_DIR = ROOT / "backend" / "content" / "vocabulary"
OUT_DIR = ROOT / "frontend" / "public" / "openmoji"
CDN = "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/color/svg"


def collect_emoji() -> set[str]:
    emojis: set[str] = set()
    for f in VOCAB_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for card in data.get("cards", []):
            e = card.get("emoji")
            if e:
                emojis.add(e)
    return emojis


def codepoint_variants(emoji: str) -> list[str]:
    """Candidate OpenMoji filenames (without extension) for an emoji string."""
    cps = [ord(c) for c in emoji]
    variants: list[str] = []

    def add(seq: list[int]) -> None:
        name = "-".join(f"{c:04X}" for c in seq)
        if name and name not in variants:
            variants.append(name)

    add(cps)
    no_fe0f = [c for c in cps if c != 0xFE0F]
    if no_fe0f != cps:
        add(no_fe0f)
    if cps:
        add([cps[0]])
    return variants


def download(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "aprender-portugues"})
        with urllib.request.urlopen(req, timeout=30) as r:
            if r.status != 200:
                return False
            data = r.read()
        dest.write_bytes(data)
        return True
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return False


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    emojis = collect_emoji()
    print(f"Found {len(emojis)} distinct emoji in vocabulary content.")

    manifest: dict[str, str] = {}
    missing: list[str] = []
    for emoji in sorted(emojis):
        resolved = None
        for name in codepoint_variants(emoji):
            dest = OUT_DIR / f"{name}.svg"
            if dest.exists() and dest.stat().st_size > 0:
                resolved = f"{name}.svg"
                break
            if download(f"{CDN}/{name}.svg", dest):
                resolved = f"{name}.svg"
                break
        if resolved:
            manifest[emoji] = resolved
        else:
            missing.append(emoji)

    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=0), encoding="utf-8"
    )
    print(f"Downloaded/verified {len(manifest)} OpenMoji SVGs -> {OUT_DIR}")
    if missing:
        print(f"No OpenMoji match for {len(missing)} emoji (will use system emoji): {' '.join(missing)}")


if __name__ == "__main__":
    main()
