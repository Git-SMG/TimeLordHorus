# NIX - File Verification Protocol & Authorization System

## Overview

**NIX** (Network Identification eXchange) is a comprehensive file verification protocol and authorization system that uses self-executing contracts (.sec files) to manage, verify, and authorize documents across government agencies, healthcare providers, financial institutions, and individuals.

## Features

- **Self-Executing Contracts (.sec files)**: Secure, cryptographically signed documents with embedded verification logic
- **Blockchain Anchoring**: Immutable verification on Ethereum/Polygon networks
- **Multi-Entity Support**: Government agencies (IRS, DMV, SSA), healthcare providers, educational institutions
- **Individual/Household Management**: Personal document wallet with privacy controls
- **Advanced Verification**: Multi-level verification with signature, blockchain, and revocation checking
- **Compliance Framework**: HIPAA, FERPA, FCRA compliant with state/federal regulations
- **GUI Application**: User-friendly control center for TL Linux

## Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or install individually
pip install cryptography

# Optional for blockchain integration
pip install web3
```

### Basic Usage

#### 1. Issue a Document (Entity)

```python
from nix.entities.irs import IRSService
from nix.core.models import Individual
from datetime import datetime

# Create individual
john = Individual(
    first_name="John",
    last_name="Doe",
    date_of_birth=datetime(1990, 1, 1),
    email="john@example.com"
)

# Create IRS service
irs = IRSService()

# Issue W-2
w2_data = {
    'employer_name': 'ACME Corporation',
    'employer_ein': '12-3456789',
    'wages': 75000.00,
    'federal_tax_withheld': 12000.00,
    'year': 2024
}

w2 = irs.issue_w2(john, w2_data)

# Save to file
w2.save('/path/to/documents/w2_2024.sec')
```

#### 2. Verify a Document

```python
from nix.core.sec_file import SECFile
from nix.core.verification import VerificationEngine, VerificationLevel

# Load document
sec_file = SECFile.load('/path/to/documents/w2_2024.sec')

# Create verification engine
verifier = VerificationEngine()

# Verify
result = verifier.verify(sec_file, level=VerificationLevel.COMPREHENSIVE)

# Check result
if result.is_valid:
    print("Document verified successfully!")
    print(f"Score: {result.score}/100")
else:
    print("Verification failed:")
    for error in result.errors:
        print(f"  - {error}")

# Generate report
report = verifier.generate_verification_report(result)
print(report)
```

#### 3. Launch GUI Application

```bash
python -m nix.gui.nix_control_center
```

## Architecture

### Core Components

1. **Core Module** (`nix/core/`)
   - `crypto.py`: Cryptographic operations (Ed25519, AES-256-GCM)
   - `sec_file.py`: .sec file format handler
   - `models.py`: Data models (Entity, Individual, Household)
   - `verification.py`: Verification engine

2. **Blockchain Module** (`nix/blockchain/`)
   - `anchor.py`: Document anchoring service
   - `networks.py`: Network configurations
   - `verification.py`: Blockchain verification

3. **Entities Module** (`nix/entities/`)
   - `irs.py`: IRS tax documents (W-2, 1099, returns)
   - `dmv.py`: Driver's licenses, vehicle registration
   - `healthcare.py`: Prescriptions, lab results, vaccinations
   - `education.py`: Diplomas, transcripts, certifications
   - `benefits.py`: SNAP, Medicare, Medicaid, unemployment

4. **GUI Module** (`nix/gui/`)
   - `nix_control_center.py`: Main control panel application

### .sec File Format

```
.sec File Structure:
┌─────────────────────────────────────┐
│ HEADER (256 bytes)                  │
│  - Magic bytes: "SEC\x01"           │
│  - Version, encryption, compression │
│  - Offsets to sections              │
├─────────────────────────────────────┤
│ METADATA (JSON)                     │
│  - Issuer/subject information       │
│  - Document type and details        │
│  - Expiration, permissions          │
├─────────────────────────────────────┤
│ CONTENT (Encrypted)                 │
│  - Actual document data             │
├─────────────────────────────────────┤
│ SIGNATURES                          │
│  - Ed25519 digital signatures       │
├─────────────────────────────────────┤
│ BLOCKCHAIN ANCHOR                   │
│  - Transaction hash, block number   │
│  - Merkle proof                     │
└─────────────────────────────────────┘
```

## Use Cases

### 1. Tax Filing

```python
from nix.entities.irs import IRSService

# IRS issues W-2 to employee
irs = IRSService()
w2 = irs.issue_w2(employee, w2_data)

# Employee imports to wallet
# Tax software verifies authenticity
verifier.verify(w2)

# Employee grants access to tax preparer
irs.grant_access(w2, preparer_id, 'individual', ['read'], expires_in_days=30)
```

### 2. Digital Driver's License

```python
from nix.entities.dmv import DMVService

# DMV issues digital license
dmv = DMVService(state="CA")
license = dmv.issue_drivers_license(subject, {
    'license_number': 'D1234567',
    'license_class': 'C',
    'issue_date': '2024-01-01',
    'expiration_date': '2029-01-01'
})

# Police officer verifies via QR scan
result = verifier.verify(license)
# Access logged on blockchain
```

### 3. Healthcare Prescription

```python
from nix.entities.healthcare import HealthcareService

# Doctor creates prescription
doctor = HealthcareService("Dr. Smith's Clinic", "NPI123")
rx = doctor.issue_prescription(patient, {
    'medication': 'Lisinopril',
    'dosage': '10mg',
    'quantity': 30,
    'refills': 3,
    'prescriber': 'Dr. Jane Smith'
})

# Pharmacy verifies and dispenses
result = verifier.verify(rx)
# System prevents over-dispensing via embedded logic
```

### 4. Benefits Verification

```python
from nix.entities.benefits import BenefitsService

# Benefits agency issues card
benefits = BenefitsService("SNAP", jurisdiction="CA")
snap_card = benefits.issue_snap_benefits(individual, {
    'monthly_amount': 250.00,
    'household_size': 2,
    'review_date': '2025-01-01'
})

# Instant verification by vendor
result = verifier.verify(snap_card)
```

## Security

### Cryptography

- **Signing**: Ed25519 (256-bit)
- **Encryption**: AES-256-GCM
- **Hashing**: SHA-256
- **Key Exchange**: X25519

### Privacy

- **Zero-Knowledge Proofs**: Selective disclosure
- **Pseudonymous Identities**: Privacy-preserving verification
- **Data Minimization**: Only necessary data stored
- **End-to-End Encryption**: Content encrypted at rest

### Compliance

- **HIPAA**: Healthcare data protection
- **FERPA**: Educational records privacy
- **FCRA**: Financial data regulations
- **GDPR**: Data protection and privacy
- **State/Federal**: Regulatory compliance

## API Reference

### Entity Services

All entity services inherit from `BaseEntityService` and implement:

```python
class EntityService(BaseEntityService):
    def issue_document(self, subject, document_type, data, **kwargs) -> SECFile:
        """Issue a document to a subject"""
        pass
```

### Verification Engine

```python
class VerificationEngine:
    def verify(self, sec_file, level=VerificationLevel.STANDARD) -> VerificationResult:
        """Verify a .sec file"""
        pass

    def verify_quick(self, sec_file) -> bool:
        """Quick verification (basic checks only)"""
        pass

    def verify_access(self, sec_file, entity_id, permission) -> bool:
        """Verify entity has permission"""
        pass
```

### Blockchain Service

```python
class BlockchainAnchorService:
    def anchor_document(self, document_hash) -> AnchorResult:
        """Anchor document to blockchain"""
        pass

    def anchor_batch(self, document_hashes) -> List[AnchorResult]:
        """Anchor multiple documents (Merkle tree)"""
        pass

    def verify_anchor(self, transaction_hash) -> dict:
        """Verify blockchain anchor"""
        pass
```

## Examples

See the `examples/` directory for complete working examples:

- `examples/issue_documents.py`: Issue various document types
- `examples/verify_documents.py`: Verify documents
- `examples/household_management.py`: Manage household documents
- `examples/blockchain_anchoring.py`: Blockchain integration

## Development

### Running Tests

```bash
# Run all tests
python -m pytest tests/

# Run specific test
python -m pytest tests/test_sec_file.py
```

### Building

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Run linter
flake8 nix/

# Format code
black nix/
```

## Integration with TL Linux

NIX is designed to integrate seamlessly with TL Linux:

1. **System Tray Integration**: Quick access to document wallet
2. **Accessibility**: Works with TL Linux accessibility features
3. **Voice Control**: "Verify my driver's license"
4. **Notifications**: Document expiration alerts

## Roadmap

### Phase 1 (Current - MVP)
- ✅ Core .sec file format
- ✅ Basic encryption/signing
- ✅ Blockchain anchoring (simulated)
- ✅ Entity services (IRS, DMV, Healthcare, Education, Benefits)
- ✅ GUI application
- ✅ Basic verification

### Phase 2
- [ ] Full blockchain integration (Web3)
- [ ] Revocation service
- [ ] Mobile app
- [ ] QR code generation/scanning
- [ ] Biometric authentication

### Phase 3
- [ ] Zero-knowledge proofs
- [ ] Decentralized identity (DID)
- [ ] Cross-border support
- [ ] Enterprise APIs
- [ ] Smart contract execution

### Phase 4
- [ ] AI-powered document analysis
- [ ] Automated compliance checking
- [ ] Multi-language support
- [ ] DAO governance

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

NIX is licensed under the GNU General Public License v3.0 (GPL-3.0).

See [LICENSE](../LICENSE) for full text.

## Support

- **Documentation**: [NIX_ARCHITECTURE.md](NIX_ARCHITECTURE.md)
- **Issues**: GitHub Issues
- **Email**: support@tl-linux.org (coming soon)

## Acknowledgments

- **TL Linux Project**: Integration and accessibility
- **Cryptography Community**: Security best practices
- **Blockchain Developers**: Anchoring techniques
- **Government Agencies**: Document standards

---

**NIX** - Secure, Private, Verified

*Part of the TL Linux Project*

*Making document verification accessible to everyone*
