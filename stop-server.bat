@echo off
setlocal

cd /d "%~dp0"

if not exist ".server.pid" (
  echo Server PID file not found. Nothing to stop.
  exit /b 0
)

echo Stopping server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pidText = Get-Content -LiteralPath '.server.pid' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($pidText) { $rootId = [int]$pidText; function Stop-ProcessTree([int]$id) { Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $id } | ForEach-Object { Stop-ProcessTree ([int]$_.ProcessId) }; Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }; Stop-ProcessTree $rootId }"
del ".server.pid" >nul 2>nul

echo Server stopped.
