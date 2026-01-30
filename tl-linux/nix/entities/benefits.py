"""
Benefits Entity Service
Handles state and federal benefits (SNAP, Medicare, Medicaid, unemployment, etc.)
"""

from typing import Dict, Any
from datetime import datetime, timedelta

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.models import Entity, Individual, DocumentType, EntityType
from core.sec_file import SECFile
from .base import BaseEntityService


class BenefitsService(BaseEntityService):
    """
    Benefits service for government assistance programs
    """

    def __init__(self, program_name: str, jurisdiction: str = "US", private_key=None):
        entity = Entity(
            name=f"{program_name} Benefits",
            entity_type=EntityType.FEDERAL_GOVERNMENT if jurisdiction == "US" else EntityType.STATE_GOVERNMENT,
            jurisdiction=jurisdiction,
            verified=True
        )
        super().__init__(entity, private_key)
        self.program_name = program_name

    def issue_document(
        self,
        subject: Individual,
        document_type: DocumentType,
        data: Dict[str, Any],
        **kwargs
    ) -> SECFile:
        """Issue a benefits document"""
        if document_type == DocumentType.SNAP_BENEFITS:
            return self.issue_snap_benefits(subject, data)
        elif document_type == DocumentType.MEDICARE:
            return self.issue_medicare_card(subject, data)
        elif document_type == DocumentType.MEDICAID:
            return self.issue_medicaid_card(subject, data)
        elif document_type == DocumentType.UNEMPLOYMENT:
            return self.issue_unemployment_benefits(subject, data)
        else:
            raise ValueError(f"Unsupported document type: {document_type}")

    def issue_snap_benefits(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue SNAP (food stamps) benefits card
        """
        content = {
            'document_type': 'snap_benefits',
            'recipient': {
                'name': subject.full_name,
                'case_number': data.get('case_number')
            },
            'benefits': {
                'monthly_amount': data['monthly_amount'],
                'ebt_card_number': data.get('ebt_card_number'),
                'household_size': data.get('household_size', 1)
            },
            'eligibility': {
                'start_date': data.get('start_date', datetime.now().isoformat()),
                'review_date': data.get('review_date'),
                'income_verified': data.get('income_verified', True)
            },
            'issue_date': datetime.now().isoformat()
        }

        # Review date determines expiration
        if data.get('review_date'):
            if isinstance(data['review_date'], str):
                review = datetime.fromisoformat(data['review_date'])
            else:
                review = data['review_date']
            days_until_review = (review - datetime.now()).days
        else:
            days_until_review = 180  # 6 months default

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.SNAP_BENEFITS,
            content=self._format_json_content(content),
            title="SNAP Benefits Card",
            description=f"Monthly benefits: ${data['monthly_amount']}",
            expires_in_days=days_until_review,
            custom_fields={
                'case_number': data.get('case_number'),
                'monthly_amount': data['monthly_amount'],
                'program': 'SNAP'
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_medicare_card(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue Medicare card
        """
        content = {
            'document_type': 'medicare',
            'beneficiary': {
                'name': subject.full_name,
                'medicare_number': data['medicare_number'],
                'date_of_birth': subject.date_of_birth.isoformat() if subject.date_of_birth else None
            },
            'coverage': {
                'part_a': data.get('part_a', True),
                'part_a_effective': data.get('part_a_effective'),
                'part_b': data.get('part_b', True),
                'part_b_effective': data.get('part_b_effective'),
                'part_d': data.get('part_d', False),
                'part_d_plan': data.get('part_d_plan')
            },
            'issue_date': datetime.now().isoformat()
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.MEDICARE,
            content=self._format_json_content(content),
            title="Medicare Card",
            description=f"Medicare Number: {data['medicare_number'][:4]}****",
            expires_in_days=36500,  # Essentially permanent
            custom_fields={
                'medicare_number': data['medicare_number'],
                'program': 'Medicare',
                'hipaa_protected': True
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_medicaid_card(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue Medicaid card
        """
        content = {
            'document_type': 'medicaid',
            'beneficiary': {
                'name': subject.full_name,
                'medicaid_id': data['medicaid_id']
            },
            'coverage': {
                'state': data.get('state'),
                'managed_care_plan': data.get('managed_care_plan'),
                'effective_date': data.get('effective_date', datetime.now().isoformat()),
                'review_date': data.get('review_date')
            },
            'eligibility_category': data.get('eligibility_category'),
            'issue_date': datetime.now().isoformat()
        }

        if data.get('review_date'):
            if isinstance(data['review_date'], str):
                review = datetime.fromisoformat(data['review_date'])
            else:
                review = data['review_date']
            days_until_review = (review - datetime.now()).days
        else:
            days_until_review = 365

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.MEDICAID,
            content=self._format_json_content(content),
            title=f"Medicaid Card - {data.get('state', 'State')}",
            description=f"Medicaid ID: {data['medicaid_id'][:4]}****",
            expires_in_days=days_until_review,
            custom_fields={
                'medicaid_id': data['medicaid_id'],
                'state': data.get('state'),
                'program': 'Medicaid',
                'hipaa_protected': True
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_unemployment_benefits(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue unemployment benefits determination
        """
        content = {
            'document_type': 'unemployment',
            'claimant': {
                'name': subject.full_name,
                'claim_number': data.get('claim_number'),
                'ssn': subject.ssn_hash
            },
            'benefits': {
                'weekly_benefit_amount': data['weekly_amount'],
                'total_benefit_amount': data.get('total_amount'),
                'benefit_year_begin': data.get('benefit_year_begin', datetime.now().isoformat()),
                'benefit_year_end': data.get('benefit_year_end')
            },
            'eligibility': {
                'approved': data.get('approved', True),
                'waiting_week': data.get('waiting_week_completed', True)
            },
            'payment_method': data.get('payment_method', 'direct_deposit'),
            'issue_date': datetime.now().isoformat()
        }

        # Benefit year determines expiration
        if data.get('benefit_year_end'):
            if isinstance(data['benefit_year_end'], str):
                end_date = datetime.fromisoformat(data['benefit_year_end'])
            else:
                end_date = data['benefit_year_end']
            days_until_end = (end_date - datetime.now()).days
        else:
            days_until_end = 365

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.UNEMPLOYMENT,
            content=self._format_json_content(content),
            title="Unemployment Benefits",
            description=f"Weekly amount: ${data['weekly_amount']}",
            expires_in_days=days_until_end,
            custom_fields={
                'claim_number': data.get('claim_number'),
                'weekly_amount': data['weekly_amount'],
                'program': 'Unemployment Insurance'
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file
