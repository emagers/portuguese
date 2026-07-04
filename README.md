# 🇧🇷 Aprender Português — Local Brazilian Portuguese Tutor

A complete, **self-hosted** Brazilian Portuguese learning app. Everything runs
locally on your machine — no paid APIs, no cloud, no accounts. Grammar,
vocabulary, reading, listening, quizzes, and an AI pronunciation coach that
records your voice and gives sound-by-sound feedback.

## Features

| # | Feature | What it does |
|---|---------|--------------|
| 1 | **Knowledge tests** | 37+ interactive quizzes / 220+ questions — MC, fill-blank, translation, listening — with instant feedback + saved scores |
| 2 | **Grammar lessons** | 70+ lessons A1→C2 with full conjugation tables, examples, key points, common-mistake callouts, and per-cell click-to-listen. Completion is tracked. |
| 3 | **Vocabulary** | 50+ themed decks / 570+ cards (finite sets like days, months, numbers and colours are complete) with IPA, audio, flashcards + SM-2 spaced repetition and deck completion tracking |
| 4 | **Stories & conversations** | 45 graded dialogues (named, believable characters) and stories with glossaries + comprehension questions. Translations are hidden by default so you decode via the glossary. |
| 5 | **Audio** | Natural offline text-to-speech (Piper) on every phrase, with multiple Brazilian voices so dialogue characters sound different; plus a dictation/listening practice mode |
| 6 | **Pronunciation coach** | Record yourself → local speech recognition (Whisper) transcribes it → word- and phoneme-level scoring with targeted, Brazilian-specific tips |

Everything is graded across the six **CEFR levels** (A1 beginner → C2 proficient).

## Tech stack

- **Backend:** Python + FastAPI
- **Frontend:** React + Vite + TypeScript
- **Speech recognition (ASR):** [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (runs on your GPU/CPU)
- **Text-to-speech (TTS):** [Piper](https://github.com/rhasspy/piper) with three Brazilian Portuguese voices
- **Pronunciation phonemes:** eSpeak NG (reference IPA) + optional wav2vec2 acoustic phoneme model
- **Storage:** JSON content files + SQLite for progress. No external services.

## Prerequisites

You only need these two things installed yourself — the bootstrap script fetches
everything else automatically:

- **Windows 10/11** (the helper scripts are PowerShell; the app itself is cross-platform)
- **[Python 3.10+](https://www.python.org/downloads/)** and **[Node.js 18+](https://nodejs.org/)**
  (both must be on your `PATH`). If they're missing and you have `winget`, the
  bootstrap script offers to install them for you.

Also helpful:
- **~4 GB free disk** for all models (or ~1.5 GB if you skip the acoustic phoneme model with `-SkipTorch`).
- **A microphone** (for the pronunciation coach).
- **An NVIDIA GPU** is used automatically if present (via the CUDA PyTorch build); everything also works on CPU.

## Quick start

One command installs everything (dependencies, tools, and models) and launches the app:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\bootstrap.ps1
```

It opens **http://localhost:5173** when ready. That's it.

Useful flags:
- `-SkipTorch` — skip the large PyTorch download (word + phoneme scoring still work; only the acoustic-voice layer is disabled).
- `-CpuTorch` — force the CPU build of PyTorch instead of CUDA.
- `-NoRun` — install everything but don't launch the servers.

Prefer to do it in two steps? `scripts\setup.ps1` installs everything, then
`scripts\run.ps1` launches the backend + frontend.

## External dependencies (what gets downloaded & installed)

Everything below is free and open-source. Once fetched, the app runs fully
offline. The bootstrap/setup scripts handle all of it automatically.

**System tools (installed via `winget`, or install manually):**

| Tool | Why | Source / auto-install |
|------|-----|-----------------------|
| Python 3.10+ | Backend runtime | winget `Python.Python.3.12` |
| Node.js 18+ | Frontend build/dev server | winget `OpenJS.NodeJS.LTS` |
| eSpeak NG | Reference IPA phonemes for pronunciation tips | winget `eSpeak-NG.eSpeak-NG` (pulls in the VC++ 2015+ redistributable it needs) |

**Python packages** (`backend/requirements.txt`, installed into `backend/.venv`):
`fastapi`, `uvicorn[standard]`, `pydantic`, `python-multipart`,
`faster-whisper` (bundles PyAV, so **no separate ffmpeg install** is needed),
`numpy`, `transformers`, `phonemizer`.

**PyTorch** (installed separately by `setup.ps1` so the right build is chosen):
CUDA `cu124` build if an NVIDIA GPU is detected, otherwise the CPU build. Only
needed for the optional acoustic phoneme model.

**Node packages** (`frontend/package.json`, via `npm install`):
`react`, `react-dom`, `react-router-dom`, plus dev tools `vite`,
`@vitejs/plugin-react`, `typescript`, and type definitions.

**Models** (downloaded by `scripts/download_models.py` into `backend/models_cache/`, git-ignored):

| Model | Size | Purpose |
|-------|------|---------|
| Piper Windows binary + ONNX runtime | ~25 MB | Neural text-to-speech engine |
| Piper voices: `pt_BR-faber`, `pt_BR-cadu`, `pt_BR-jeff` (medium) | ~60 MB each | Distinct Brazilian voices for dialogue characters |
| faster-whisper `small` | ~460 MB | Speech recognition for pronunciation scoring |
| `facebook/wav2vec2-lv-60-espeak-cv-ft` | ~1.2 GB | Optional acoustic phoneme recognition (only if PyTorch is installed) |

## Manual setup (if you prefer)

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# (optional, for the acoustic phoneme layer — use cu124 for GPU, or /cpu)
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu124
cd ..

# Models (Piper voices + Whisper; wav2vec2 too if torch is installed)
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
└── scripts/                   # bootstrap.ps1, setup.ps1, run.ps1, download_models.py
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
