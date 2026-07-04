"""Pronunciation assessment endpoint.

Pipeline (each layer degrades gracefully if its dependency is missing):
  1. Decode the uploaded recording to 16 kHz mono (via faster-whisper's PyAV).
  2. Transcribe with Whisper -> what you were understood to say + word confidences.
  3. Word-level diff against the target phrase.
  4. If espeak-ng is present: phonemise the target (reference IPA). Get the
     learner's phonemes from the wav2vec2 acoustic model if available, else from
     espeak on the transcript. Diff phonemes -> targeted sound tips.
  5. Blend signals into a 0-100 score with actionable feedback.
"""
from __future__ import annotations

import io

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import db
from ..services import (
    asr_service,
    phoneme_asr_service,
    phoneme_service,
    scoring,
    tts_service,
)

router = APIRouter(prefix="/api/pronunciation", tags=["pronunciation"])


@router.get("/status")
def pron_status():
    return {
        "asr": asr_service.status(),
        "phonemes": phoneme_service.status(),
        "acoustic_phonemes": phoneme_asr_service.status(),
        "tts": tts_service.status(),
        "ready": asr_service.status()["available"],
    }


@router.get("/phonemes")
def reference_phonemes(text: str):
    """Reference IPA for a phrase (used to show the target pronunciation)."""
    return {"text": text, "ipa": phoneme_service.phonemize(text, keep_stress=True)}


@router.post("/assess")
async def assess(
    target_text: str = Form(...),
    audio: UploadFile = File(...),
):
    if not asr_service.status()["available"]:
        raise HTTPException(
            503,
            "Speech recognition is not installed yet. Run scripts/setup.ps1 to "
            "enable pronunciation practice.",
        )

    content = await audio.read()
    if not content:
        raise HTTPException(400, "Empty audio upload.")

    # 1. Decode to 16 kHz mono float32.
    try:
        from faster_whisper.audio import decode_audio

        wave = decode_audio(io.BytesIO(content), sampling_rate=16000)
    except Exception as exc:
        raise HTTPException(400, f"Could not decode audio: {exc}")

    if wave is None or len(wave) < 1600:  # < 0.1s
        raise HTTPException(400, "Recording too short — please try again.")

    # 2. Transcribe.
    try:
        asr = asr_service.transcribe(wave, language="pt")
    except Exception as exc:
        raise HTTPException(500, f"Transcription failed: {exc}")
    transcript = asr["text"]
    confs = [w["probability"] for w in asr.get("words", []) if "probability" in w]
    mean_conf = sum(confs) / len(confs) if confs else None

    # 3. Word-level diff.
    wdiff = scoring.word_diff(target_text, transcript)
    similarity = scoring.string_similarity(target_text, transcript)

    # 4. Phoneme layer.
    # Score against espeak phonemes of the transcript (same inventory as the
    # espeak reference -> reliable, no false zeros). The acoustic model output
    # is surfaced separately as "sounds we detected from your voice".
    phoneme_result = None
    tips = []
    ref_ph = phoneme_service.phonemize(target_text, keep_stress=False)
    if ref_ph:
        hyp_ph = phoneme_service.phonemize(transcript, keep_stress=False)
        if hyp_ph is not None:
            pdiff = scoring.phoneme_diff(ref_ph, hyp_ph)
            pdiff["source"] = "transcript"
            phoneme_result = pdiff
            tips = scoring.tips_from_errors(pdiff["errors"])

    # Acoustic phonemes: what the learner actually produced (insight only).
    acoustic_ph = phoneme_asr_service.recognize(wave)

    # 5. Blend score.
    score = scoring.overall_score(
        word_accuracy=wdiff["word_accuracy"],
        similarity=similarity,
        phoneme_accuracy=phoneme_result["phoneme_accuracy"] if phoneme_result else None,
        mean_confidence=mean_conf,
    )

    # Word-level tips when we have no phoneme detail.
    if not tips:
        bad = [
            t["expected"]
            for t in wdiff["tokens"]
            if t["status"] in ("substituted", "missing") and t["expected"]
        ]
        if bad:
            tips.append(
                "Focus on these words: " + ", ".join(bad[:6]) + "."
            )
        else:
            tips.append("Nicely done — your words matched the target.")

    db.save_pronunciation(target_text, float(score), transcript)

    return {
        "target": target_text,
        "transcript": transcript,
        "score": score,
        "verdict": scoring.verdict(score),
        "similarity": round(similarity, 4),
        "mean_confidence": round(mean_conf, 4) if mean_conf is not None else None,
        "words": wdiff,
        "phonemes": phoneme_result,
        "acoustic_phonemes": acoustic_ph,
        "reference_ipa": phoneme_service.phonemize(target_text, keep_stress=True),
        "tips": tips,
    }
