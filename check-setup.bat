@echo off
echo ========================================
echo   SafeNex Silent Room - Setup Check
echo ========================================
echo.

REM Check if MongoDB is installed
where mongod >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] MongoDB is NOT installed
    echo     Download from: https://www.mongodb.com/try/download/community
    echo.
) else (
    echo [OK] MongoDB is installed
)

REM Check if MongoDB is running
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] MongoDB is running
) else (
    echo [X] MongoDB is NOT running
    echo     Run: start-mongodb.bat
    echo.
)

REM Check if .env file exists
if exist ".env" (
    echo [OK] .env file exists
) else (
    echo [X] .env file NOT found
    echo.
)

REM Check if node_modules exists
if exist "node_modules" (
    echo [OK] Dependencies installed
) else (
    echo [X] Dependencies NOT installed
    echo     Run: npm install
    echo.
)

REM Check if mongoose is installed
if exist "node_modules\mongoose" (
    echo [OK] Mongoose is installed
) else (
    echo [X] Mongoose NOT installed
    echo     Run: npm install mongoose
    echo.
)

echo.
echo ========================================
echo   Setup Status Summary
echo ========================================
echo.
echo If all checks show [OK], you're ready!
echo.
echo Next steps:
echo 1. If MongoDB is not running: run start-mongodb.bat
echo 2. Start server: npm start
echo 3. Open browser: http://localhost:5000
echo 4. Login and click "Enter Silent Room"
echo.
pause
