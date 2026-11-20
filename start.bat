@echo off
REM Batloung Farm - double-click to install (first time only) and start everything.
REM Needs: Node.js 18+ and MySQL running. Put your MySQL password in backend\.env (DB_PASSWORD=...).
cd /d "%~dp0"
if not exist backend\node_modules ( echo Installing backend... & call npm install --prefix backend )
if not exist frontend\node_modules ( echo Installing frontend... & call npm install --prefix frontend )
if not exist backend\.setup_done (
  echo Creating the database and sample data...
  call npm run db:init --prefix backend
  if errorlevel 1 ( echo. & echo Database setup failed - check DB_USER / DB_PASSWORD in backend\.env and that MySQL is running. & pause & exit /b 1 )
  echo done> backend\.setup_done
)
start "Batloung API" cmd /k "cd /d %~dp0backend && npm run dev"
start "Batloung Website" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 6 >nul
start http://localhost:5173
