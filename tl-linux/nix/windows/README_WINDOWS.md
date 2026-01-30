# NIX Control Center - Windows Distribution

## Overview

**NIX Control Center for Windows** is a secure file verification protocol and authorization system that enables government agencies, healthcare providers, educational institutions, and individuals to manage sensitive documents with blockchain-verified authenticity.

## System Requirements

### Minimum Requirements
- **Operating System**: Windows 10 or later (64-bit)
- **RAM**: 4 GB
- **Disk Space**: 200 MB for application + space for documents
- **Display**: 1024x768 or higher resolution
- **.NET Framework**: 4.7.2 or later (usually pre-installed)

### Recommended Requirements
- **Operating System**: Windows 11 (64-bit)
- **RAM**: 8 GB or more
- **Disk Space**: 1 GB or more
- **Display**: 1920x1080 or higher
- **Internet**: For blockchain operations

## Installation

### Option 1: Installer (Recommended)

1. **Download** the installer:
   - `NIX_Setup_v1.0.0.exe`

2. **Run** the installer:
   - Double-click the installer
   - Click "Yes" if prompted by User Account Control
   - Follow the installation wizard

3. **Launch** NIX:
   - Start Menu → NIX → NIX Control Center
   - Or double-click desktop shortcut (if created)

### Option 2: Portable Version

1. **Download** the portable ZIP:
   - `NIX_Portable_v1.0.0.zip`

2. **Extract** to a folder:
   - Right-click → Extract All
   - Choose destination folder

3. **Run** the application:
   - Double-click `NIX_Control_Center.exe`

## Quick Start Guide

### First Time Setup

1. **Launch** NIX Control Center

2. **Wallet Setup**:
   - Your document wallet is automatically created at:
     ```
     C:\Users\<YourName>\AppData\Roaming\NIX\wallet
     ```

3. **Import Your First Document**:
   - Click **Import** button
   - Browse to a `.sec` document file
   - Click Open

### Managing Documents

#### Import Documents
- Click **File → Import Document** (Ctrl+I)
- Or drag and drop `.sec` files onto the wallet

#### Verify Documents
1. Select a document in the wallet
2. Click **Verify** button (Ctrl+V)
3. Choose verification level:
   - **Basic**: Quick signature check
   - **Standard**: + Blockchain verification
   - **Comprehensive**: + Revocation checking
   - **Strict**: Full validation
4. View detailed results

#### Export Documents
- Select document
- Click **File → Export Document** (Ctrl+E)
- Choose destination

#### View Document Info
- Double-click a document
- Or select and press Ctrl+D

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+I | Import Document |
| Ctrl+E | Export Document |
| Ctrl+V | Verify Selected Document |
| Ctrl+D | View Document Info |
| F1 | Help Documentation |
| F5 | Refresh Document List |
| Alt+F4 | Exit Application |

## Features

### Document Wallet
- ✅ Secure encrypted storage
- ✅ Organized document management
- ✅ Quick search and filter
- ✅ Status indicators (Valid/Expired)

### Verification
- ✅ Multi-level verification
- ✅ Blockchain anchoring check
- ✅ Digital signature validation
- ✅ Revocation status
- ✅ Detailed reports

### Security
- ✅ AES-256-GCM encryption
- ✅ Ed25519 digital signatures
- ✅ SHA-256 hashing
- ✅ Blockchain immutability
- ✅ Zero-knowledge proof ready

### Windows Integration
- ✅ Start Menu integration
- ✅ Desktop shortcuts
- ✅ File associations (.sec files)
- ✅ Windows Explorer integration
- ✅ Taskbar pinning support
- ✅ Windows notifications

## Supported Document Types

### Government
- Driver's Licenses
- State IDs
- Vehicle Registration
- Vehicle Titles
- Passports
- Birth Certificates

### Tax Documents
- W-2 Forms
- 1099 Forms
- Tax Returns

### Healthcare
- Prescriptions
- Lab Results
- Medical Records
- Vaccination Records
- Insurance Cards

### Education
- Diplomas
- Transcripts
- Degrees
- Certifications
- Professional Licenses

### Benefits
- SNAP Benefits
- Medicare Cards
- Medicaid Cards
- Unemployment Benefits

## Configuration

### Wallet Location

Default: `C:\Users\<YourName>\AppData\Roaming\NIX\wallet`

To change wallet location:
1. File → Preferences
2. Browse to new location
3. Restart application

### Blockchain Settings

Edit configuration file:
```
C:\Users\<YourName>\AppData\Roaming\NIX\config\blockchain.json
```

Example:
```json
{
  "network": "polygon_mumbai",
  "rpc_url": "https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY"
}
```

## Troubleshooting

### Application Won't Start

**Solution 1**: Run as Administrator
- Right-click NIX Control Center
- Select "Run as administrator"

**Solution 2**: Check Windows Defender
- Windows Security → Virus & threat protection
- Allow NIX Control Center

**Solution 3**: Reinstall Visual C++ Redistributables
- Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe
- Install and restart

### Documents Not Loading

**Check wallet directory**:
1. Click Tools → Open Wallet Folder
2. Verify `.sec` files are present
3. Check file permissions

### Verification Fails

**Common causes**:
- No internet connection (for blockchain)
- Expired documents
- Revoked documents
- Corrupted file

**Solution**:
- Check internet connection
- Verify document expiration date
- Try Basic verification first

### Missing DLL Error

**Solution**:
1. Install Microsoft Visual C++ Redistributable
2. Download from Microsoft website
3. Restart computer

## Backup and Restore

### Backup Your Wallet

**Method 1**: Built-in Backup
1. Tools → Backup Wallet
2. Choose backup location
3. Click OK

**Method 2**: Manual Backup
1. Open wallet folder (Tools → Open Wallet Folder)
2. Copy entire folder to backup location
3. Recommended: Use USB drive or cloud storage

### Restore from Backup

1. Close NIX Control Center
2. Navigate to:
   ```
   C:\Users\<YourName>\AppData\Roaming\NIX\
   ```
3. Replace `wallet` folder with backup
4. Restart NIX Control Center

## Advanced Features

### Command Line Usage

```batch
REM Verify a document
NIX_Control_Center.exe --verify "C:\path\to\document.sec"

REM Import document
NIX_Control_Center.exe --import "C:\path\to\document.sec"

REM Export document
NIX_Control_Center.exe --export "document_id" --output "C:\path\to\output.sec"
```

### Python Integration

For advanced users with Python installed:

```batch
REM Install dependencies
pip install -r requirements.txt

REM Run from source
python nix_windows_gui.py

REM Run examples
python examples\issue_documents.py
python examples\verify_documents.py
```

## Security Best Practices

1. **Regular Backups**
   - Backup wallet weekly
   - Store backups securely (encrypted drive)

2. **Verify Issuers**
   - Only accept documents from trusted entities
   - Check issuer information carefully

3. **Keep Software Updated**
   - Check for updates regularly
   - Install security patches

4. **Protect Your Computer**
   - Use antivirus software
   - Keep Windows updated
   - Use strong passwords

5. **Document Security**
   - Don't share .sec files via unsecured channels
   - Encrypt backups
   - Use secure cloud storage if needed

## Uninstallation

### Complete Uninstall

1. **Uninstall Application**:
   - Settings → Apps → NIX Control Center → Uninstall
   - Or: Control Panel → Programs → Uninstall a program

2. **Remove User Data** (optional):
   - Navigate to: `C:\Users\<YourName>\AppData\Roaming\`
   - Delete `NIX` folder
   - **Warning**: This deletes all documents!

### Keep Documents

If you want to keep your documents:
1. Backup wallet folder first (see Backup section)
2. Then uninstall application
3. User data remains in AppData folder

## Getting Help

### Documentation
- **Full Documentation**: `docs\README.md`
- **Architecture**: `docs\NIX_ARCHITECTURE.md`
- **Setup Guide**: `docs\SETUP.md`

### Support
- **GitHub Issues**: https://github.com/TimeLordHorus/TimeLordHorus/issues
- **Email**: support@tl-linux.org
- **Documentation**: F1 in application

### Community
- **Discussions**: GitHub Discussions
- **Updates**: Check GitHub releases

## FAQ

**Q: Is NIX free?**
A: Yes, NIX is open-source and free under GPL-3.0 license.

**Q: Do I need internet for verification?**
A: Internet is required for blockchain verification. Basic verification works offline.

**Q: Can I use NIX on multiple computers?**
A: Yes, backup your wallet and copy to other computers.

**Q: Are my documents encrypted?**
A: Yes, all documents use AES-256-GCM encryption.

**Q: What is blockchain anchoring?**
A: Document hashes are recorded on blockchain for immutable proof of existence and authenticity.

**Q: Can documents be revoked?**
A: Yes, issuers can revoke documents. Verification checks revocation status.

**Q: Is this HIPAA compliant?**
A: Yes, NIX includes HIPAA compliance features for healthcare documents.

## License

NIX Control Center is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

This means:
- ✅ Free to use
- ✅ Free to modify
- ✅ Free to distribute
- ✅ Source code available

See LICENSE file for details.

## Credits

**NIX** is part of the **TL Linux Project**

Developed by the TL Linux team with focus on:
- Accessibility
- Security
- Privacy
- Compliance

## Version History

### Version 1.0.0 (2024)
- Initial Windows release
- Document wallet management
- Multi-level verification
- Blockchain integration
- Windows native features

---

**NIX Control Center** - Secure, Private, Verified

*Making document verification accessible to everyone*

For more information, visit: https://github.com/TimeLordHorus/TimeLordHorus
