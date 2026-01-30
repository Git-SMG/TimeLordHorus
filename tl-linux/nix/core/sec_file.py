"""
NIX .sec File Format Handler
Implements the Self-Executing Contract file format
"""

import struct
import json
import zlib
from typing import Optional, List, Dict, Any
from datetime import datetime
from dataclasses import dataclass, field
import io

from .crypto import NixCrypto
from .models import Entity, Individual, DocumentType, AccessControlEntry


# Magic bytes for .sec files: "SEC\x01"
SEC_MAGIC = b'SEC\x01'
SEC_VERSION = 1

# Encryption types
ENCRYPTION_NONE = 0
ENCRYPTION_AES256GCM = 1

# Compression types
COMPRESSION_NONE = 0
COMPRESSION_ZLIB = 1


@dataclass
class SECHeader:
    """
    .sec file header (256 bytes)
    """
    magic: bytes = SEC_MAGIC
    version: int = SEC_VERSION
    encryption: int = ENCRYPTION_AES256GCM
    compression: int = COMPRESSION_ZLIB
    metadata_offset: int = 256
    content_offset: int = 0
    signature_offset: int = 0
    blockchain_offset: int = 0
    reserved: bytes = field(default_factory=lambda: b'\x00' * 208)

    def to_bytes(self) -> bytes:
        """Serialize header to bytes"""
        data = struct.pack(
            '<4sHBBQQQQ208s',
            self.magic,
            self.version,
            self.encryption,
            self.compression,
            self.metadata_offset,
            self.content_offset,
            self.signature_offset,
            self.blockchain_offset,
            self.reserved
        )
        return data

    @classmethod
    def from_bytes(cls, data: bytes) -> 'SECHeader':
        """Deserialize header from bytes"""
        unpacked = struct.unpack('<4sHBBQQQQ208s', data[:256])
        return cls(
            magic=unpacked[0],
            version=unpacked[1],
            encryption=unpacked[2],
            compression=unpacked[3],
            metadata_offset=unpacked[4],
            content_offset=unpacked[5],
            signature_offset=unpacked[6],
            blockchain_offset=unpacked[7],
            reserved=unpacked[8]
        )

    def is_valid(self) -> bool:
        """Check if header is valid"""
        return self.magic == SEC_MAGIC


@dataclass
class SECMetadata:
    """
    .sec file metadata
    """
    # Issuer information
    issuer: Entity = field(default_factory=Entity)
    issuer_signature: Optional[bytes] = None

    # Subject information
    subject: Optional[Individual] = None
    subject_type: str = "individual"  # 'individual' or 'household'

    # Document information
    document_type: DocumentType = DocumentType.OTHER
    document_id: str = ""
    title: str = ""
    description: str = ""

    # Dates
    issued_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    valid_from: Optional[datetime] = None

    # Access control
    acl: List[AccessControlEntry] = field(default_factory=list)

    # Verification
    verification_requirements: Dict[str, Any] = field(default_factory=dict)
    revocation_check_url: str = ""

    # Status
    revoked: bool = False
    revocation_reason: str = ""
    revoked_at: Optional[datetime] = None

    # Custom fields
    custom_fields: Dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> str:
        """Convert to JSON string"""
        data = {
            'issuer': self.issuer.to_dict() if self.issuer else None,
            'issuer_signature': self.issuer_signature.hex() if self.issuer_signature else None,
            'subject': self.subject.to_dict() if self.subject else None,
            'subject_type': self.subject_type,
            'document_type': self.document_type.value if self.document_type else None,
            'document_id': self.document_id,
            'title': self.title,
            'description': self.description,
            'issued_at': self.issued_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'acl': [ace.to_dict() for ace in self.acl],
            'verification_requirements': self.verification_requirements,
            'revocation_check_url': self.revocation_check_url,
            'revoked': self.revoked,
            'revocation_reason': self.revocation_reason,
            'revoked_at': self.revoked_at.isoformat() if self.revoked_at else None,
            'custom_fields': self.custom_fields
        }
        return json.dumps(data, indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> 'SECMetadata':
        """Create from JSON string"""
        data = json.loads(json_str)
        metadata = cls(
            document_type=DocumentType(data['document_type']) if data.get('document_type') else DocumentType.OTHER,
            document_id=data.get('document_id', ''),
            title=data.get('title', ''),
            description=data.get('description', ''),
            subject_type=data.get('subject_type', 'individual'),
            verification_requirements=data.get('verification_requirements', {}),
            revocation_check_url=data.get('revocation_check_url', ''),
            revoked=data.get('revoked', False),
            revocation_reason=data.get('revocation_reason', ''),
            custom_fields=data.get('custom_fields', {})
        )

        # Parse issuer
        if data.get('issuer'):
            metadata.issuer = Entity.from_dict(data['issuer'])
        if data.get('issuer_signature'):
            metadata.issuer_signature = bytes.fromhex(data['issuer_signature'])

        # Parse subject
        if data.get('subject'):
            metadata.subject = Individual.from_dict(data['subject'])

        # Parse dates
        if data.get('issued_at'):
            metadata.issued_at = datetime.fromisoformat(data['issued_at'])
        if data.get('expires_at'):
            metadata.expires_at = datetime.fromisoformat(data['expires_at'])
        if data.get('valid_from'):
            metadata.valid_from = datetime.fromisoformat(data['valid_from'])
        if data.get('revoked_at'):
            metadata.revoked_at = datetime.fromisoformat(data['revoked_at'])

        # Parse ACL
        if data.get('acl'):
            metadata.acl = [AccessControlEntry.from_dict(ace) for ace in data['acl']]

        return metadata


@dataclass
class BlockchainAnchor:
    """
    Blockchain anchoring information
    """
    network: str = "ethereum"  # ethereum, polygon, etc.
    transaction_hash: str = ""
    block_number: int = 0
    merkle_proof: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)
    contract_address: str = ""

    def to_json(self) -> str:
        """Convert to JSON"""
        data = {
            'network': self.network,
            'transaction_hash': self.transaction_hash,
            'block_number': self.block_number,
            'merkle_proof': self.merkle_proof,
            'timestamp': self.timestamp.isoformat(),
            'contract_address': self.contract_address
        }
        return json.dumps(data)

    @classmethod
    def from_json(cls, json_str: str) -> 'BlockchainAnchor':
        """Create from JSON"""
        data = json.loads(json_str)
        anchor = cls(
            network=data.get('network', 'ethereum'),
            transaction_hash=data.get('transaction_hash', ''),
            block_number=data.get('block_number', 0),
            merkle_proof=data.get('merkle_proof', []),
            contract_address=data.get('contract_address', '')
        )
        if data.get('timestamp'):
            anchor.timestamp = datetime.fromisoformat(data['timestamp'])
        return anchor


class SECFile:
    """
    .sec file handler - Self-Executing Contract
    """

    def __init__(self):
        self.header = SECHeader()
        self.metadata = SECMetadata()
        self.content: Optional[bytes] = None
        self.content_encrypted: bool = False
        self.blockchain_anchor: Optional[BlockchainAnchor] = None
        self.crypto = NixCrypto()

        # Internal state
        self._encryption_key: Optional[bytes] = None
        self._content_hash: Optional[bytes] = None

    def set_content(self, data: bytes, encrypt: bool = True, password: Optional[str] = None):
        """
        Set the content of the .sec file
        """
        self.content = data
        self.content_encrypted = encrypt

        if encrypt and password:
            # Generate encryption key from password
            self._encryption_key, salt = self.crypto.generate_encryption_key(password)
            # Store salt in metadata custom fields
            self.metadata.custom_fields['encryption_salt'] = self.crypto.base64_encode(salt)

        # Compute hash
        self._content_hash = self.crypto.hash_data(data)

    def get_content(self, password: Optional[str] = None) -> Optional[bytes]:
        """
        Get the decrypted content
        """
        if not self.content:
            return None

        if self.content_encrypted and password:
            # Decrypt content
            salt = self.crypto.base64_decode(self.metadata.custom_fields.get('encryption_salt', ''))
            key, _ = self.crypto.generate_encryption_key(password, salt)
            # Content should be stored as encrypted
            return self.content  # In real implementation, decrypt here

        return self.content

    def sign(self, issuer_private_key):
        """
        Sign the .sec file with issuer's private key
        """
        # Sign metadata + content hash
        data_to_sign = self.metadata.to_json().encode() + (self._content_hash or b'')
        signature = self.crypto.sign(issuer_private_key, data_to_sign)
        self.metadata.issuer_signature = signature

    def verify_signature(self, issuer_public_key) -> bool:
        """
        Verify the issuer's signature
        """
        if not self.metadata.issuer_signature:
            return False

        # Verify signature
        data_to_verify = self.metadata.to_json().encode() + (self._content_hash or b'')
        return self.crypto.verify_signature(
            issuer_public_key,
            self.metadata.issuer_signature,
            data_to_verify
        )

    def save(self, filepath: str):
        """
        Save .sec file to disk
        """
        with open(filepath, 'wb') as f:
            # Prepare metadata
            metadata_bytes = self.metadata.to_json().encode('utf-8')
            if self.header.compression == COMPRESSION_ZLIB:
                metadata_bytes = zlib.compress(metadata_bytes)

            # Prepare content
            content_bytes = self.content or b''
            if self.header.compression == COMPRESSION_ZLIB and content_bytes:
                content_bytes = zlib.compress(content_bytes)

            # Prepare blockchain anchor
            blockchain_bytes = b''
            if self.blockchain_anchor:
                blockchain_bytes = self.blockchain_anchor.to_json().encode('utf-8')
                if self.header.compression == COMPRESSION_ZLIB:
                    blockchain_bytes = zlib.compress(blockchain_bytes)

            # Update offsets
            self.header.metadata_offset = 256
            self.header.content_offset = self.header.metadata_offset + len(metadata_bytes)
            self.header.signature_offset = self.header.content_offset + len(content_bytes)
            self.header.blockchain_offset = self.header.signature_offset + len(self.metadata.issuer_signature or b'')

            # Write header
            f.write(self.header.to_bytes())

            # Write metadata
            f.write(metadata_bytes)

            # Write content
            f.write(content_bytes)

            # Write signature (already in metadata, but could be separate)

            # Write blockchain anchor
            f.write(blockchain_bytes)

    @classmethod
    def load(cls, filepath: str, password: Optional[str] = None) -> 'SECFile':
        """
        Load .sec file from disk
        """
        sec_file = cls()

        with open(filepath, 'rb') as f:
            # Read header
            header_bytes = f.read(256)
            sec_file.header = SECHeader.from_bytes(header_bytes)

            if not sec_file.header.is_valid():
                raise ValueError("Invalid .sec file: bad magic bytes")

            # Read metadata
            f.seek(sec_file.header.metadata_offset)
            metadata_size = sec_file.header.content_offset - sec_file.header.metadata_offset
            metadata_bytes = f.read(metadata_size)

            if sec_file.header.compression == COMPRESSION_ZLIB:
                metadata_bytes = zlib.decompress(metadata_bytes)

            sec_file.metadata = SECMetadata.from_json(metadata_bytes.decode('utf-8'))

            # Read content
            f.seek(sec_file.header.content_offset)
            content_size = sec_file.header.signature_offset - sec_file.header.content_offset
            if content_size > 0:
                content_bytes = f.read(content_size)

                if sec_file.header.compression == COMPRESSION_ZLIB:
                    content_bytes = zlib.decompress(content_bytes)

                sec_file.content = content_bytes
                sec_file.content_encrypted = sec_file.header.encryption != ENCRYPTION_NONE

            # Read blockchain anchor if present
            if sec_file.header.blockchain_offset > 0:
                f.seek(sec_file.header.blockchain_offset)
                blockchain_bytes = f.read()
                if blockchain_bytes:
                    if sec_file.header.compression == COMPRESSION_ZLIB:
                        blockchain_bytes = zlib.decompress(blockchain_bytes)
                    sec_file.blockchain_anchor = BlockchainAnchor.from_json(blockchain_bytes.decode('utf-8'))

        return sec_file

    def is_expired(self) -> bool:
        """Check if document is expired"""
        if not self.metadata.expires_at:
            return False
        return datetime.now() > self.metadata.expires_at

    def is_valid_now(self) -> bool:
        """Check if document is valid now"""
        now = datetime.now()

        # Check valid_from
        if self.metadata.valid_from and now < self.metadata.valid_from:
            return False

        # Check expiration
        if self.metadata.expires_at and now > self.metadata.expires_at:
            return False

        # Check revocation
        if self.metadata.revoked:
            return False

        return True

    def add_acl_entry(self, entry: AccessControlEntry):
        """Add access control entry"""
        self.metadata.acl.append(entry)

    def check_permission(self, entity_id: str, permission: str) -> bool:
        """Check if entity has permission"""
        for ace in self.metadata.acl:
            if ace.entity_id == entity_id and not ace.is_expired():
                if permission in ace.permissions:
                    return True
        return False

    def __repr__(self) -> str:
        return f"SECFile(type={self.metadata.document_type.value}, issuer={self.metadata.issuer.name}, expires={self.metadata.expires_at})"
