"""Acoustic phoneme recognition using a wav2vec2 model (optional, GPU-friendly).

This recognises the phonemes the learner *actually produced*, independent of
any language-model correction that Whisper applies. Comparing these acoustic
phonemes to the espeak reference catches mispronunciations that a plain
transcript would hide (e.g. saying "carro" without the strong Brazilian R).

Requires torch + transformers. Loads lazily; if unavailable, the pronunciation
endpoint simply omits the acoustic-phoneme layer.
"""
from __future__ import annotations

import importlib.util
import logging
import os
import re
import threading
from typing import TYPE_CHECKING, Optional

from ..config import settings

if TYPE_CHECKING:  # pragma: no cover
    import numpy as np

logger = logging.getLogger("portugues.phoneme_asr")

_model = None
_processor = None
_lock = threading.Lock()
_load_error: Optional[str] = None
_device = "cpu"

_STRESS_LEN = re.compile(r"[ˈˌː]")

_ESPEAK_DLL_CANDIDATES = [
    r"C:\Program Files\eSpeak NG\libespeak-ng.dll",
    r"C:\Program Files (x86)\eSpeak NG\libespeak-ng.dll",
]


def _ensure_espeak_library() -> None:
    """The wav2vec2-phoneme tokenizer needs phonemizer, which needs the espeak
    shared library. Point it at the default Windows install if not already set."""
    if os.environ.get("PHONEMIZER_ESPEAK_LIBRARY"):
        return
    for p in _ESPEAK_DLL_CANDIDATES:
        if os.path.exists(p):
            os.environ["PHONEMIZER_ESPEAK_LIBRARY"] = p
            return


def available() -> bool:
    return (
        settings.enable_phoneme_model
        and importlib.util.find_spec("torch") is not None
        and importlib.util.find_spec("transformers") is not None
    )


def status() -> dict:
    return {
        "available": available(),
        "engine": "wav2vec2-espeak" if available() else "none",
        "model": settings.phoneme_model,
        "loaded": _model is not None,
        "device": _device if _model is not None else None,
        "load_error": _load_error,
        "reason": None
        if available()
        else "torch/transformers not installed (acoustic phoneme layer disabled).",
    }


def _load():
    global _model, _processor, _load_error, _device
    if _model is not None:
        return
    with _lock:
        if _model is not None:
            return
        _ensure_espeak_library()
        import torch  # type: ignore
        from transformers import (  # type: ignore
            AutoModelForCTC,
            AutoProcessor,
        )

        # Default to CPU: torch CUDA/cuDNN on Windows can hard-crash the process
        # for this model. Short clips run fine on CPU. Opt into GPU with
        # PHONEME_DEVICE=cuda once your CUDA/cuDNN stack is verified.
        _device = settings.phoneme_device
        if _device == "cuda" and not torch.cuda.is_available():
            _device = "cpu"
        logger.info("Loading phoneme model %s on %s", settings.phoneme_model, _device)
        try:
            _processor = AutoProcessor.from_pretrained(
                settings.phoneme_model,
                cache_dir=str(settings.models_cache_dir / "hf"),
            )
            _model = AutoModelForCTC.from_pretrained(
                settings.phoneme_model,
                cache_dir=str(settings.models_cache_dir / "hf"),
            ).to(_device)
            _model.eval()
        except Exception as exc:
            _load_error = str(exc)
            logger.warning("Phoneme model load failed: %s", exc)
            raise


def recognize(audio: "np.ndarray", keep_stress: bool = False) -> Optional[str]:
    """Return space-separated phonemes for a 16 kHz mono float32 waveform."""
    if not available():
        return None
    try:
        _load()
    except Exception:
        return None
    import torch  # type: ignore

    inputs = _processor(
        audio, sampling_rate=16000, return_tensors="pt"
    ).input_values.to(_device)
    with torch.no_grad():
        logits = _model(inputs).logits
    ids = torch.argmax(logits, dim=-1)
    text = _processor.batch_decode(ids)[0]
    if not keep_stress:
        text = _STRESS_LEN.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None
