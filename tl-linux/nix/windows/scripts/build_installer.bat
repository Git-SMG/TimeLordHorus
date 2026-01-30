@echo off
REM NIX Windows Installer Build Script
REM This script creates the Windows installer using Inno Setup

echo ========================================
echo NIX Installer Build Script
echo ========================================
echo.

REM Check if Inno Setup is installed
set INNO_SETUP="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

if not exist %INNO_SETUP% (
    echo ERROR: Inno Setup not found
    echo.
    echo Please install Inno Setup 6 from:
    echo https://jrsoftware.org/isinfo.php
    echo.
    echo Default installation path: C:\Program Files (x86)\Inno Setup 6\
    pause
    exit /b 1
)

echo [1/3] Checking build output...
if not exist "..\build\dist\NIX\NIX_Control_Center.exe" (
    echo ERROR: Executable not found
    echo Please run build_windows.bat first
    pause
    exit /b 1
)

echo [2/3] Building installer with Inno Setup...
%INNO_SETUP% ..\installer\nix_installer.iss

if errorlevel 1 (
    echo ERROR: Installer build failed
    pause
    exit /b 1
)

echo.
echo [3/3] Installer created successfully!
echo.
echo Output: ..\..\..\nix-windows-installer\NIX_Setup_v1.0.0.exe
echo.
echo You can now distribute this installer to Windows users.
echo.

pause
