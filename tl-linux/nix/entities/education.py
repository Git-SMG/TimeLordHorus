"""
Education Entity Service
Handles diplomas, transcripts, certifications
"""

from typing import Dict, Any, List
from datetime import datetime

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.models import Entity, Individual, DocumentType, EntityType
from core.sec_file import SECFile
from .base import BaseEntityService


class EducationService(BaseEntityService):
    """
    Education service for academic documents
    """

    def __init__(self, institution_name: str, institution_type: str = "university", private_key=None):
        entity_type_map = {
            'university': EntityType.UNIVERSITY,
            'college': EntityType.COLLEGE,
            'school': EntityType.SCHOOL,
            'certification': EntityType.CERTIFICATION_BODY
        }

        entity = Entity(
            name=institution_name,
            entity_type=entity_type_map.get(institution_type, EntityType.UNIVERSITY),
            jurisdiction="US",
            verified=True
        )
        super().__init__(entity, private_key)

    def issue_document(
        self,
        subject: Individual,
        document_type: DocumentType,
        data: Dict[str, Any],
        **kwargs
    ) -> SECFile:
        """Issue an education document"""
        if document_type == DocumentType.DIPLOMA:
            return self.issue_diploma(subject, data)
        elif document_type == DocumentType.TRANSCRIPT:
            return self.issue_transcript(subject, data)
        elif document_type == DocumentType.DEGREE:
            return self.issue_degree(subject, data)
        elif document_type == DocumentType.CERTIFICATION:
            return self.issue_certification(subject, data)
        else:
            raise ValueError(f"Unsupported document type: {document_type}")

    def issue_diploma(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue a diploma
        """
        required_fields = ['degree_name', 'major', 'graduation_date']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        content = {
            'document_type': 'diploma',
            'student': {
                'name': subject.full_name,
                'student_id': data.get('student_id')
            },
            'degree': {
                'name': data['degree_name'],
                'type': data.get('degree_type', 'Bachelor'),
                'major': data['major'],
                'minor': data.get('minor'),
                'honors': data.get('honors')
            },
            'institution': {
                'name': self.entity.name,
                'accreditation': data.get('accreditation')
            },
            'graduation_date': data['graduation_date'],
            'gpa': data.get('gpa'),
            'cum_laude': data.get('cum_laude', False)
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.DIPLOMA,
            content=self._format_json_content(content),
            title=f"{data['degree_name']} - {data['major']}",
            description=f"{data['degree_name']} from {self.entity.name}",
            expires_in_days=36500,  # Permanent
            custom_fields={
                'degree': data['degree_name'],
                'major': data['major'],
                'graduation_year': data['graduation_date'][:4] if isinstance(data['graduation_date'], str) else None
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_transcript(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue an academic transcript
        """
        content = {
            'document_type': 'transcript',
            'student': {
                'name': subject.full_name,
                'student_id': data.get('student_id')
            },
            'institution': self.entity.name,
            'program': data.get('program'),
            'enrollment_period': {
                'start': data.get('enrollment_start'),
                'end': data.get('enrollment_end')
            },
            'courses': data.get('courses', []),  # List of courses with grades
            'gpa': {
                'cumulative': data.get('cumulative_gpa'),
                'major': data.get('major_gpa')
            },
            'credits': {
                'earned': data.get('credits_earned'),
                'attempted': data.get('credits_attempted')
            },
            'degree_awarded': data.get('degree_awarded'),
            'issue_date': datetime.now().isoformat(),
            'official': True
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.TRANSCRIPT,
            content=self._format_json_content(content),
            title=f"Official Transcript - {self.entity.name}",
            description=f"Academic transcript",
            expires_in_days=36500,
            custom_fields={
                'official_transcript': True,
                'ferpa_protected': True
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_degree(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue a degree certificate
        """
        return self.issue_diploma(subject, data)  # Same as diploma

    def issue_certification(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue a professional certification
        """
        content = {
            'document_type': 'certification',
            'certificate_holder': {
                'name': subject.full_name,
                'id': data.get('certificate_id')
            },
            'certification': {
                'name': data['certification_name'],
                'level': data.get('level'),
                'specialization': data.get('specialization')
            },
            'issuing_organization': self.entity.name,
            'issue_date': data.get('issue_date', datetime.now().isoformat()),
            'expiration_date': data.get('expiration_date'),
            'certificate_number': data.get('certificate_number', self._generate_cert_number()),
            'requirements_met': data.get('requirements', []),
            'ceus': data.get('continuing_education_units')
        }

        # Calculate expiration
        if data.get('expiration_date'):
            if isinstance(data['expiration_date'], str):
                exp_date = datetime.fromisoformat(data['expiration_date'])
            else:
                exp_date = data['expiration_date']
            days_until_exp = (exp_date - datetime.now()).days
        else:
            days_until_exp = 36500  # Permanent if no expiration

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.CERTIFICATION,
            content=self._format_json_content(content),
            title=f"Certification - {data['certification_name']}",
            description=f"Professional certification from {self.entity.name}",
            expires_in_days=max(0, days_until_exp),
            custom_fields={
                'certification_name': data['certification_name'],
                'certificate_number': content['certificate_number']
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def _generate_cert_number(self) -> str:
        """Generate certification number"""
        import uuid
        return f"CERT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
