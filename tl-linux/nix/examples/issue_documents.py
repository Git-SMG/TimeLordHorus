#!/usr/bin/env python3
"""
Example: Issuing Documents with NIX

This example demonstrates how different entities can issue
various types of documents.
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.models import Individual
from entities.irs import IRSService
from entities.dmv import DMVService
from entities.healthcare import HealthcareService
from entities.education import EducationService
from entities.benefits import BenefitsService


def create_sample_individual():
    """Create a sample individual"""
    return Individual(
        first_name="John",
        last_name="Doe",
        middle_name="A",
        date_of_birth=datetime(1990, 5, 15),
        email="john.doe@example.com",
        phone="555-123-4567",
        address={
            'street': '123 Main St',
            'city': 'Anytown',
            'state': 'CA',
            'zip': '12345'
        }
    )


def example_irs_w2():
    """Issue a W-2 form"""
    print("\n=== IRS W-2 Example ===\n")

    # Create individual
    employee = create_sample_individual()

    # Create IRS service
    irs = IRSService()

    # Issue W-2
    w2_data = {
        'employer_name': 'ACME Corporation',
        'employer_ein': '12-3456789',
        'employer_address': {
            'street': '456 Business Blvd',
            'city': 'Anytown',
            'state': 'CA',
            'zip': '12345'
        },
        'wages': 75000.00,
        'federal_tax_withheld': 12000.00,
        'social_security_wages': 75000.00,
        'social_security_tax': 4650.00,
        'medicare_wages': 75000.00,
        'medicare_tax': 1087.50,
        'year': 2024
    }

    w2 = irs.issue_w2(employee, w2_data)

    # Save to file
    output_dir = os.path.expanduser("~/.nix/examples")
    os.makedirs(output_dir, exist_ok=True)

    filepath = os.path.join(output_dir, "w2_2024.sec")
    w2.save(filepath)

    print(f"W-2 issued successfully!")
    print(f"  Title: {w2.metadata.title}")
    print(f"  Document ID: {w2.metadata.document_id}")
    print(f"  Saved to: {filepath}")
    print(f"  Expires: {w2.metadata.expires_at}")
    print(f"  Blockchain: {w2.blockchain_anchor.transaction_hash if w2.blockchain_anchor else 'Not anchored'}")


def example_dmv_license():
    """Issue a driver's license"""
    print("\n=== DMV Driver's License Example ===\n")

    driver = create_sample_individual()

    # Create DMV service for California
    dmv = DMVService(state="CA")

    # Issue driver's license
    license_data = {
        'license_number': 'D1234567',
        'license_class': 'C',
        'issue_date': datetime.now().isoformat(),
        'expiration_date': (datetime.now() + timedelta(days=365*5)).isoformat(),
        'restrictions': [],
        'endorsements': [],
        'organ_donor': True,
        'veteran': False
    }

    license = dmv.issue_drivers_license(driver, license_data)

    # Save
    output_dir = os.path.expanduser("~/.nix/examples")
    filepath = os.path.join(output_dir, "drivers_license.sec")
    license.save(filepath)

    print(f"Driver's license issued successfully!")
    print(f"  Title: {license.metadata.title}")
    print(f"  License #: {license_data['license_number']}")
    print(f"  Class: {license_data['license_class']}")
    print(f"  Saved to: {filepath}")
    print(f"  Expires: {license.metadata.expires_at}")


def example_healthcare_prescription():
    """Issue a prescription"""
    print("\n=== Healthcare Prescription Example ===\n")

    patient = create_sample_individual()

    # Create healthcare service
    clinic = HealthcareService("Dr. Smith's Clinic", "NPI123456")

    # Issue prescription
    rx_data = {
        'medication': 'Lisinopril',
        'dosage': '10mg',
        'form': 'tablet',
        'instructions': 'Take one tablet daily',
        'quantity': 30,
        'refills': 3,
        'prescriber': 'Dr. Jane Smith',
        'prescriber_npi': 'NPI123456',
        'valid_days': 365
    }

    prescription = clinic.issue_prescription(patient, rx_data)

    # Save
    output_dir = os.path.expanduser("~/.nix/examples")
    filepath = os.path.join(output_dir, "prescription_lisinopril.sec")
    prescription.save(filepath)

    print(f"Prescription issued successfully!")
    print(f"  Title: {prescription.metadata.title}")
    print(f"  Medication: {rx_data['medication']} {rx_data['dosage']}")
    print(f"  Quantity: {rx_data['quantity']}")
    print(f"  Refills: {rx_data['refills']}")
    print(f"  Saved to: {filepath}")
    print(f"  Expires: {prescription.metadata.expires_at}")


def example_education_diploma():
    """Issue a diploma"""
    print("\n=== Education Diploma Example ===\n")

    student = create_sample_individual()

    # Create university service
    university = EducationService("State University", "university")

    # Issue diploma
    diploma_data = {
        'degree_name': 'Bachelor of Science',
        'degree_type': 'Bachelor',
        'major': 'Computer Science',
        'minor': 'Mathematics',
        'graduation_date': '2024-06-15',
        'gpa': 3.75,
        'honors': 'Cum Laude',
        'student_id': 'STU123456',
        'accreditation': 'WASC'
    }

    diploma = university.issue_diploma(student, diploma_data)

    # Save
    output_dir = os.path.expanduser("~/.nix/examples")
    filepath = os.path.join(output_dir, "diploma_bs_cs.sec")
    diploma.save(filepath)

    print(f"Diploma issued successfully!")
    print(f"  Title: {diploma.metadata.title}")
    print(f"  Degree: {diploma_data['degree_name']}")
    print(f"  Major: {diploma_data['major']}")
    print(f"  GPA: {diploma_data['gpa']}")
    print(f"  Honors: {diploma_data['honors']}")
    print(f"  Saved to: {filepath}")


def example_benefits_snap():
    """Issue SNAP benefits"""
    print("\n=== SNAP Benefits Example ===\n")

    recipient = create_sample_individual()

    # Create benefits service
    snap = BenefitsService("SNAP", jurisdiction="CA")

    # Issue SNAP benefits
    snap_data = {
        'case_number': 'SNAP-2024-123456',
        'monthly_amount': 250.00,
        'household_size': 2,
        'ebt_card_number': '1234567890123456',
        'start_date': datetime.now().isoformat(),
        'review_date': (datetime.now() + timedelta(days=180)).isoformat(),
        'income_verified': True
    }

    snap_benefits = snap.issue_snap_benefits(recipient, snap_data)

    # Save
    output_dir = os.path.expanduser("~/.nix/examples")
    filepath = os.path.join(output_dir, "snap_benefits.sec")
    snap_benefits.save(filepath)

    print(f"SNAP benefits issued successfully!")
    print(f"  Title: {snap_benefits.metadata.title}")
    print(f"  Case #: {snap_data['case_number']}")
    print(f"  Monthly Amount: ${snap_data['monthly_amount']}")
    print(f"  Household Size: {snap_data['household_size']}")
    print(f"  Saved to: {filepath}")
    print(f"  Review Date: {snap_benefits.metadata.expires_at}")


def main():
    """Run all examples"""
    print("=" * 70)
    print("NIX Document Issuance Examples")
    print("=" * 70)

    try:
        example_irs_w2()
        example_dmv_license()
        example_healthcare_prescription()
        example_education_diploma()
        example_benefits_snap()

        print("\n" + "=" * 70)
        print("All examples completed successfully!")
        print("=" * 70)
        print(f"\nDocuments saved to: {os.path.expanduser('~/.nix/examples')}")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
