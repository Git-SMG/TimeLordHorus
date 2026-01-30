"""
Blockchain Anchoring Service
Anchors document hashes to blockchain for immutable verification
"""

import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List
import hashlib
import json

from .networks import NetworkType, NetworkConfig, get_network_config


@dataclass
class AnchorResult:
    """Result of blockchain anchoring operation"""
    success: bool
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    network: Optional[str] = None
    timestamp: datetime = None
    gas_used: Optional[int] = None
    confirmations: int = 0
    error: Optional[str] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'success': self.success,
            'transaction_hash': self.transaction_hash,
            'block_number': self.block_number,
            'network': self.network,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'gas_used': self.gas_used,
            'confirmations': self.confirmations,
            'error': self.error
        }


class BlockchainAnchorService:
    """
    Service for anchoring documents to blockchain

    This creates immutable records of document hashes on blockchain,
    allowing later verification of document authenticity and timestamp.
    """

    def __init__(self, network_type: NetworkType = NetworkType.POLYGON_MUMBAI):
        self.network_type = network_type
        self.network_config = get_network_config(network_type)
        self.web3 = None  # Will be initialized when needed
        self._initialize_connection()

    def _initialize_connection(self):
        """Initialize Web3 connection (simulated for now)"""
        # In real implementation:
        # from web3 import Web3
        # self.web3 = Web3(Web3.HTTPProvider(self.network_config.rpc_url))
        # Verify connection: self.web3.isConnected()
        pass

    def anchor_document(self, document_hash: bytes, metadata: dict = None) -> AnchorResult:
        """
        Anchor a document hash to blockchain

        Args:
            document_hash: SHA-256 hash of the document
            metadata: Optional metadata to include

        Returns:
            AnchorResult with transaction details
        """
        try:
            # In real implementation, this would:
            # 1. Connect to blockchain
            # 2. Create transaction with document hash
            # 3. Sign and send transaction
            # 4. Wait for confirmation
            # 5. Return transaction details

            # For now, simulate the process
            tx_hash = self._simulate_transaction(document_hash, metadata)
            block_number = self._get_current_block_number() + 1

            result = AnchorResult(
                success=True,
                transaction_hash=tx_hash,
                block_number=block_number,
                network=self.network_type.value,
                gas_used=21000,
                confirmations=1
            )

            return result

        except Exception as e:
            return AnchorResult(
                success=False,
                error=str(e),
                network=self.network_type.value
            )

    def anchor_batch(self, document_hashes: List[bytes]) -> List[AnchorResult]:
        """
        Anchor multiple documents in a single transaction (Merkle tree)
        More gas-efficient for multiple documents
        """
        results = []

        try:
            # Create Merkle tree from hashes
            merkle_root = self._create_merkle_root(document_hashes)

            # Anchor Merkle root
            root_result = self.anchor_document(merkle_root, {
                'batch_size': len(document_hashes),
                'merkle_tree': True
            })

            # Create results for each document
            for doc_hash in document_hashes:
                result = AnchorResult(
                    success=root_result.success,
                    transaction_hash=root_result.transaction_hash,
                    block_number=root_result.block_number,
                    network=root_result.network,
                    gas_used=root_result.gas_used // len(document_hashes),  # Split gas
                    confirmations=root_result.confirmations
                )
                results.append(result)

        except Exception as e:
            # Return error for all
            for _ in document_hashes:
                results.append(AnchorResult(
                    success=False,
                    error=str(e),
                    network=self.network_type.value
                ))

        return results

    def verify_anchor(self, transaction_hash: str) -> Optional[dict]:
        """
        Verify an anchor by transaction hash

        Returns:
            Dict with anchor details or None if not found
        """
        try:
            # In real implementation:
            # tx = self.web3.eth.get_transaction(transaction_hash)
            # receipt = self.web3.eth.get_transaction_receipt(transaction_hash)
            # block = self.web3.eth.get_block(receipt['blockNumber'])

            # For now, simulate
            return {
                'transaction_hash': transaction_hash,
                'block_number': 12345678,
                'timestamp': datetime.now().isoformat(),
                'confirmations': 100,
                'status': 'confirmed'
            }

        except Exception:
            return None

    def get_confirmations(self, transaction_hash: str) -> int:
        """Get number of confirmations for a transaction"""
        try:
            # In real implementation:
            # receipt = self.web3.eth.get_transaction_receipt(transaction_hash)
            # current_block = self.web3.eth.block_number
            # return current_block - receipt['blockNumber']

            # Simulate
            return 100
        except Exception:
            return 0

    def wait_for_confirmation(
        self,
        transaction_hash: str,
        required_confirmations: int = None,
        timeout: int = 300
    ) -> bool:
        """
        Wait for transaction to be confirmed

        Args:
            transaction_hash: Transaction to wait for
            required_confirmations: Number of confirmations needed (default from network config)
            timeout: Timeout in seconds

        Returns:
            True if confirmed, False if timeout
        """
        if required_confirmations is None:
            required_confirmations = self.network_config.confirmation_blocks

        start_time = time.time()

        while time.time() - start_time < timeout:
            confirmations = self.get_confirmations(transaction_hash)
            if confirmations >= required_confirmations:
                return True
            time.sleep(5)  # Check every 5 seconds

        return False

    def _simulate_transaction(self, document_hash: bytes, metadata: dict = None) -> str:
        """Simulate a blockchain transaction (for development)"""
        # Create a deterministic but unique transaction hash
        data = document_hash + str(time.time()).encode()
        if metadata:
            data += json.dumps(metadata).encode()

        tx_hash = hashlib.sha256(data).hexdigest()
        return f"0x{tx_hash}"

    def _get_current_block_number(self) -> int:
        """Get current block number (simulated)"""
        # In real implementation:
        # return self.web3.eth.block_number
        return 12345678

    def _create_merkle_root(self, hashes: List[bytes]) -> bytes:
        """
        Create Merkle root from list of hashes
        """
        if not hashes:
            return b''

        if len(hashes) == 1:
            return hashes[0]

        # Build Merkle tree
        tree_level = hashes[:]

        while len(tree_level) > 1:
            next_level = []

            # Process pairs
            for i in range(0, len(tree_level), 2):
                if i + 1 < len(tree_level):
                    # Hash pair
                    combined = tree_level[i] + tree_level[i + 1]
                    next_hash = hashlib.sha256(combined).digest()
                else:
                    # Odd one out, promote to next level
                    next_hash = tree_level[i]

                next_level.append(next_hash)

            tree_level = next_level

        return tree_level[0]

    def calculate_cost(self, num_documents: int = 1) -> dict:
        """
        Calculate estimated cost to anchor documents

        Returns:
            Dict with cost in ETH/MATIC and USD estimate
        """
        # Base gas for simple transaction
        gas_per_doc = 21000

        # Additional gas for contract interaction
        if num_documents > 1:
            # Batch anchoring is more efficient
            total_gas = 50000 + (num_documents * 5000)
        else:
            total_gas = gas_per_doc

        gas_price_wei = self.network_config.gas_price_gwei * 10**9
        cost_wei = total_gas * gas_price_wei
        cost_eth = cost_wei / 10**18

        # Rough USD estimates (would fetch real prices in production)
        eth_price = 2000 if 'ethereum' in self.network_type.value else 0.80  # MATIC price
        cost_usd = cost_eth * eth_price

        return {
            'gas': total_gas,
            'gas_price_gwei': self.network_config.gas_price_gwei,
            'cost_wei': cost_wei,
            'cost_eth': cost_eth,
            'cost_usd': cost_usd,
            'currency': 'ETH' if 'ethereum' in self.network_type.value else 'MATIC'
        }
