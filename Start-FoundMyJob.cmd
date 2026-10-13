@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 LTS is recommended. Install it from https://nodejs.org/
  pause
  exit /b 1
)
node --env-file-if-exists=.env.local scripts/start-local.mjs
if errorlevel 1 pause
