# NIX Windows Build Guide

## Building NIX for Windows

This guide explains how to build the Windows distribution of NIX Control Center from source.

## Prerequisites

### Required Software

1. **Python 3.11 or later**
   - Download from: https://www.python.org/downloads/
   - **Important**: Check "Add Python to PATH" during installation

2. **PyInstaller**
   - Install via pip (instructions below)

3. **Inno Setup 6** (for installer creation)
   - Download from: https://jrsoftware.org/isinfo.php
   - Install to default location: `C:\Program Files (x86)\Inno Setup 6\`

### Optional Software

4. **Git for Windows** (for cloning repository)
   - Download from: https://git-scm.com/download/win

5. **Visual Studio Code** (for editing)
   - Download from: https://code.visualstudio.com/

## Build Process

### Step 1: Prepare Environment

```batch
REM Clone repository (if not already done)
git clone https://github.com/TimeLordHorus/TimeLordHorus.git
cd TimeLordHorus/tl-linux/nix

REM Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate

REM Install dependencies
pip install -r requirements.txt
pip install pyinstaller
```

### Step 2: Build Executable

#### Option A: Using Build Script (Easiest)

```batch
cd windows\scripts
build_windows.bat
```

The script will:
1. Check Python installation
2. Install dependencies
3. Run PyInstaller
4. Create executable in `windows\build\dist\NIX\`

#### Option B: Manual Build

```batch
cd windows\build
pyinstaller nix.spec
```

**Output**: `dist\NIX\NIX_Control_Center.exe` (plus supporting files)

### Step 3: Test Executable

```batch
cd dist\NIX
NIX_Control_Center.exe
```

Test the following:
- ✓ Application launches
- ✓ GUI displays correctly
- ✓ Can import documents
- ✓ Can verify documents
- ✓ Wallet operations work

### Step 4: Build Installer

#### Option A: Using Build Script

```batch
cd windows\scripts
build_installer.bat
```

#### Option B: Manual Build

```batch
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" windows\installer\nix_installer.iss
```

**Output**: `nix-windows-installer\NIX_Setup_v1.0.0.exe`

### Step 5: Test Installer

1. **Run installer**:
   ```batch
   nix-windows-installer\NIX_Setup_v1.0.0.exe
   ```

2. **Test installation**:
   - Check Start Menu shortcuts
   - Launch application
   - Verify all features work
   - Test uninstaller

3. **Clean test**:
   - Uninstall
   - Delete AppData folder: `%APPDATA%\NIX`
   - Reinstall and test fresh install

## Build Outputs

### Executable (Portable)

**Location**: `windows\build\dist\NIX\`

**Contents**:
```
NIX\
├── NIX_Control_Center.exe    (Main executable)
├── _internal\                 (Python runtime and dependencies)
│   ├── python311.dll
│   ├── cryptography libs
│   └── ...
├── README.md
├── NIX_ARCHITECTURE.md
└── SETUP.md
```

**Size**: ~40-60 MB

**Usage**: Can be zipped and distributed as portable version

### Installer

**Location**: `nix-windows-installer\NIX_Setup_v1.0.0.exe`

**Size**: ~45-70 MB (compressed)

**Features**:
- Complete installation wizard
- Start Menu shortcuts
- Desktop shortcut (optional)
- File associations
- Uninstaller
- Creates AppData directories

## Customization

### Change Application Icon

1. Create or obtain icon file: `nix_icon.ico`
   - Recommended size: 256x256 pixels
   - Format: Windows ICO file

2. Place in: `windows\`

3. PyInstaller will use it automatically (specified in `nix.spec`)

### Modify Version Information

Edit `windows\build\version_info.txt`:

```python
filevers=(1, 0, 1, 0),        # File version
prodvers=(1, 0, 1, 0),        # Product version
FileVersion='1.0.1.0',
ProductVersion='1.0.1.0'
```

Also update `windows\installer\nix_installer.iss`:

```ini
#define MyAppVersion "1.0.1"
```

### Add Additional Files

Edit `windows\build\nix.spec`:

```python
datas=[
    ('../../README.md', '.'),
    ('../../your_new_file.txt', '.'),  # Add here
],
```

### Customize Installer

Edit `windows\installer\nix_installer.iss`:

- **License**: Change `LicenseFile` path
- **Shortcuts**: Modify `[Icons]` section
- **Install location**: Change `DefaultDirName`
- **Wizard images**: Add `WizardImageFile` and `WizardSmallImageFile`

## Advanced Build Options

### UPX Compression

UPX compresses executables. Already enabled in spec file:

```python
upx=True,
upx_exclude=[],
```

To disable (faster build, larger file):
```python
upx=False,
```

### Single File vs Folder

Current build: **Folder** (one executable + _internal folder)

To create single-file executable, modify `nix.spec`:

```python
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,  # Include these
    a.zipfiles,  # Include these
    a.datas,     # Include these
    [],
    name='NIX_Control_Center',
    ...
    onefile=True,  # ADD THIS
)
```

**Trade-offs**:
- **Single file**: Easier distribution, slower startup, larger file
- **Folder**: Faster startup, smaller main exe, requires folder

### Code Signing (Optional)

For production distribution, sign the executable:

```batch
REM Using Windows SDK signtool
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com NIX_Control_Center.exe
```

Benefits:
- Removes "Unknown Publisher" warning
- Builds trust with users
- Required for some enterprise deployments

**Note**: Requires code signing certificate ($100-400/year)

### Debug Build

For troubleshooting, create debug build:

In `nix.spec`:
```python
exe = EXE(
    ...
    debug=True,      # Enable debug
    console=True,    # Show console
    ...
)
```

## Troubleshooting Build Issues

### PyInstaller Fails

**Error**: `ModuleNotFoundError`

**Solution**: Add to hidden imports in `nix.spec`:
```python
hiddenimports=[
    'your_missing_module',
],
```

### Import Errors

**Error**: `Failed to execute script`

**Solution**:
1. Check console output (build with `console=True`)
2. Ensure all dependencies in requirements.txt
3. Test Python script before building

### Large Executable Size

**Solutions**:
1. Enable UPX compression (already enabled)
2. Exclude unnecessary packages
3. Use virtual environment to minimize dependencies
4. Exclude test files and documentation from exe

### Inno Setup Not Found

**Error**: `ISCC.exe not found`

**Solution**:
1. Install Inno Setup
2. Update path in `build_installer.bat`
3. Or run ISCC.exe directly with full path

### Permission Errors

**Solution**: Run Command Prompt as Administrator:
1. Right-click Command Prompt
2. Select "Run as administrator"
3. Navigate to build directory
4. Run build scripts

## Distribution

### Portable ZIP Distribution

```batch
REM Create portable package
cd windows\build\dist
powershell Compress-Archive -Path NIX -DestinationPath NIX_Portable_v1.0.0.zip
```

**Upload to**: GitHub Releases, website, etc.

### Installer Distribution

**File**: `NIX_Setup_v1.0.0.exe`

**Distribution channels**:
- GitHub Releases (recommended)
- Direct download from website
- Software distribution platforms

### Checksums

Generate checksums for verification:

```batch
REM SHA256 checksum
certutil -hashfile NIX_Setup_v1.0.0.exe SHA256 > checksums.txt
certutil -hashfile NIX_Portable_v1.0.0.zip SHA256 >> checksums.txt
```

Include in release notes.

## Automated Builds

### GitHub Actions (CI/CD)

Create `.github\workflows\build-windows.yml`:

```yaml
name: Build Windows

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pyinstaller
      - name: Build executable
        run: |
          cd windows/build
          pyinstaller nix.spec
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: NIX-Windows
          path: windows/build/dist/NIX/
```

## Build Checklist

Before releasing:

- [ ] Update version numbers (spec, installer, docs)
- [ ] Test on clean Windows installation
- [ ] Verify all features work
- [ ] Check file associations
- [ ] Test installer and uninstaller
- [ ] Generate checksums
- [ ] Sign executable (if applicable)
- [ ] Test on Windows 10 and 11
- [ ] Update changelog
- [ ] Create release notes

## Support

For build issues:
- Check this guide
- Review PyInstaller documentation
- Check Inno Setup documentation
- Open GitHub issue with build logs

## Resources

- **PyInstaller**: https://pyinstaller.org/
- **Inno Setup**: https://jrsoftware.org/isinfo.php
- **Python Windows**: https://www.python.org/downloads/windows/
- **Windows SDK**: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/

---

**Good luck building NIX for Windows!**

For questions, open an issue on GitHub.
