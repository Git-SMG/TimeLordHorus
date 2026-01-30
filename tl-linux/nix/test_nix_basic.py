#!/usr/bin/env python3
"""
Basic NIX functionality test
Tests core components to ensure everything works
"""

import sys
import os
import tempfile
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    print("Testing NIX Basic Functionality...")
    print("=" * 70)

    # Test 1: Import core modules
    print("\n[1/7] Testing core module imports...")
    from core.crypto import NixCrypto, generate_keypair
    from core.models import Individual, Entity, DocumentType, EntityType
    from core.sec_file import SECFile, SECMetadata
    from core.verification import VerificationEngine, VerificationLevel
    print("✓ Core modules imported successfully")

    # Test 2: Cryptography
    print("\n[2/7] Testing cryptography...")
    crypto = NixCrypto()
    private_key, public_key = generate_keypair()
    test_data = b"Hello, NIX!"
    signature = crypto.sign(private_key, test_data)
    verified = crypto.verify_signature(public_key, signature, test_data)
    assert verified, "Signature verification failed"
    print("✓ Cryptography working correctly")

    # Test 3: Create Individual
    print("\n[3/7] Testing data models...")
    individual = Individual(
        first_name="Test",
        last_name="User",
        date_of_birth=datetime(1990, 1, 1),
        email="test@example.com"
    )
    assert individual.full_name == "Test User"
    print(f"✓ Individual created: {individual.full_name}")

    # Test 4: Create Entity
    entity = Entity(
        name="Test Agency",
        entity_type=EntityType.FEDERAL_GOVERNMENT,
        jurisdiction="US"
    )
    print(f"✓ Entity created: {entity.name}")

    # Test 5: Create and save .sec file
    print("\n[4/7] Testing .sec file creation...")
    sec_file = SECFile()
    sec_file.metadata.issuer = entity
    sec_file.metadata.subject = individual
    sec_file.metadata.document_type = DocumentType.OTHER
    sec_file.metadata.title = "Test Document"
    sec_file.metadata.description = "This is a test document"

    # Set content
    content = b"Test document content"
    sec_file.set_content(content, encrypt=False)  # No encryption for test

    # Sign
    sec_file.sign(private_key)

    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.sec') as tmp:
        tmp_path = tmp.name

    sec_file.save(tmp_path)
    print(f"✓ .sec file created and saved to {tmp_path}")

    # Test 6: Load and verify .sec file
    print("\n[5/7] Testing .sec file loading...")
    loaded_sec = SECFile.load(tmp_path)
    assert loaded_sec.metadata.title == "Test Document"
    assert loaded_sec.metadata.issuer.name == "Test Agency"
    print("✓ .sec file loaded successfully")

    # Test 7: Verification engine
    print("\n[6/7] Testing verification engine...")
    verifier = VerificationEngine()
    # Add entity as trusted
    verifier.add_trusted_entity(entity)

    # Note: This will have some failures because we're not setting up all the required fields
    # but it should run without errors
    result = verifier.verify(loaded_sec, level=VerificationLevel.BASIC)
    print(f"✓ Verification completed: {result.status.value}")
    print(f"  Score: {result.score:.1f}/100")

    # Test 8: Import entity services
    print("\n[7/7] Testing entity services...")
    from entities.irs import IRSService
    from entities.dmv import DMVService
    from entities.healthcare import HealthcareService
    from entities.education import EducationService
    from entities.benefits import BenefitsService
    print("✓ All entity services imported successfully")

    # Cleanup
    os.unlink(tmp_path)

    print("\n" + "=" * 70)
    print("✓ ALL TESTS PASSED")
    print("=" * 70)
    print("\nNIX is ready to use!")
    print("\nNext steps:")
    print("  1. Run: python nix/examples/issue_documents.py")
    print("  2. Run: python nix/examples/verify_documents.py")
    print("  3. Launch GUI: python -m nix.gui.nix_control_center")

    sys.exit(0)

except Exception as e:
    print(f"\n✗ TEST FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
