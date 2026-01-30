"""
NIX Entity Modules
Specialized modules for different entity types
"""

from .base import BaseEntityService
from .irs import IRSService
from .dmv import DMVService
from .healthcare import HealthcareService
from .education import EducationService
from .benefits import BenefitsService

__all__ = [
    'BaseEntityService',
    'IRSService',
    'DMVService',
    'HealthcareService',
    'EducationService',
    'BenefitsService'
]
