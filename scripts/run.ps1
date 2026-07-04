# Starts the backend (FastAPI) and frontend (Vite) dev servers in separate
# windows. Open http://localhost:5173 once both are up.
#
#   powershell -ExecutionPolicy Bypass -File scripts\run.ps1
[CmdletBinding()]
param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPy)) {
    Write-Host "Backend not set up. Run scripts\setup.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "Starting backend on http://127.0.0.1:$BackendPort …" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "`$env:PYTHONIOENCODING='utf-8'; Set-Location '$backend'; " +
    "& '$venvPy' -m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort"
)

Start-Sleep -Seconds 2

Write-Host "Starting frontend on http://localhost:$FrontendPort …" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$frontend'; npm run dev -- --port $FrontendPort"
)

Write-Host "`nBoth servers launching in new windows." -ForegroundColor Green
Write-Host "  App:      http://localhost:$FrontendPort"
Write-Host "  API docs: http://127.0.0.1:$BackendPort/docs"
Write-Host "Close those windows to stop the servers."
