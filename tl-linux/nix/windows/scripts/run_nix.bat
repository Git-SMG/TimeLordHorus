@echo off
REM NIX Control Center Launcher
REM This script launches the NIX Control Center

title NIX Control Center

echo Starting NIX Control Center...

REM Check if running from build directory
if exist "..\nix_windows_gui.py" (
    REM Running from source
    python ..\nix_windows_gui.py
) else if exist "NIX_Control_Center.exe" (
    REM Running from installation
    NIX_Control_Center.exe
) else (
    echo ERROR: NIX Control Center not found
    echo.
    echo Please ensure you are running this script from the correct directory
    echo or that NIX is properly installed.
    pause
    exit /b 1
)
