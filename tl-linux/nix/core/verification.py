"""
NIX Verification Engine
Handles verification of .sec files and documents
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from .sec_file import SECFile
from .models import Entity, Individual, VerificationStatus
from .crypto import NixCrypto


class VerificationLevel(Enum):
    """Level of verification performed"""
    BASIC = "basic"  # Basic signature and expiration check
    STANDARD = "standard"  # + blockchain verification
    COMPREHENSIVE = "comprehensive"  # + revocation check + all validations
    STRICT = "strict"  # + custom verification logic execution


@dataclass
class VerificationResult:
    """
    Result of document verification
    """
    status: VerificationStatus = VerificationStatus.PENDING
    level: VerificationLevel = VerificationLevel.BASIC
    verified_at: datetime = field(default_factory=datetime.now)
    verified_by: Optional[Entity] = None

    # Verification checks
    signature_valid: bool = False
    not_expired: bool = False
    not_revoked: bool = False
    blockchain_verified: bool = False
    issuer_trusted: bool = False

    # Details
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)

    # Blockchain info
    blockchain_transaction: Optional[str] = None
    blockchain_confirmations: int = 0

    @property
    def is_valid(self) -> bool:
        """Check if overall verification passed"""
        return self.status == VerificationStatus.VERIFIED

    @property
    def score(self) -> float:
        """Calculate verification score (0-100)"""
        checks = [
            self.signature_valid,
            self.not_expired,
            self.not_revoked,
            self.blockchain_verified,
            self.issuer_trusted
        ]
        return (sum(checks) / len(checks)) * 100

    def add_error(self, error: str):
        """Add an error message"""
        self.errors.append(error)
        if self.status == VerificationStatus.PENDING:
            self.status = VerificationStatus.ERROR

    def add_warning(self, warning: str):
        """Add a warning message"""
        self.warnings.append(warning)

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'status': self.status.value,
            'level': self.level.value,
            'verified_at': self.verified_at.isoformat(),
            'verified_by': self.verified_by.to_dict() if self.verified_by else None,
            'signature_valid': self.signature_valid,
            'not_expired': self.not_expired,
            'not_revoked': self.not_revoked,
            'blockchain_verified': self.blockchain_verified,
            'issuer_trusted': self.issuer_trusted,
            'errors': self.errors,
            'warnings': self.warnings,
            'details': self.details,
            'score': self.score,
            'blockchain_transaction': self.blockchain_transaction,
            'blockchain_confirmations': self.blockchain_confirmations
        }


class VerificationEngine:
    """
    Engine for verifying .sec files
    """

    def __init__(self):
        self.crypto = NixCrypto()
        self.trusted_entities: Dict[str, Entity] = {}
        self.revocation_cache: Dict[str, bool] = {}

    def add_trusted_entity(self, entity: Entity):
        """Add a trusted entity"""
        self.trusted_entities[entity.id] = entity

    def remove_trusted_entity(self, entity_id: str):
        """Remove a trusted entity"""
        if entity_id in self.trusted_entities:
            del self.trusted_entities[entity_id]

    def is_entity_trusted(self, entity_id: str) -> bool:
        """Check if an entity is trusted"""
        return entity_id in self.trusted_entities

    def verify(
        self,
        sec_file: SECFile,
        level: VerificationLevel = VerificationLevel.STANDARD,
        verifier: Optional[Entity] = None
    ) -> VerificationResult:
        """
        Verify a .sec file
        """
        result = VerificationResult(level=level, verified_by=verifier)

        # Basic checks
        if level.value in [VerificationLevel.BASIC.value, VerificationLevel.STANDARD.value,
                           VerificationLevel.COMPREHENSIVE.value, VerificationLevel.STRICT.value]:
            self._verify_basic(sec_file, result)

        # Standard checks (includes blockchain)
        if level.value in [VerificationLevel.STANDARD.value, VerificationLevel.COMPREHENSIVE.value,
                           VerificationLevel.STRICT.value]:
            self._verify_blockchain(sec_file, result)

        # Comprehensive checks (includes revocation)
        if level.value in [VerificationLevel.COMPREHENSIVE.value, VerificationLevel.STRICT.value]:
            self._verify_revocation(sec_file, result)

        # Strict checks (custom logic)
        if level == VerificationLevel.STRICT:
            self._verify_custom_logic(sec_file, result)

        # Determine final status
        self._determine_status(sec_file, result)

        return result

    def _verify_basic(self, sec_file: SECFile, result: VerificationResult):
        """Basic verification: signature and expiration"""

        # Check signature
        if sec_file.metadata.issuer and sec_file.metadata.issuer.public_key:
            try:
                # In real implementation, deserialize public key and verify
                # For now, simulate
                result.signature_valid = True
                result.details['signature_algorithm'] = 'Ed25519'
            except Exception as e:
                result.signature_valid = False
                result.add_error(f"Signature verification failed: {str(e)}")
        else:
            result.signature_valid = False
            result.add_error("No issuer public key available")

        # Check expiration
        if not sec_file.is_expired():
            result.not_expired = True
        else:
            result.not_expired = False
            result.add_error(f"Document expired on {sec_file.metadata.expires_at}")
            result.status = VerificationStatus.EXPIRED

        # Check if valid now
        if not sec_file.is_valid_now():
            if sec_file.metadata.valid_from and datetime.now() < sec_file.metadata.valid_from:
                result.add_error(f"Document not yet valid (valid from {sec_file.metadata.valid_from})")

        # Check issuer trust
        if sec_file.metadata.issuer:
            result.issuer_trusted = self.is_entity_trusted(sec_file.metadata.issuer.id)
            if not result.issuer_trusted:
                result.add_warning(f"Issuer '{sec_file.metadata.issuer.name}' is not in trusted entities list")

    def _verify_blockchain(self, sec_file: SECFile, result: VerificationResult):
        """Verify blockchain anchor"""

        if sec_file.blockchain_anchor:
            # In real implementation, verify on blockchain
            # For now, simulate
            result.blockchain_verified = True
            result.blockchain_transaction = sec_file.blockchain_anchor.transaction_hash
            result.blockchain_confirmations = 100  # Simulate confirmations
            result.details['blockchain_network'] = sec_file.blockchain_anchor.network
            result.details['block_number'] = sec_file.blockchain_anchor.block_number
        else:
            result.blockchain_verified = False
            result.add_warning("No blockchain anchor found")

    def _verify_revocation(self, sec_file: SECFile, result: VerificationResult):
        """Check revocation status"""

        # Check metadata revocation flag
        if sec_file.metadata.revoked:
            result.not_revoked = False
            result.status = VerificationStatus.REVOKED
            result.add_error(f"Document revoked: {sec_file.metadata.revocation_reason}")
            return

        # Check revocation URL if provided
        if sec_file.metadata.revocation_check_url:
            # In real implementation, query revocation endpoint
            # For now, simulate
            is_revoked = self._check_revocation_service(
                sec_file.metadata.document_id,
                sec_file.metadata.revocation_check_url
            )
            if is_revoked:
                result.not_revoked = False
                result.status = VerificationStatus.REVOKED
                result.add_error("Document appears on revocation list")
            else:
                result.not_revoked = True
        else:
            result.not_revoked = True
            result.add_warning("No revocation check URL provided")

    def _verify_custom_logic(self, sec_file: SECFile, result: VerificationResult):
        """Execute custom verification logic"""

        # Check verification requirements in metadata
        if sec_file.metadata.verification_requirements:
            requirements = sec_file.metadata.verification_requirements

            # Example: Check age requirement
            if 'minimum_age' in requirements:
                if sec_file.metadata.subject and sec_file.metadata.subject.date_of_birth:
                    age = (datetime.now() - sec_file.metadata.subject.date_of_birth).days // 365
                    min_age = requirements['minimum_age']
                    if age < min_age:
                        result.add_error(f"Subject does not meet minimum age requirement ({min_age})")
                    else:
                        result.details['age_verified'] = True

            # Example: Check jurisdiction
            if 'required_jurisdiction' in requirements:
                required = requirements['required_jurisdiction']
                actual = sec_file.metadata.issuer.jurisdiction
                if actual != required:
                    result.add_error(f"Jurisdiction mismatch: expected {required}, got {actual}")

            # Other custom checks can be added here

    def _determine_status(self, sec_file: SECFile, result: VerificationResult):
        """Determine final verification status"""

        if result.errors:
            # Already has errors
            if result.status == VerificationStatus.PENDING:
                result.status = VerificationStatus.INVALID
        elif sec_file.is_expired():
            result.status = VerificationStatus.EXPIRED
        elif sec_file.metadata.revoked:
            result.status = VerificationStatus.REVOKED
        else:
            # All checks passed
            result.status = VerificationStatus.VERIFIED

    def _check_revocation_service(self, document_id: str, url: str) -> bool:
        """
        Check if document is revoked via external service
        (In real implementation, this would make an HTTP request)
        """
        # Check cache first
        cache_key = f"{url}:{document_id}"
        if cache_key in self.revocation_cache:
            return self.revocation_cache[cache_key]

        # In real implementation:
        # - Make HTTP request to revocation service
        # - Parse response
        # - Cache result
        # For now, return False (not revoked)
        is_revoked = False
        self.revocation_cache[cache_key] = is_revoked
        return is_revoked

    def verify_quick(self, sec_file: SECFile) -> bool:
        """
        Quick verification - just signature and expiration
        Returns True if valid, False otherwise
        """
        result = self.verify(sec_file, level=VerificationLevel.BASIC)
        return result.is_valid

    def verify_access(self, sec_file: SECFile, entity_id: str, permission: str) -> bool:
        """
        Verify if entity has permission to access document
        """
        # Check if document is valid
        if not sec_file.is_valid_now():
            return False

        # Check ACL
        return sec_file.check_permission(entity_id, permission)

    def generate_verification_report(self, result: VerificationResult) -> str:
        """
        Generate human-readable verification report
        """
        lines = []
        lines.append("=" * 60)
        lines.append("NIX VERIFICATION REPORT")
        lines.append("=" * 60)
        lines.append(f"Status: {result.status.value.upper()}")
        lines.append(f"Level: {result.level.value}")
        lines.append(f"Verified At: {result.verified_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"Score: {result.score:.1f}/100")
        lines.append("")

        lines.append("Checks:")
        lines.append(f"  ✓ Signature Valid: {result.signature_valid}")
        lines.append(f"  ✓ Not Expired: {result.not_expired}")
        lines.append(f"  ✓ Not Revoked: {result.not_revoked}")
        lines.append(f"  ✓ Blockchain Verified: {result.blockchain_verified}")
        lines.append(f"  ✓ Issuer Trusted: {result.issuer_trusted}")
        lines.append("")

        if result.errors:
            lines.append("Errors:")
            for error in result.errors:
                lines.append(f"  ✗ {error}")
            lines.append("")

        if result.warnings:
            lines.append("Warnings:")
            for warning in result.warnings:
                lines.append(f"  ⚠ {warning}")
            lines.append("")

        if result.blockchain_transaction:
            lines.append("Blockchain:")
            lines.append(f"  Transaction: {result.blockchain_transaction}")
            lines.append(f"  Confirmations: {result.blockchain_confirmations}")
            lines.append("")

        lines.append("=" * 60)
        return "\n".join(lines)
