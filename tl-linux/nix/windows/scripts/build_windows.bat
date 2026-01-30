@echo off
REM NIX Windows Build Script
REM This script builds the Windows distribution of NIX

echo ========================================
echo NIX Windows Build Script
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11 or later from python.org
    pause
    exit /b 1
)

echo [1/5] Checking Python version...
python --version

echo.
echo [2/5] Installing dependencies...
pip install -r ..\..\requirements.txt
pip install pyinstaller

echo.
echo [3/5] Building executable with PyInstaller...
cd ..\build
pyinstaller nix.spec

if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo [4/5] Checking build output...
if exist "dist\NIX\NIX_Control_Center.exe" (
    echo SUCCESS: Executable created at dist\NIX\NIX_Control_Center.exe
) else (
    echo ERROR: Executable not found
    pause
    exit /b 1
)

echo.
echo [5/5] Build complete!
echo.
echo Next steps:
echo 1. Test the executable: dist\NIX\NIX_Control_Center.exe
echo 2. Build installer with Inno Setup (see build_installer.bat)
echo.

pause
