# 🇧🇷 Aprender Português — Local Brazilian Portuguese Tutor

A complete, **self-hosted** Brazilian Portuguese learning app. Everything runs
locally on your machine — no paid APIs, no cloud, no accounts. Grammar,
vocabulary, reading, listening, quizzes, and an AI pronunciation coach that
records your voice and gives sound-by-sound feedback.

## Features

| # | Feature | What it does |
|---|---------|--------------|
| 1 | **Knowledge tests** | 25+ interactive quizzes (multiple-choice, fill-in-the-blank, translation, listening) with instant feedback and scoring. |
| 2 | **Grammar lessons** | 47 lessons from A1 → C2 with tables, examples, key points, and common-mistake callouts. |
| 3 | **Vocabulary** | 31 themed decks (250+ cards) with IPA, examples, flashcards, and spaced-repetition (SM-2) review. |
| 4 | **Stories & conversations** | 27 graded dialogues and stories with glossaries and comprehension questions. |
| 5 | **Audio** | Natural offline text-to-speech (Piper) on every phrase, plus a dictation/listening practice mode. |
| 6 | **Pronunciation coach** | Record yourself → local speech recognition (Whisper) transcribes it → word- and phoneme-level scoring with targeted, Brazilian-specific tips. |

Everything is graded across the six **CEFR levels** (A1 beginner → C2 proficient).

## Tech stack

- **Backend:** Python + FastAPI
- **Frontend:** React + Vite + TypeScript
- **Speech recognition (ASR):** [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (runs on your GPU/CPU)
- **Text-to-speech (TTS):** [Piper](https://github.com/rhasspy/piper) with a Brazilian Portuguese voice
- **Pronunciation phonemes:** eSpeak NG (reference IPA) + optional wav2vec2 acoustic phoneme model
- **Storage:** JSON content files + SQLite for progress. No external services.

## Prerequisites

- Windows 10/11 (scripts are PowerShell; the app itself is cross-platform)
- [Python 3.10+](https://www.python.org/) and [Node.js 18+](https://nodejs.org/)
- ~2 GB free disk for models (more if you enable the acoustic phoneme model)
- A microphone (for the pronunciation coach)
- An NVIDIA GPU is used automatically if available, but everything works on CPU.

## Quick start

```powershell
# 1. Install everything (Python + Node deps, models, optional PyTorch)
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

# 2. Run both servers
powershell -ExecutionPolicy Bypass -File scripts\run.ps1
```

Then open **http://localhost:5173**.

`setup.ps1` flags:
- `-SkipTorch` — skip the large PyTorch install (word + phoneme scoring still work).
- `-CpuTorch` — force the CPU build of PyTorch.

## Manual setup (if you prefer)

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# (optional, for the acoustic phoneme layer)
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu121
.\.venv\Scripts\python.exe -m pip install transformers
cd ..

# Models (Piper voice + Whisper; wav2vec2 too if torch is installed)
.\backend\.venv\Scripts\python.exe scripts\download_models.py

# Frontend
cd frontend
npm install
cd ..

# Run (two terminals)
cd backend; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
cd frontend; npm run dev
```

`espeak-ng` (for phoneme-level pronunciation tips) is installed by `setup.ps1`
via winget, or grab it from the
[eSpeak NG releases](https://github.com/espeak-ng/espeak-ng/releases).

## How pronunciation scoring works

The app degrades gracefully — each layer activates when its dependency is present:

1. **Decode** your recording to 16 kHz mono (via faster-whisper's bundled PyAV — no ffmpeg needed).
2. **Transcribe** with Whisper → what you were understood to say, plus per-word confidence.
3. **Word diff** against the target phrase (alignment → correct / substituted / missing / extra).
4. **Phonemes:** eSpeak NG converts the target to reference IPA. Your phonemes come
   from the wav2vec2 **acoustic** model (if installed) or from the transcript. The two
   are aligned to surface specific mispronounced sounds.
5. **Score** blends word accuracy, string similarity, phoneme accuracy, and ASR
   confidence into 0–100, with Brazilian-specific tips (nasal vowels, the strong
   "r", `lh`/`nh`, `ti`/`di` palatalization, final `-l` → "w", etc.).

## Adding your own content

Content lives as JSON under `backend/content/{grammar,vocabulary,stories,tests}`.
Drop in a new file and hit **"Reload"** (`POST /api/content/reload`) or restart —
no rebuild needed. Copy the shape of the seed files:

- `backend/content/grammar/a1-01-subject-pronouns.json`
- `backend/content/vocabulary/a1-greetings.json`
- `backend/content/stories/a1-cafe.json`
- `backend/content/tests/a1-quiz-pronouns-ser.json`

Schemas are defined in `backend/app/models/content.py`. Validation errors (and
their causes) are reported at `GET /api/system/status` and `GET /api/content/stats`.

## Project layout

```
portugues/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app (always starts; speech features are optional)
│   │   ├── config.py          # paths + model settings (env-overridable)
│   │   ├── content_loader.py  # loads + validates JSON content
│   │   ├── db.py              # SQLite progress + SM-2 spaced repetition
│   │   ├── models/            # Pydantic content schemas
│   │   ├── routers/           # content, progress, tts, pronunciation
│   │   └── services/          # tts, asr, phonemes, scoring
│   ├── content/               # the curriculum (JSON) — edit freely
│   ├── models_cache/          # downloaded models (git-ignored)
│   └── requirements.txt
├── frontend/                  # React + Vite + TypeScript
│   └── src/{pages,components,api}
└── scripts/                   # setup.ps1, run.ps1, download_models.py
```

## Configuration

Override defaults with environment variables (see `backend/app/config.py`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `WHISPER_MODEL` | `small` | Whisper size: `tiny`/`base`/`small`/`medium`/`large-v3`. |
| `WHISPER_DEVICE` | `auto` | `auto`/`cuda`/`cpu`. |
| `PIPER_VOICE` | auto-detected | Path to a Piper `.onnx` voice. |
| `PHONEME_MODEL` | `facebook/wav2vec2-lv-60-espeak-cv-ft` | Acoustic phoneme model. |
| `ENABLE_PHONEME_MODEL` | `1` | Set `0` to disable the acoustic layer. |

## Troubleshooting

- **No audio / robotic voice:** Piper isn't set up yet — run `download_models.py`.
  Until then, audio falls back to your browser's built-in Portuguese voice.
- **"Speech recognition isn't set up":** run `setup.ps1` (installs faster-whisper).
- **No phoneme tips / IPA:** install eSpeak NG (see above).
- **Whisper is slow:** it's using CPU. Install the CUDA PyTorch build, or set a
  smaller `WHISPER_MODEL`.
- **Check what's ready:** open `http://127.0.0.1:8000/api/system/status`.

## Everything is free & offline

All models (Piper, Whisper, wav2vec2) and tools (eSpeak NG) are open-source and
run locally. After the one-time model download, the app needs no internet.
