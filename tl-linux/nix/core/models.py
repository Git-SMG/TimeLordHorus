"""
NIX Data Models
Defines core data structures for entities, individuals, and documents
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class EntityType(Enum):
    """Types of entities in the NIX system"""
    # Government
    FEDERAL_GOVERNMENT = "federal_government"
    STATE_GOVERNMENT = "state_government"
    LOCAL_GOVERNMENT = "local_government"
    IRS = "irs"
    SSA = "ssa"  # Social Security Administration
    DMV = "dmv"
    SECRETARY_OF_STATE = "secretary_of_state"
    IMMIGRATION = "immigration"

    # Healthcare
    HEALTHCARE_PROVIDER = "healthcare_provider"
    HOSPITAL = "hospital"
    CLINIC = "clinic"
    PHARMACY = "pharmacy"
    LABORATORY = "laboratory"
    INSURANCE_HEALTH = "insurance_health"

    # Education
    UNIVERSITY = "university"
    COLLEGE = "college"
    SCHOOL = "school"
    CERTIFICATION_BODY = "certification_body"

    # Financial
    BANK = "bank"
    CREDIT_UNION = "credit_union"
    INSURANCE_AUTO = "insurance_auto"
    INSURANCE_LIFE = "insurance_life"

    # Employment
    EMPLOYER = "employer"

    # Other
    NOTARY = "notary"
    OTHER = "other"


class DocumentType(Enum):
    """Types of documents that can be issued as .sec files"""
    # Government Documents
    DRIVERS_LICENSE = "drivers_license"
    STATE_ID = "state_id"
    PASSPORT = "passport"
    BIRTH_CERTIFICATE = "birth_certificate"
    SOCIAL_SECURITY_CARD = "social_security_card"
    VEHICLE_REGISTRATION = "vehicle_registration"
    VEHICLE_TITLE = "vehicle_title"

    # Tax Documents
    W2 = "w2"
    W4 = "w4"
    FORM_1099 = "1099"
    TAX_RETURN = "tax_return"

    # Immigration
    I9 = "i9"
    WORK_AUTHORIZATION = "work_authorization"
    GREEN_CARD = "green_card"
    VISA = "visa"

    # Healthcare
    PRESCRIPTION = "prescription"
    LAB_RESULTS = "lab_results"
    MEDICAL_RECORDS = "medical_records"
    VACCINATION_RECORD = "vaccination_record"
    DIAGNOSIS = "diagnosis"
    INSURANCE_CARD = "insurance_card_health"

    # Education
    DIPLOMA = "diploma"
    TRANSCRIPT = "transcript"
    DEGREE = "degree"
    CERTIFICATION = "certification"
    LICENSE_PROFESSIONAL = "license_professional"

    # Insurance
    AUTO_INSURANCE = "auto_insurance"
    HEALTH_INSURANCE = "health_insurance"
    LIFE_INSURANCE = "life_insurance"

    # Benefits
    SNAP_BENEFITS = "snap_benefits"
    MEDICARE = "medicare"
    MEDICAID = "medicaid"
    UNEMPLOYMENT = "unemployment"

    # Financial
    BANK_STATEMENT = "bank_statement"
    PROOF_OF_INCOME = "proof_of_income"
    CREDIT_REPORT = "credit_report"

    # Employment
    EMPLOYMENT_VERIFICATION = "employment_verification"
    PAY_STUB = "pay_stub"

    # Other
    NOTARIZED_DOCUMENT = "notarized_document"
    CONTRACT = "contract"
    OTHER = "other"


class VerificationStatus(Enum):
    """Status of document verification"""
    VERIFIED = "verified"
    INVALID = "invalid"
    EXPIRED = "expired"
    REVOKED = "revoked"
    PENDING = "pending"
    ERROR = "error"


@dataclass
class Entity:
    """
    Represents an entity (agency, organization) in the NIX system
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    entity_type: EntityType = EntityType.OTHER
    jurisdiction: str = ""  # e.g., "US", "CA", "NY"
    public_key: Optional[bytes] = None
    contact_info: Dict[str, str] = field(default_factory=dict)
    website: str = ""
    api_endpoint: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    verified: bool = False

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'entity_type': self.entity_type.value,
            'jurisdiction': self.jurisdiction,
            'public_key': self.public_key.hex() if self.public_key else None,
            'contact_info': self.contact_info,
            'website': self.website,
            'api_endpoint': self.api_endpoint,
            'created_at': self.created_at.isoformat(),
            'verified': self.verified
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Entity':
        """Create from dictionary"""
        entity = cls(
            id=data.get('id', str(uuid.uuid4())),
            name=data.get('name', ''),
            entity_type=EntityType(data.get('entity_type', 'other')),
            jurisdiction=data.get('jurisdiction', ''),
            public_key=bytes.fromhex(data['public_key']) if data.get('public_key') else None,
            contact_info=data.get('contact_info', {}),
            website=data.get('website', ''),
            api_endpoint=data.get('api_endpoint', ''),
            verified=data.get('verified', False)
        )
        if 'created_at' in data:
            entity.created_at = datetime.fromisoformat(data['created_at'])
        return entity


@dataclass
class Individual:
    """
    Represents an individual user in the NIX system
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    first_name: str = ""
    last_name: str = ""
    middle_name: str = ""
    date_of_birth: Optional[datetime] = None
    ssn_hash: Optional[str] = None  # Hashed SSN for privacy
    email: str = ""
    phone: str = ""
    address: Dict[str, str] = field(default_factory=dict)
    public_key: Optional[bytes] = None
    created_at: datetime = field(default_factory=datetime.now)

    @property
    def full_name(self) -> str:
        """Get full name"""
        parts = [self.first_name, self.middle_name, self.last_name]
        return ' '.join(filter(None, parts))

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'middle_name': self.middle_name,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'ssn_hash': self.ssn_hash,
            'email': self.email,
            'phone': self.phone,
            'address': self.address,
            'public_key': self.public_key.hex() if self.public_key else None,
            'created_at': self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Individual':
        """Create from dictionary"""
        individual = cls(
            id=data.get('id', str(uuid.uuid4())),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            middle_name=data.get('middle_name', ''),
            ssn_hash=data.get('ssn_hash'),
            email=data.get('email', ''),
            phone=data.get('phone', ''),
            address=data.get('address', {}),
            public_key=bytes.fromhex(data['public_key']) if data.get('public_key') else None
        )
        if data.get('date_of_birth'):
            individual.date_of_birth = datetime.fromisoformat(data['date_of_birth'])
        if data.get('created_at'):
            individual.created_at = datetime.fromisoformat(data['created_at'])
        return individual


@dataclass
class Household:
    """
    Represents a household (array of individuals)
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    head_of_household: Optional[Individual] = None
    members: List[Individual] = field(default_factory=list)
    address: Dict[str, str] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    def add_member(self, individual: Individual):
        """Add member to household"""
        if individual not in self.members:
            self.members.append(individual)

    def remove_member(self, individual_id: str):
        """Remove member from household"""
        self.members = [m for m in self.members if m.id != individual_id]

    @property
    def member_count(self) -> int:
        """Get number of members"""
        return len(self.members)

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'head_of_household': self.head_of_household.to_dict() if self.head_of_household else None,
            'members': [m.to_dict() for m in self.members],
            'address': self.address,
            'created_at': self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Household':
        """Create from dictionary"""
        household = cls(
            id=data.get('id', str(uuid.uuid4())),
            name=data.get('name', ''),
            address=data.get('address', {}),
        )
        if data.get('head_of_household'):
            household.head_of_household = Individual.from_dict(data['head_of_household'])
        if data.get('members'):
            household.members = [Individual.from_dict(m) for m in data['members']]
        if data.get('created_at'):
            household.created_at = datetime.fromisoformat(data['created_at'])
        return household


@dataclass
class AccessControlEntry:
    """
    Access Control Entry for .sec files
    """
    entity_id: str
    entity_type: str  # 'entity', 'individual', 'household'
    permissions: List[str]  # ['read', 'verify', 'share']
    expires_at: Optional[datetime] = None
    conditions: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if this ACE is expired"""
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'entity_id': self.entity_id,
            'entity_type': self.entity_type,
            'permissions': self.permissions,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'conditions': self.conditions
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'AccessControlEntry':
        """Create from dictionary"""
        ace = cls(
            entity_id=data['entity_id'],
            entity_type=data['entity_type'],
            permissions=data.get('permissions', []),
            conditions=data.get('conditions', {})
        )
        if data.get('expires_at'):
            ace.expires_at = datetime.fromisoformat(data['expires_at'])
        return ace
