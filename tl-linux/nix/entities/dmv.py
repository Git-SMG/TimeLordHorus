"""
DMV (Department of Motor Vehicles) Entity Service
Handles driver's licenses, vehicle registration, etc.
"""

from typing import Dict, Any
from datetime import datetime, timedelta

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.models import Entity, Individual, DocumentType, EntityType
from core.sec_file import SECFile
from .base import BaseEntityService


class DMVService(BaseEntityService):
    """
    DMV service for issuing driver's licenses and vehicle documents
    """

    def __init__(self, state: str = "CA", private_key=None):
        entity = Entity(
            name=f"{state} Department of Motor Vehicles",
            entity_type=EntityType.DMV,
            jurisdiction=state,
            website=f"https://dmv.{state.lower()}.gov",
            verified=True
        )
        super().__init__(entity, private_key)
        self.state = state

    def issue_document(
        self,
        subject: Individual,
        document_type: DocumentType,
        data: Dict[str, Any],
        **kwargs
    ) -> SECFile:
        """Issue a DMV document"""
        if document_type == DocumentType.DRIVERS_LICENSE:
            return self.issue_drivers_license(subject, data)
        elif document_type == DocumentType.VEHICLE_REGISTRATION:
            return self.issue_vehicle_registration(subject, data)
        elif document_type == DocumentType.VEHICLE_TITLE:
            return self.issue_vehicle_title(subject, data)
        else:
            raise ValueError(f"Unsupported document type: {document_type}")

    def issue_drivers_license(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue a driver's license
        """
        required_fields = ['license_number', 'license_class', 'issue_date', 'expiration_date']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        content = {
            'document_type': 'drivers_license',
            'license_number': data['license_number'],
            'license_class': data['license_class'],
            'holder': {
                'name': subject.full_name,
                'date_of_birth': subject.date_of_birth.isoformat() if subject.date_of_birth else None,
                'address': subject.address,
                'photo_hash': data.get('photo_hash')  # Hash of photo
            },
            'issue_date': data['issue_date'],
            'expiration_date': data['expiration_date'],
            'restrictions': data.get('restrictions', []),
            'endorsements': data.get('endorsements', []),
            'state': self.state,
            'organ_donor': data.get('organ_donor', False),
            'veteran': data.get('veteran', False)
        }

        # Parse expiration date
        if isinstance(data['expiration_date'], str):
            exp_date = datetime.fromisoformat(data['expiration_date'])
        else:
            exp_date = data['expiration_date']

        days_until_expiration = (exp_date - datetime.now()).days

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.DRIVERS_LICENSE,
            content=self._format_json_content(content),
            title=f"Driver's License - {self.state}",
            description=f"Class {data['license_class']} driver's license",
            expires_in_days=max(0, days_until_expiration),
            custom_fields={
                'license_number': data['license_number'],
                'license_class': data['license_class'],
                'state': self.state,
                'digital_license': True
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_vehicle_registration(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue vehicle registration
        """
        required_fields = ['vin', 'license_plate', 'make', 'model', 'year', 'expiration_date']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        content = {
            'document_type': 'vehicle_registration',
            'vehicle': {
                'vin': data['vin'],
                'license_plate': data['license_plate'],
                'make': data['make'],
                'model': data['model'],
                'year': data['year'],
                'color': data.get('color'),
                'vehicle_type': data.get('vehicle_type', 'passenger')
            },
            'registered_owner': {
                'name': subject.full_name,
                'address': subject.address
            },
            'registration_date': data.get('registration_date', datetime.now().isoformat()),
            'expiration_date': data['expiration_date'],
            'state': self.state,
            'fees_paid': data.get('fees_paid', 0),
            'emissions_compliant': data.get('emissions_compliant', True)
        }

        if isinstance(data['expiration_date'], str):
            exp_date = datetime.fromisoformat(data['expiration_date'])
        else:
            exp_date = data['expiration_date']

        days_until_expiration = (exp_date - datetime.now()).days

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.VEHICLE_REGISTRATION,
            content=self._format_json_content(content),
            title=f"Vehicle Registration - {data['license_plate']}",
            description=f"{data['year']} {data['make']} {data['model']}",
            expires_in_days=max(0, days_until_expiration),
            custom_fields={
                'vin': data['vin'],
                'license_plate': data['license_plate'],
                'state': self.state
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_vehicle_title(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue vehicle title
        """
        content = {
            'document_type': 'vehicle_title',
            'title_number': data['title_number'],
            'vehicle': {
                'vin': data['vin'],
                'make': data['make'],
                'model': data['model'],
                'year': data['year']
            },
            'owner': {
                'name': subject.full_name,
                'address': subject.address
            },
            'lien_holder': data.get('lien_holder'),
            'odometer': data.get('odometer'),
            'state': self.state,
            'issue_date': datetime.now().isoformat()
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.VEHICLE_TITLE,
            content=self._format_json_content(content),
            title=f"Vehicle Title - {data['vin']}",
            description=f"Title for {data['year']} {data['make']} {data['model']}",
            expires_in_days=36500,  # Titles don't expire
            custom_fields={
                'vin': data['vin'],
                'title_number': data['title_number'],
                'state': self.state
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file
