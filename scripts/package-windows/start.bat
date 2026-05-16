@echo off
cd /d %~dp0

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required before running this app.
  echo Download it from: https://nodejs.org/zh-cn/download
  pause
  exit /b 1
)

echo Starting Ruankao Practice...
echo Open http://localhost:8787
npm start
pause
