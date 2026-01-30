"""
HIPAA-Compliant Medical Records Module
Part of NIX P2P Platform
"""

from .medical_record import MedicalRecord, MedicalRecordType
from .patient import Patient, PatientDemographics
from .clinical_data import (
    Diagnosis,
    Medication,
    Allergy,
    Immunization,
    LabResult,
    VitalSigns
)
from .fhir_integration import FHIRConverter
from .encryption import MedicalRecordEncryption

__all__ = [
    'MedicalRecord',
    'MedicalRecordType',
    'Patient',
    'PatientDemographics',
    'Diagnosis',
    'Medication',
    'Allergy',
    'Immunization',
    'LabResult',
    'VitalSigns',
    'FHIRConverter',
    'MedicalRecordEncryption'
]
