# NIX Setup Guide

## Installation

### 1. Install Dependencies

```bash
# Install cryptography library
pip install cryptography

# Optional: For blockchain integration
pip install web3 eth-account

# Optional: For QR code generation
pip install qrcode Pillow
```

### 2. System Requirements

- Python 3.11 or higher
- Linux (TL Linux recommended)
- 100MB disk space minimum
- Internet connection (for blockchain operations)

### 3. First-Time Setup

```bash
# Navigate to NIX directory
cd /opt/tl-linux/nix

# Install dependencies
pip install -r requirements.txt

# Run basic test
python test_nix_basic.py

# Create wallet directory
mkdir -p ~/.nix/wallet
```

### 4. Generate Example Documents

```bash
# Generate sample documents
python examples/issue_documents.py

# Verify documents
python examples/verify_documents.py
```

### 5. Launch GUI Application

```bash
# Start NIX Control Center
python -m gui.nix_control_center

# Or add to TL Linux applications menu
cp nix.desktop ~/.local/share/applications/
```

## Configuration

### Blockchain Configuration

Edit `blockchain/networks.py` to configure blockchain RPC endpoints:

```python
NETWORK_CONFIGS[NetworkType.POLYGON_MUMBAI] = NetworkConfig(
    rpc_url="https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY",
    ...
)
```

### Wallet Location

Default wallet location: `~/.nix/wallet`

To change, edit in application settings or set environment variable:

```bash
export NIX_WALLET_PATH="/path/to/custom/wallet"
```

## Troubleshooting

### Issue: ModuleNotFoundError: No module named 'cryptography'

**Solution**: Install cryptography library:
```bash
pip install cryptography
```

### Issue: ImportError: No module named '_cffi_backend'

**Solution**: Install cffi:
```bash
pip install cffi
```

### Issue: GUI won't launch

**Solution**: Ensure tkinter is installed:
```bash
# Debian/Ubuntu
sudo apt-get install python3-tk

# TL Linux (already included)
```

### Issue: Blockchain operations fail

**Solution**:
1. Check internet connection
2. Verify RPC endpoint in `blockchain/networks.py`
3. For development, use local testnet or simulated mode

## Integration with TL Linux

### Add to Applications Menu

Create `~/.local/share/applications/nix-control-center.desktop`:

```ini
[Desktop Entry]
Name=NIX Control Center
Comment=File Verification Protocol & Authorization System
Exec=python3 /opt/tl-linux/nix/gui/nix_control_center.py
Icon=document-properties
Terminal=false
Type=Application
Categories=Utility;System;
```

### System Tray Integration

Add to TL Linux startup applications for quick access.

### Voice Control Integration

NIX commands can be added to TL Linux voice control:

```
"Verify my driver's license"
"Show my documents"
"Check document status"
```

## Development Setup

### Install Development Dependencies

```bash
pip install pytest flake8 black mypy
```

### Run Tests

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest --cov=nix tests/
```

### Code Quality

```bash
# Lint
flake8 nix/

# Format
black nix/

# Type checking
mypy nix/
```

## Security Notes

1. **Private Keys**: Never share private keys. Store securely.
2. **Wallet Backup**: Regularly backup `~/.nix/wallet`
3. **Encryption**: Always encrypt sensitive documents
4. **Passwords**: Use strong passwords for document encryption
5. **Blockchain**: Be aware of gas costs on mainnet

## Support

- Documentation: [README.md](README.md)
- Architecture: [NIX_ARCHITECTURE.md](NIX_ARCHITECTURE.md)
- Issues: GitHub Issues
- Email: support@tl-linux.org

## Quick Reference

```bash
# Issue documents
python examples/issue_documents.py

# Verify documents
python examples/verify_documents.py

# Launch GUI
python -m gui.nix_control_center

# Run tests
python test_nix_basic.py

# Install dependencies
pip install -r requirements.txt
```
