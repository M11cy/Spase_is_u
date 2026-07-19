@echo off
setlocal

cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo The ready site folder dist was not found.
  echo Building the site now...

  where npm.cmd >nul 2>nul
  if errorlevel 1 (
    echo npm was not found. Reinstall Node.js from https://nodejs.org/ and run this file again.
    pause
    exit /b 1
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

  echo Building dist...
  call npm.cmd run build
  if errorlevel 1 (
    echo Failed to build the site.
    pause
    exit /b 1
  )
)

if not exist "dist\index.html" (
  echo dist\index.html is still missing after build.
  pause
  exit /b 1
)

node.exe serve-dist.js
if errorlevel 1 pause
