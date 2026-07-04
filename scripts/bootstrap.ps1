# =============================================================================
# Aprender Portugues :: one-command bootstrap
#
#   powershell -ExecutionPolicy Bypass -File scripts\bootstrap.ps1
#
# This single script does EVERYTHING:
#   1. Checks for (and, via winget, offers to install) Python and Node.js.
#   2. Installs all backend + frontend dependencies (delegates to setup.ps1).
#   3. Downloads all models (Piper voices, Whisper, wav2vec2) and eSpeak NG.
#   4. Launches the backend + frontend and opens the app in your browser.
#
# Flags (forwarded to setup.ps1):
#   -SkipTorch   Skip the large PyTorch install (word/phoneme scoring still work).
#   -CpuTorch    Force the CPU build of PyTorch instead of CUDA.
#   -NoRun       Set up everything but do not launch the servers.
# =============================================================================
[CmdletBinding()]
param(
    [switch]$SkipTorch,
    [switch]$CpuTorch,
    [switch]$NoRun
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " Aprender Portugues - bootstrap" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# --- 1. Prerequisites: Python 3 and Node.js -------------------------------- #
$missing = @()
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { $missing += "Python.Python.3.12" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "OpenJS.NodeJS.LTS" }

if ($missing.Count -gt 0) {
    Write-Host "`nMissing prerequisites: $($missing -join ', ')" -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        foreach ($id in $missing) {
            Write-Host "Installing $id via winget..." -ForegroundColor Yellow
            winget install --id $id -e --accept-package-agreements --accept-source-agreements
        }
        Write-Host "`nPrerequisites installed. PATH changes need a fresh shell." -ForegroundColor Green
        Write-Host "Please OPEN A NEW TERMINAL and run this script again to finish." -ForegroundColor Green
        exit 0
    }
    Write-Host "winget is not available. Install these manually and re-run:" -ForegroundColor Red
    Write-Host "  * Python 3.10+  ->  https://www.python.org/downloads/" -ForegroundColor Red
    Write-Host "  * Node.js 18+   ->  https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host ("Python : " + (python --version)) -ForegroundColor DarkGray
Write-Host ("Node   : " + (node --version)) -ForegroundColor DarkGray

# --- 2 + 3. Dependencies, tools and models --------------------------------- #
$setupArgs = @{}
if ($SkipTorch) { $setupArgs["SkipTorch"] = $true }
if ($CpuTorch) { $setupArgs["CpuTorch"] = $true }
& (Join-Path $scriptDir "setup.ps1") @setupArgs

# --- 4. Launch ------------------------------------------------------------- #
if ($NoRun) {
    Write-Host "`nSetup complete. Start the app later with:" -ForegroundColor Green
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\run.ps1"
    exit 0
}

& (Join-Path $scriptDir "run.ps1")

# Give the servers a moment, then open the browser.
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"
