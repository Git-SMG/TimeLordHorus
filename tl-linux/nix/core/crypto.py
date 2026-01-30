"""
NIX Cryptography Module
Handles all cryptographic operations for NIX
"""

import os
import hashlib
import base64
from typing import Tuple, Optional
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ed25519, x25519
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import json


class NixCrypto:
    """
    Cryptographic operations for NIX
    - Ed25519 for signing
    - X25519 for key exchange
    - AES-256-GCM for encryption
    - SHA-256 for hashing
    """

    def __init__(self):
        self.backend = default_backend()

    # Key Generation

    def generate_signing_keypair(self) -> Tuple[ed25519.Ed25519PrivateKey, ed25519.Ed25519PublicKey]:
        """Generate Ed25519 signing keypair"""
        private_key = ed25519.Ed25519PrivateKey.generate()
        public_key = private_key.public_key()
        return private_key, public_key

    def generate_encryption_keypair(self) -> Tuple[x25519.X25519PrivateKey, x25519.X25519PublicKey]:
        """Generate X25519 encryption keypair"""
        private_key = x25519.X25519PrivateKey.generate()
        public_key = private_key.public_key()
        return private_key, public_key

    # Signing Operations

    def sign(self, private_key: ed25519.Ed25519PrivateKey, data: bytes) -> bytes:
        """Sign data with Ed25519 private key"""
        signature = private_key.sign(data)
        return signature

    def verify_signature(self, public_key: ed25519.Ed25519PublicKey, signature: bytes, data: bytes) -> bool:
        """Verify Ed25519 signature"""
        try:
            public_key.verify(signature, data)
            return True
        except Exception:
            return False

    # Encryption Operations

    def encrypt(self, data: bytes, key: bytes) -> Tuple[bytes, bytes]:
        """
        Encrypt data with AES-256-GCM
        Returns (ciphertext, nonce)
        """
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)  # 96-bit nonce for GCM
        ciphertext = aesgcm.encrypt(nonce, data, None)
        return ciphertext, nonce

    def decrypt(self, ciphertext: bytes, key: bytes, nonce: bytes) -> bytes:
        """Decrypt data with AES-256-GCM"""
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext

    def generate_encryption_key(self, password: str, salt: Optional[bytes] = None) -> Tuple[bytes, bytes]:
        """
        Generate AES-256 key from password using PBKDF2
        Returns (key, salt)
        """
        if salt is None:
            salt = os.urandom(32)

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,  # 256 bits
            salt=salt,
            iterations=100000,
            backend=self.backend
        )
        key = kdf.derive(password.encode())
        return key, salt

    # Hashing Operations

    def hash_data(self, data: bytes) -> bytes:
        """SHA-256 hash"""
        digest = hashlib.sha256(data).digest()
        return digest

    def hash_file(self, filepath: str) -> bytes:
        """SHA-256 hash of file"""
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.digest()

    # Key Serialization

    def serialize_private_key(self, private_key: ed25519.Ed25519PrivateKey, password: Optional[str] = None) -> bytes:
        """Serialize Ed25519 private key to bytes"""
        if password:
            encryption = serialization.BestAvailableEncryption(password.encode())
        else:
            encryption = serialization.NoEncryption()

        key_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=encryption
        )
        return key_bytes

    def serialize_public_key(self, public_key: ed25519.Ed25519PublicKey) -> bytes:
        """Serialize Ed25519 public key to bytes"""
        key_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return key_bytes

    def deserialize_private_key(self, key_bytes: bytes, password: Optional[str] = None) -> ed25519.Ed25519PrivateKey:
        """Deserialize Ed25519 private key from bytes"""
        password_bytes = password.encode() if password else None
        private_key = serialization.load_pem_private_key(
            key_bytes,
            password=password_bytes,
            backend=self.backend
        )
        return private_key

    def deserialize_public_key(self, key_bytes: bytes) -> ed25519.Ed25519PublicKey:
        """Deserialize Ed25519 public key from bytes"""
        public_key = serialization.load_pem_public_key(
            key_bytes,
            backend=self.backend
        )
        return public_key

    # Utility Functions

    def generate_random_bytes(self, length: int) -> bytes:
        """Generate cryptographically secure random bytes"""
        return os.urandom(length)

    def base64_encode(self, data: bytes) -> str:
        """Base64 encode bytes to string"""
        return base64.b64encode(data).decode('utf-8')

    def base64_decode(self, data: str) -> bytes:
        """Base64 decode string to bytes"""
        return base64.b64decode(data.encode('utf-8'))

    def fingerprint(self, public_key: ed25519.Ed25519PublicKey) -> str:
        """Generate fingerprint of public key"""
        key_bytes = self.serialize_public_key(public_key)
        hash_bytes = self.hash_data(key_bytes)
        return self.base64_encode(hash_bytes)[:16]  # First 16 chars


# Convenience functions

def generate_keypair():
    """Generate a new signing keypair"""
    crypto = NixCrypto()
    return crypto.generate_signing_keypair()


def sign_data(private_key, data: bytes) -> bytes:
    """Sign data"""
    crypto = NixCrypto()
    return crypto.sign(private_key, data)


def verify_data(public_key, signature: bytes, data: bytes) -> bool:
    """Verify signature"""
    crypto = NixCrypto()
    return crypto.verify_signature(public_key, signature, data)


def encrypt_data(data: bytes, password: str) -> dict:
    """Encrypt data with password"""
    crypto = NixCrypto()
    key, salt = crypto.generate_encryption_key(password)
    ciphertext, nonce = crypto.encrypt(data, key)

    return {
        'ciphertext': crypto.base64_encode(ciphertext),
        'nonce': crypto.base64_encode(nonce),
        'salt': crypto.base64_encode(salt)
    }


def decrypt_data(encrypted_dict: dict, password: str) -> bytes:
    """Decrypt data with password"""
    crypto = NixCrypto()

    ciphertext = crypto.base64_decode(encrypted_dict['ciphertext'])
    nonce = crypto.base64_decode(encrypted_dict['nonce'])
    salt = crypto.base64_decode(encrypted_dict['salt'])

    key, _ = crypto.generate_encryption_key(password, salt)
    plaintext = crypto.decrypt(ciphertext, key, nonce)

    return plaintext
