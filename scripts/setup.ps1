# One-time setup for the local Brazilian Portuguese tutor.
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#
# Flags:
#   -SkipTorch   Skip the (large) PyTorch install. Pronunciation still works at
#                the word level; the acoustic phoneme layer is disabled.
#   -CpuTorch    Force the CPU build of PyTorch instead of CUDA.
[CmdletBinding()]
param(
    [switch]$SkipTorch,
    [switch]$CpuTorch
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host "=== Aprender Portugues :: setup ===" -ForegroundColor Cyan

# --- checks ---
foreach ($cmd in @("python", "node", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Required tool '$cmd' is not on PATH. Please install it and re-run."
    }
}
Write-Host ("Python : " + (python --version))
Write-Host ("Node   : " + (node --version))

# --- backend venv + deps ---
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Host "`nCreating Python virtual environment…" -ForegroundColor Yellow
    python -m venv (Join-Path $backend ".venv")
}
Write-Host "Installing backend dependencies…" -ForegroundColor Yellow
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install -r (Join-Path $backend "requirements.txt")

# --- PyTorch (for the acoustic phoneme layer) ---
if (-not $SkipTorch) {
    Write-Host "`nInstalling PyTorch (for detailed pronunciation analysis)…" -ForegroundColor Yellow
    $hasCuda = $false
    if (-not $CpuTorch) {
        try { if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { $hasCuda = $true } } catch {}
    }
    if ($hasCuda) {
        Write-Host "  NVIDIA GPU detected — installing CUDA build." -ForegroundColor Green
        & $venvPy -m pip install torch --index-url https://download.pytorch.org/whl/cu121
    } else {
        Write-Host "  Installing CPU build of PyTorch." -ForegroundColor Green
        & $venvPy -m pip install torch --index-url https://download.pytorch.org/whl/cpu
    }
} else {
    Write-Host "`nSkipping PyTorch (word-level pronunciation scoring only)." -ForegroundColor DarkYellow
}

# --- espeak-ng (reference phonemes for pronunciation tips) ---
if (-not (Get-Command espeak-ng -ErrorAction SilentlyContinue) -and
    -not (Test-Path "C:\Program Files\eSpeak NG\espeak-ng.exe")) {
    Write-Host "`nInstalling espeak-ng (phoneme tips)…" -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try { winget install --id eSpeak-NG.eSpeak-NG -e --accept-package-agreements --accept-source-agreements }
        catch { Write-Host "  winget install failed — you can install eSpeak NG manually later." -ForegroundColor DarkYellow }
    } else {
        Write-Host "  winget not available. Install eSpeak NG from https://github.com/espeak-ng/espeak-ng/releases to enable phoneme tips." -ForegroundColor DarkYellow
    }
}

# --- frontend deps ---
Write-Host "`nInstalling frontend dependencies…" -ForegroundColor Yellow
Push-Location $frontend
npm install
Pop-Location

# --- models ---
Write-Host "`nDownloading models (Piper voice + Whisper)…" -ForegroundColor Yellow
$env:PYTHONIOENCODING = "utf-8"
& $venvPy (Join-Path $PSScriptRoot "download_models.py")

Write-Host "`n=== Setup complete! ===" -ForegroundColor Green
Write-Host "Start the app with:  powershell -ExecutionPolicy Bypass -File scripts\run.ps1"
