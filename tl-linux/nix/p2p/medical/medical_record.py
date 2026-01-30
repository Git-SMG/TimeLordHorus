"""
HIPAA-Compliant Medical Record Implementation
Encrypted, audited, consent-based access
"""

import uuid
import json
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from core.crypto import NixCrypto


class MedicalRecordType(Enum):
    """Types of medical records"""
    # Clinical
    DEMOGRAPHICS = "demographics"
    PROBLEM_LIST = "problem_list"
    MEDICATION_LIST = "medication_list"
    ALLERGY_LIST = "allergy_list"
    IMMUNIZATION = "immunization"
    LAB_RESULT = "lab_result"
    VITAL_SIGNS = "vital_signs"
    PROGRESS_NOTE = "progress_note"
    DISCHARGE_SUMMARY = "discharge_summary"
    RADIOLOGY_REPORT = "radiology_report"
    PROCEDURE_NOTE = "procedure_note"

    # Administrative
    INSURANCE_INFO = "insurance_info"
    CONSENT_FORM = "consent_form"
    ADVANCE_DIRECTIVE = "advance_directive"

    # Billing
    CLAIM = "claim"
    EXPLANATION_OF_BENEFITS = "eob"


class AccessPurpose(Enum):
    """HIPAA-compliant purposes for accessing PHI"""
    TREATMENT = "treatment"
    PAYMENT = "payment"
    OPERATIONS = "operations"  # Healthcare operations
    RESEARCH = "research"  # With patient consent
    PUBLIC_HEALTH = "public_health"
    EMERGENCY = "emergency"  # Break-glass access


@dataclass
class MedicalRecord:
    """
    HIPAA-compliant medical record with encryption and audit trail
    """
    # Core identification
    record_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    record_type: MedicalRecordType = MedicalRecordType.DEMOGRAPHICS
    patient_id: str = ""

    # Clinical data (encrypted)
    data: Dict[str, Any] = field(default_factory=dict)
    encrypted_data: Optional[bytes] = None

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""  # Provider ID
    organization: str = ""  # Facility/Organization

    # Versioning
    version: int = 1
    previous_version_id: Optional[str] = None

    # HIPAA compliance
    data_classification: str = "PHI"  # Protected Health Information
    retention_period_years: int = 6  # HIPAA minimum

    # Encryption
    encryption_algorithm: str = "AES-256-GCM"
    encryption_key_id: Optional[str] = None

    # Standards compliance
    fhir_resource_type: Optional[str] = None
    cda_document_id: Optional[str] = None
    hl7_message_id: Optional[str] = None

    # NIX integration
    sec_file_path: Optional[str] = None  # If issued as .sec document
    blockchain_anchor: Optional[str] = None

    def __post_init__(self):
        self.crypto = NixCrypto()

    def encrypt(self, encryption_key: bytes) -> bytes:
        """
        Encrypt medical record data
        Returns encrypted bytes
        """
        # Serialize data to JSON
        data_json = json.dumps(self.data, default=str).encode('utf-8')

        # Encrypt with AES-256-GCM
        ciphertext, nonce = self.crypto.encrypt(data_json, encryption_key)

        # Store encrypted data
        self.encrypted_data = ciphertext

        # Store nonce in metadata
        if 'encryption' not in self.data:
            self.data['encryption'] = {}
        self.data['encryption'] = {
            'nonce': self.crypto.base64_encode(nonce),
            'algorithm': self.encryption_algorithm
        }

        # Clear plaintext data for security
        original_data = self.data.copy()
        self.data = {'encryption': self.data['encryption']}

        return ciphertext

    def decrypt(self, encryption_key: bytes) -> Dict[str, Any]:
        """
        Decrypt medical record data
        Returns decrypted data dictionary
        """
        if not self.encrypted_data:
            raise ValueError("No encrypted data to decrypt")

        # Get nonce from metadata
        if 'encryption' not in self.data or 'nonce' not in self.data['encryption']:
            raise ValueError("Missing encryption metadata")

        nonce = self.crypto.base64_decode(self.data['encryption']['nonce'])

        # Decrypt
        decrypted_bytes = self.crypto.decrypt(self.encrypted_data, encryption_key, nonce)

        # Parse JSON
        decrypted_data = json.loads(decrypted_bytes.decode('utf-8'))

        return decrypted_data

    def to_dict(self, include_encrypted: bool = False) -> dict:
        """Convert to dictionary (excludes PHI by default)"""
        result = {
            'record_id': self.record_id,
            'record_type': self.record_type.value,
            'patient_id': self.patient_id,
            'created_at': self.created_at.isoformat(),
            'created_by': self.created_by,
            'organization': self.organization,
            'version': self.version,
            'data_classification': self.data_classification,
            'encryption_algorithm': self.encryption_algorithm,
        }

        if include_encrypted and self.encrypted_data:
            result['encrypted_data'] = self.crypto.base64_encode(self.encrypted_data)
            result['encryption_metadata'] = self.data.get('encryption', {})

        return result

    @classmethod
    def from_dict(cls, data: dict) -> 'MedicalRecord':
        """Create from dictionary"""
        record = cls(
            record_id=data.get('record_id', str(uuid.uuid4())),
            record_type=MedicalRecordType(data.get('record_type', 'demographics')),
            patient_id=data.get('patient_id', ''),
            created_by=data.get('created_by', ''),
            organization=data.get('organization', ''),
            version=data.get('version', 1)
        )

        if data.get('created_at'):
            record.created_at = datetime.fromisoformat(data['created_at'])

        if data.get('encrypted_data'):
            record.encrypted_data = record.crypto.base64_decode(data['encrypted_data'])
            record.data = {'encryption': data.get('encryption_metadata', {})}

        return record

    def create_audit_entry(self, accessor_id: str, purpose: AccessPurpose,
                          ip_address: str = None) -> dict:
        """
        Create HIPAA-compliant audit log entry
        """
        return {
            'audit_id': str(uuid.uuid4()),
            'timestamp': datetime.now().isoformat(),
            'event_type': 'RECORD_ACCESS',
            'record_id': self.record_id,
            'record_type': self.record_type.value,
            'patient_id': self.patient_id,
            'accessor_id': accessor_id,
            'purpose': purpose.value,
            'organization': self.organization,
            'ip_address': ip_address,
            'data_classification': self.data_classification
        }


@dataclass
class MedicalRecordSet:
    """
    Collection of related medical records for a patient
    Represents a complete medical history
    """
    patient_id: str
    records: List[MedicalRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    last_updated: datetime = field(default_factory=datetime.now)

    def add_record(self, record: MedicalRecord):
        """Add a record to the set"""
        if record.patient_id != self.patient_id:
            raise ValueError("Record patient ID does not match set patient ID")
        self.records.append(record)
        self.last_updated = datetime.now()

    def get_records_by_type(self, record_type: MedicalRecordType) -> List[MedicalRecord]:
        """Get all records of a specific type"""
        return [r for r in self.records if r.record_type == record_type]

    def get_latest_record(self, record_type: MedicalRecordType) -> Optional[MedicalRecord]:
        """Get the most recent record of a specific type"""
        records = self.get_records_by_type(record_type)
        if not records:
            return None
        return max(records, key=lambda r: r.created_at)

    def get_records_since(self, since_date: datetime) -> List[MedicalRecord]:
        """Get all records created since a specific date"""
        return [r for r in self.records if r.created_at >= since_date]

    def encrypt_all(self, encryption_key: bytes):
        """Encrypt all records in the set"""
        for record in self.records:
            record.encrypt(encryption_key)

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'patient_id': self.patient_id,
            'record_count': len(self.records),
            'created_at': self.created_at.isoformat(),
            'last_updated': self.last_updated.isoformat(),
            'records': [r.to_dict() for r in self.records]
        }
