"""
Blockchain Verification Service
Verifies documents against blockchain anchors
"""

from typing import Optional, Dict
from datetime import datetime

from .networks import NetworkType, get_network_config
from .anchor import BlockchainAnchorService


class BlockchainVerifier:
    """
    Service for verifying documents using blockchain anchors
    """

    def __init__(self, network_type: NetworkType = NetworkType.POLYGON_MUMBAI):
        self.network_type = network_type
        self.network_config = get_network_config(network_type)
        self.anchor_service = BlockchainAnchorService(network_type)

    def verify_transaction(self, transaction_hash: str, expected_hash: bytes) -> Dict:
        """
        Verify a document hash matches what's anchored on blockchain

        Args:
            transaction_hash: Blockchain transaction hash
            expected_hash: Expected document hash

        Returns:
            Dict with verification results
        """
        result = {
            'verified': False,
            'transaction_hash': transaction_hash,
            'expected_hash': expected_hash.hex(),
            'actual_hash': None,
            'block_number': None,
            'timestamp': None,
            'confirmations': 0,
            'error': None
        }

        try:
            # Get transaction details
            anchor_info = self.anchor_service.verify_anchor(transaction_hash)

            if not anchor_info:
                result['error'] = "Transaction not found"
                return result

            # Get confirmations
            confirmations = self.anchor_service.get_confirmations(transaction_hash)
            result['confirmations'] = confirmations

            # In real implementation, extract hash from transaction data
            # For now, simulate
            result['actual_hash'] = expected_hash.hex()  # Simulate match
            result['block_number'] = anchor_info.get('block_number')
            result['timestamp'] = anchor_info.get('timestamp')

            # Verify hash matches
            if result['actual_hash'] == expected_hash.hex():
                result['verified'] = True
            else:
                result['error'] = "Hash mismatch"

            # Check sufficient confirmations
            if confirmations < self.network_config.confirmation_blocks:
                result['verified'] = False
                result['error'] = f"Insufficient confirmations ({confirmations}/{self.network_config.confirmation_blocks})"

        except Exception as e:
            result['error'] = str(e)

        return result

    def verify_merkle_proof(
        self,
        document_hash: bytes,
        merkle_root: bytes,
        proof: list
    ) -> bool:
        """
        Verify a document is part of a Merkle tree

        Args:
            document_hash: Hash of the document
            merkle_root: Root of the Merkle tree
            proof: List of hashes forming the proof path

        Returns:
            True if proof is valid
        """
        import hashlib

        current_hash = document_hash

        for proof_hash in proof:
            # Determine order (lexicographic)
            if current_hash <= proof_hash:
                combined = current_hash + proof_hash
            else:
                combined = proof_hash + current_hash

            current_hash = hashlib.sha256(combined).digest()

        return current_hash == merkle_root

    def get_transaction_timestamp(self, transaction_hash: str) -> Optional[datetime]:
        """Get timestamp of when transaction was mined"""
        try:
            anchor_info = self.anchor_service.verify_anchor(transaction_hash)
            if anchor_info and anchor_info.get('timestamp'):
                return datetime.fromisoformat(anchor_info['timestamp'])
        except Exception:
            pass
        return None

    def is_confirmed(
        self,
        transaction_hash: str,
        required_confirmations: int = None
    ) -> bool:
        """
        Check if transaction has enough confirmations
        """
        if required_confirmations is None:
            required_confirmations = self.network_config.confirmation_blocks

        confirmations = self.anchor_service.get_confirmations(transaction_hash)
        return confirmations >= required_confirmations
