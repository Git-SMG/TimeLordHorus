"""
Base Entity Service
Common functionality for all entity services
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.models import Entity, Individual, DocumentType, AccessControlEntry
from core.sec_file import SECFile, SECMetadata
from core.crypto import NixCrypto, generate_keypair
from blockchain.anchor import BlockchainAnchorService, NetworkType


class BaseEntityService(ABC):
    """
    Base class for all entity services
    Provides common functionality for issuing and managing documents
    """

    def __init__(self, entity: Entity, private_key=None):
        self.entity = entity
        self.private_key = private_key
        self.crypto = NixCrypto()
        self.blockchain_service = BlockchainAnchorService(NetworkType.POLYGON_MUMBAI)

        # Generate keypair if not provided
        if not self.private_key:
            self.private_key, public_key = generate_keypair()
            self.entity.public_key = self.crypto.serialize_public_key(public_key)

    @abstractmethod
    def issue_document(
        self,
        subject: Individual,
        document_type: DocumentType,
        data: Dict[str, Any],
        **kwargs
    ) -> SECFile:
        """
        Issue a document to a subject
        Must be implemented by subclasses
        """
        pass

    def create_sec_file(
        self,
        subject: Individual,
        document_type: DocumentType,
        content: bytes,
        title: str,
        description: str,
        expires_in_days: int = 365,
        custom_fields: Dict[str, Any] = None
    ) -> SECFile:
        """
        Create a .sec file with standard settings
        """
        sec_file = SECFile()

        # Set metadata
        sec_file.metadata.issuer = self.entity
        sec_file.metadata.subject = subject
        sec_file.metadata.document_type = document_type
        sec_file.metadata.title = title
        sec_file.metadata.description = description
        sec_file.metadata.issued_at = datetime.now()
        sec_file.metadata.expires_at = datetime.now() + timedelta(days=expires_in_days)
        sec_file.metadata.document_id = self._generate_document_id(document_type)

        if custom_fields:
            sec_file.metadata.custom_fields.update(custom_fields)

        # Set content
        sec_file.set_content(content, encrypt=True, password=subject.id)

        # Add default ACL (subject can read)
        sec_file.add_acl_entry(AccessControlEntry(
            entity_id=subject.id,
            entity_type='individual',
            permissions=['read', 'verify', 'share']
        ))

        # Sign the document
        sec_file.sign(self.private_key)

        return sec_file

    def anchor_to_blockchain(self, sec_file: SECFile) -> bool:
        """
        Anchor a .sec file to blockchain
        """
        try:
            # Get document hash
            doc_hash = self.crypto.hash_data(sec_file.metadata.to_json().encode())

            # Anchor to blockchain
            result = self.blockchain_service.anchor_document(doc_hash)

            if result.success:
                # Create blockchain anchor in .sec file
                from core.sec_file import BlockchainAnchor
                sec_file.blockchain_anchor = BlockchainAnchor(
                    network=result.network,
                    transaction_hash=result.transaction_hash,
                    block_number=result.block_number,
                    timestamp=result.timestamp
                )
                return True

        except Exception as e:
            print(f"Blockchain anchoring failed: {e}")

        return False

    def revoke_document(
        self,
        sec_file: SECFile,
        reason: str
    ) -> bool:
        """
        Revoke a document
        """
        sec_file.metadata.revoked = True
        sec_file.metadata.revocation_reason = reason
        sec_file.metadata.revoked_at = datetime.now()

        # Re-sign after revocation
        sec_file.sign(self.private_key)

        # TODO: Publish to revocation service

        return True

    def grant_access(
        self,
        sec_file: SECFile,
        entity_id: str,
        entity_type: str,
        permissions: List[str],
        expires_in_days: int = 30
    ):
        """
        Grant access to another entity
        """
        ace = AccessControlEntry(
            entity_id=entity_id,
            entity_type=entity_type,
            permissions=permissions,
            expires_at=datetime.now() + timedelta(days=expires_in_days)
        )
        sec_file.add_acl_entry(ace)

        # Re-sign after ACL change
        sec_file.sign(self.private_key)

    def _generate_document_id(self, document_type: DocumentType) -> str:
        """Generate unique document ID"""
        import uuid
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        return f"{self.entity.entity_type.value.upper()}-{document_type.value.upper()}-{timestamp}-{unique_id}"

    def _format_json_content(self, data: Dict[str, Any]) -> bytes:
        """Format data as JSON bytes"""
        import json
        return json.dumps(data, indent=2).encode('utf-8')
