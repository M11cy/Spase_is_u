@echo off
setlocal

cd /d "%~dp0"
set "SITE_URL=http://127.0.0.1:5173/"

if exist ".server.pid" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$pidText = Get-Content -LiteralPath '.server.pid' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($pidText -and (Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue)) { exit 0 } else { exit 1 }"
  if not errorlevel 1 (
    echo Server is already running.
    start "" "%SITE_URL%"
    exit /b 0
  )
  del ".server.pid" >nul 2>nul
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

echo Starting server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = (Resolve-Path '.').Path; $vite = Join-Path $root 'node_modules\vite\bin\vite.js'; $p = Start-Process -FilePath 'node.exe' -ArgumentList @($vite, '--host', '127.0.0.1') -WorkingDirectory $root -WindowStyle Minimized -PassThru; Set-Content -LiteralPath '.server.pid' -Value $p.Id"
if errorlevel 1 (
  echo Failed to start server.
  pause
  exit /b 1
)

timeout /t 3 /nobreak >nul
start "" "%SITE_URL%"
echo Site opened: %SITE_URL%
