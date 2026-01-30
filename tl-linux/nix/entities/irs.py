"""
IRS (Internal Revenue Service) Entity Service
Handles tax-related documents
"""

from typing import Dict, Any
from datetime import datetime

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.models import Entity, Individual, DocumentType, EntityType
from core.sec_file import SECFile
from .base import BaseEntityService


class IRSService(BaseEntityService):
    """
    IRS service for issuing tax documents
    """

    def __init__(self, private_key=None):
        entity = Entity(
            name="Internal Revenue Service",
            entity_type=EntityType.IRS,
            jurisdiction="US",
            website="https://www.irs.gov",
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
        """
        Issue an IRS document
        """
        if document_type == DocumentType.W2:
            return self.issue_w2(subject, data)
        elif document_type == DocumentType.FORM_1099:
            return self.issue_1099(subject, data)
        elif document_type == DocumentType.TAX_RETURN:
            return self.issue_tax_return(subject, data)
        else:
            raise ValueError(f"Unsupported document type: {document_type}")

    def issue_w2(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue a W-2 form (Wage and Tax Statement)
        """
        # Validate required fields
        required_fields = ['employer_name', 'employer_ein', 'wages', 'federal_tax_withheld', 'year']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        # Format W-2 content
        w2_content = {
            'form': 'W-2',
            'tax_year': data['year'],
            'employee': {
                'name': subject.full_name,
                'ssn': subject.ssn_hash,  # Hashed for privacy
                'address': subject.address
            },
            'employer': {
                'name': data['employer_name'],
                'ein': data['employer_ein'],
                'address': data.get('employer_address', {})
            },
            'compensation': {
                'wages_tips': data['wages'],
                'federal_income_tax_withheld': data['federal_tax_withheld'],
                'social_security_wages': data.get('social_security_wages', data['wages']),
                'social_security_tax_withheld': data.get('social_security_tax', 0),
                'medicare_wages': data.get('medicare_wages', data['wages']),
                'medicare_tax_withheld': data.get('medicare_tax', 0),
                'state_wages': data.get('state_wages', data['wages']),
                'state_income_tax': data.get('state_tax', 0)
            },
            'issued_date': datetime.now().isoformat()
        }

        # Create .sec file
        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.W2,
            content=self._format_json_content(w2_content),
            title=f"W-2 Wage and Tax Statement - {data['year']}",
            description=f"Form W-2 from {data['employer_name']} for tax year {data['year']}",
            expires_in_days=3650,  # 10 years (IRS retention requirement)
            custom_fields={
                'tax_year': data['year'],
                'form_type': 'W-2',
                'irs_form': True
            }
        )

        # Anchor to blockchain
        self.anchor_to_blockchain(sec_file)

        return sec_file

    def issue_1099(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue a 1099 form (Miscellaneous Income)
        """
        required_fields = ['payer_name', 'payer_tin', 'income', 'year', 'form_variant']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        content = {
            'form': f"1099-{data['form_variant']}",
            'tax_year': data['year'],
            'recipient': {
                'name': subject.full_name,
                'tin': subject.ssn_hash
            },
            'payer': {
                'name': data['payer_name'],
                'tin': data['payer_tin']
            },
            'income': data['income'],
            'federal_income_tax_withheld': data.get('tax_withheld', 0),
            'issued_date': datetime.now().isoformat()
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.FORM_1099,
            content=self._format_json_content(content),
            title=f"1099-{data['form_variant']} - {data['year']}",
            description=f"Form 1099-{data['form_variant']} from {data['payer_name']}",
            expires_in_days=3650,
            custom_fields={
                'tax_year': data['year'],
                'form_type': f"1099-{data['form_variant']}",
                'irs_form': True
            }
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file

    def issue_tax_return(self, subject: Individual, data: Dict[str, Any]) -> SECFile:
        """
        Issue a tax return acknowledgment
        """
        content = {
            'form': data.get('form', '1040'),
            'tax_year': data['year'],
            'filing_status': data['filing_status'],
            'agi': data.get('adjusted_gross_income'),
            'tax_liability': data.get('tax_liability'),
            'refund_amount': data.get('refund'),
            'filed_date': datetime.now().isoformat()
        }

        sec_file = self.create_sec_file(
            subject=subject,
            document_type=DocumentType.TAX_RETURN,
            content=self._format_json_content(content),
            title=f"Tax Return {data['year']}",
            description=f"Tax year {data['year']} return",
            expires_in_days=3650,
            custom_fields={'tax_year': data['year']}
        )

        self.anchor_to_blockchain(sec_file)
        return sec_file
