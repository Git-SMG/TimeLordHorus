"""
Healthcare Entity Service
Handles medical documents, prescriptions, test results
"""

from typing import Dict, Any
from datetime import datetime, timedelta

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.models import Entity, Individual, DocumentType, EntityType
from core.sec_file import SECFile
from .base import BaseEntityService


class HealthcareService(BaseEntityService):
    """
    Healthcare service for medical documents
    """

    def __init__(self, provider_name: str, provider_id: str, private_key=None):
        entity = Entity(
            name=provider_name,
            entity_type=EntityType.HEALTHCARE_PROVIDER,
            jurisdiction="US",
            verified=True
        )
        entity.custom_fields = {'provider_id': provider_id}
        super().__init__(entity, private_key)

    def issue_document(
        self,
        subject: Individual,
        document_type: DocumentType,
        data: Dict[str, Any],
        **kwargs
    ) -> SECFile:
        """Issue a healthcare document"""
        if document_type == DocumentType.PRESCRIPTION:
            return self.issue_prescription(subject, data)
        elif document_type == DocumentType.LAB_RESULTS:
            return self.issue_lab_results(subject, data)
        elif document_type == DocumentType.DIAGNOSIS:
            return self.issue_diagnosis(subject, data)
        elif document_type == DocumentType.VACCINATION_RECORD:
            return self.issue_vaccination_record(subject, data)
        else:
            raise ValueError(f"Unsupported document type: {document_type}")

    def issue_prescription(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue a prescription
        """
        required_fields = ['medication', 'dosage', 'quantity', 'refills', 'prescriber']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        content = {
            'document_type': 'prescription',
            'rx_number': data.get('rx_number', self._generate_rx_number()),
            'patient': {
                'name': subject.full_name,
                'date_of_birth': subject.date_of_birth.isoformat() if subject.date_of_birth else None
            },
            'medication': {
                'name': data['medication'],
                'dosage': data['dosage'],
                'form': data.get('form', 'tablet'),
                'instructions': data.get('instructions', 'Take as directed'),
                'quantity': data['quantity'],
                'refills': data['refills']
            },
            'prescriber': {
                'name': data['prescriber'],
                'npi': data.get('prescriber_npi'),
                'dea': data.get('prescriber_dea')
            },
            'issue_date': datetime.now().isoformat(),
            'valid_until': (datetime.now() + timedelta(days=data.get('valid_days', 365))).isoformat(),
            'diagnosis_code': data.get('diagnosis_code'),
            'pharmacy_restrictions': data.get('pharmacy_restrictions', [])
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.PRESCRIPTION,
            content=self._format_json_content(content),
            title=f"Prescription - {data['medication']}",
            description=f"{data['medication']} {data['dosage']}",
            expires_in_days=data.get('valid_days', 365),
            custom_fields={
                'rx_number': content['rx_number'],
                'medication': data['medication'],
                'hipaa_protected': True
            }
        )

        # Add verification requirements
        sec_file.metadata.verification_requirements = {
            'controlled_substance': data.get('controlled_substance', False),
            'refills_remaining': data['refills'],
            'quantity_limit': data['quantity']
        }

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_lab_results(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue laboratory test results
        """
        content = {
            'document_type': 'lab_results',
            'order_number': data.get('order_number'),
            'patient': {
                'name': subject.full_name,
                'date_of_birth': subject.date_of_birth.isoformat() if subject.date_of_birth else None
            },
            'tests': data['tests'],  # List of test results
            'ordering_physician': data.get('ordering_physician'),
            'laboratory': data.get('laboratory', self.entity.name),
            'collection_date': data.get('collection_date', datetime.now().isoformat()),
            'result_date': datetime.now().isoformat(),
            'abnormal_flags': data.get('abnormal_flags', []),
            'critical_results': data.get('critical_results', False)
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.LAB_RESULTS,
            content=self._format_json_content(content),
            title=f"Lab Results - {data.get('test_name', 'Multiple Tests')}",
            description=f"Laboratory test results from {data.get('collection_date', 'today')}",
            expires_in_days=3650,  # 10 years retention
            custom_fields={
                'order_number': data.get('order_number'),
                'hipaa_protected': True,
                'critical': data.get('critical_results', False)
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_diagnosis(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue a diagnosis
        """
        content = {
            'document_type': 'diagnosis',
            'patient': {
                'name': subject.full_name,
                'date_of_birth': subject.date_of_birth.isoformat() if subject.date_of_birth else None
            },
            'diagnosis': {
                'primary': data['primary_diagnosis'],
                'icd10_code': data.get('icd10_code'),
                'description': data.get('description')
            },
            'secondary_diagnoses': data.get('secondary_diagnoses', []),
            'physician': data['physician'],
            'diagnosis_date': data.get('diagnosis_date', datetime.now().isoformat()),
            'treatment_plan': data.get('treatment_plan'),
            'follow_up': data.get('follow_up')
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.DIAGNOSIS,
            content=self._format_json_content(content),
            title=f"Diagnosis - {data['primary_diagnosis']}",
            description=f"Medical diagnosis by {data['physician']}",
            expires_in_days=3650,
            custom_fields={
                'icd10_code': data.get('icd10_code'),
                'hipaa_protected': True
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_vaccination_record(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue vaccination record
        """
        content = {
            'document_type': 'vaccination_record',
            'patient': {
                'name': subject.full_name,
                'date_of_birth': subject.date_of_birth.isoformat() if subject.date_of_birth else None
            },
            'vaccination': {
                'vaccine_name': data['vaccine_name'],
                'cvx_code': data.get('cvx_code'),
                'manufacturer': data.get('manufacturer'),
                'lot_number': data.get('lot_number'),
                'dose_number': data.get('dose_number', 1),
                'total_doses': data.get('total_doses', 1)
            },
            'administration': {
                'date': data.get('administration_date', datetime.now().isoformat()),
                'site': data.get('site', 'left arm'),
                'route': data.get('route', 'intramuscular'),
                'administrator': data.get('administrator')
            },
            'next_dose_due': data.get('next_dose_due')
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.VACCINATION_RECORD,
            content=self._format_json_content(content),
            title=f"Vaccination - {data['vaccine_name']}",
            description=f"Vaccination record for {data['vaccine_name']}",
            expires_in_days=36500,  # Permanent record
            custom_fields={
                'vaccine_name': data['vaccine_name'],
                'cvx_code': data.get('cvx_code'),
                'hipaa_protected': True
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def _generate_rx_number(self) -> str:
        """Generate prescription number"""
        import uuid
        return f"RX-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
