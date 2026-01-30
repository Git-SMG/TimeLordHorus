#!/usr/bin/env python3
"""
Example: Verifying Documents with NIX

This example demonstrates how to verify .sec documents
with different verification levels.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.sec_file import SECFile
from core.verification import VerificationEngine, VerificationLevel


def verify_document(filepath, level=VerificationLevel.COMPREHENSIVE):
    """Verify a document"""
    print(f"\nVerifying: {os.path.basename(filepath)}")
    print("-" * 70)

    try:
        # Load document
        sec_file = SECFile.load(filepath)

        # Create verification engine
        verifier = VerificationEngine()

        # Verify
        result = verifier.verify(sec_file, level=level)

        # Display results
        print(f"\nStatus: {result.status.value.upper()}")
        print(f"Level: {level.value}")
        print(f"Score: {result.score:.1f}/100")
        print()

        print("Checks:")
        print(f"  ✓ Signature Valid: {result.signature_valid}")
        print(f"  ✓ Not Expired: {result.not_expired}")
        print(f"  ✓ Not Revoked: {result.not_revoked}")
        print(f"  ✓ Blockchain Verified: {result.blockchain_verified}")
        print(f"  ✓ Issuer Trusted: {result.issuer_trusted}")

        if result.errors:
            print("\nErrors:")
            for error in result.errors:
                print(f"  ✗ {error}")

        if result.warnings:
            print("\nWarnings:")
            for warning in result.warnings:
                print(f"  ⚠ {warning}")

        # Document details
        print(f"\nDocument Details:")
        print(f"  Type: {sec_file.metadata.document_type.value}")
        print(f"  Issuer: {sec_file.metadata.issuer.name if sec_file.metadata.issuer else 'Unknown'}")
        print(f"  Subject: {sec_file.metadata.subject.full_name if sec_file.metadata.subject else 'Unknown'}")
        print(f"  Issued: {sec_file.metadata.issued_at}")
        print(f"  Expires: {sec_file.metadata.expires_at}")

        if sec_file.blockchain_anchor:
            print(f"\nBlockchain:")
            print(f"  Network: {sec_file.blockchain_anchor.network}")
            print(f"  Transaction: {sec_file.blockchain_anchor.transaction_hash}")
            print(f"  Block: {sec_file.blockchain_anchor.block_number}")

        # Full report
        print("\n" + "=" * 70)
        print("FULL VERIFICATION REPORT")
        print("=" * 70)
        report = verifier.generate_verification_report(result)
        print(report)

        return result

    except Exception as e:
        print(f"Error verifying document: {e}")
        import traceback
        traceback.print_exc()
        return None


def verify_all_examples():
    """Verify all example documents"""
    examples_dir = os.path.expanduser("~/.nix/examples")

    if not os.path.exists(examples_dir):
        print(f"Examples directory not found: {examples_dir}")
        print("Please run issue_documents.py first to create example documents.")
        return

    print("=" * 70)
    print("NIX Document Verification Examples")
    print("=" * 70)

    # Find all .sec files
    sec_files = [f for f in os.listdir(examples_dir) if f.endswith('.sec')]

    if not sec_files:
        print("No .sec files found in examples directory.")
        return

    # Verify each document
    results = []
    for filename in sec_files:
        filepath = os.path.join(examples_dir, filename)
        result = verify_document(filepath, level=VerificationLevel.COMPREHENSIVE)
        if result:
            results.append((filename, result))
        print()

    # Summary
    print("\n" + "=" * 70)
    print("VERIFICATION SUMMARY")
    print("=" * 70)

    verified = sum(1 for _, r in results if r.is_valid)
    total = len(results)

    print(f"\nTotal Documents: {total}")
    print(f"Verified: {verified}")
    print(f"Failed: {total - verified}")
    print()

    for filename, result in results:
        status_icon = "✓" if result.is_valid else "✗"
        print(f"  {status_icon} {filename}: {result.status.value} ({result.score:.0f}/100)")


def quick_verify_example():
    """Example of quick verification"""
    print("\n" + "=" * 70)
    print("QUICK VERIFICATION EXAMPLE")
    print("=" * 70)

    examples_dir = os.path.expanduser("~/.nix/examples")
    filepath = os.path.join(examples_dir, "w2_2024.sec")

    if not os.path.exists(filepath):
        print(f"Document not found: {filepath}")
        return

    try:
        sec_file = SECFile.load(filepath)
        verifier = VerificationEngine()

        # Quick verification (basic checks only)
        is_valid = verifier.verify_quick(sec_file)

        print(f"\nDocument: {os.path.basename(filepath)}")
        print(f"Quick Verification: {'PASS' if is_valid else 'FAIL'}")

    except Exception as e:
        print(f"Error: {e}")


def main():
    """Run verification examples"""
    # Verify all example documents
    verify_all_examples()

    # Show quick verification
    quick_verify_example()


if __name__ == "__main__":
    main()
