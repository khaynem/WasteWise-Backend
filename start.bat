@echo off
echo Starting development servers...

start "Backend" cmd /k "set PORT=3001 && npm run dev"

echo Backend: http://localhost:3001
echo Press any key to continue...
pause
