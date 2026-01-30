"""
NIX Core Module
Provides core functionality for the NIX file verification protocol
"""

from .crypto import NixCrypto
from .sec_file import SECFile, SECHeader, SECMetadata
from .models import Entity, Individual, Household, DocumentType
from .verification import VerificationEngine, VerificationResult

__all__ = [
    'NixCrypto',
    'SECFile',
    'SECHeader',
    'SECMetadata',
    'Entity',
    'Individual',
    'Household',
    'DocumentType',
    'VerificationEngine',
    'VerificationResult'
]

__version__ = '1.0.0'
