"""
Blockchain Network Configurations
"""

from enum import Enum
from dataclasses import dataclass
from typing import Dict, Optional


class NetworkType(Enum):
    """Supported blockchain networks"""
    ETHEREUM_MAINNET = "ethereum_mainnet"
    ETHEREUM_GOERLI = "ethereum_goerli"  # Testnet
    ETHEREUM_SEPOLIA = "ethereum_sepolia"  # Testnet
    POLYGON_MAINNET = "polygon_mainnet"
    POLYGON_MUMBAI = "polygon_mumbai"  # Testnet
    AVALANCHE_MAINNET = "avalanche_mainnet"
    AVALANCHE_FUJI = "avalanche_fuji"  # Testnet
    LOCAL = "local"  # Local development


@dataclass
class NetworkConfig:
    """Configuration for a blockchain network"""
    name: str
    network_type: NetworkType
    chain_id: int
    rpc_url: str
    explorer_url: str
    contract_address: Optional[str] = None
    gas_price_gwei: float = 20.0
    confirmation_blocks: int = 6

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'name': self.name,
            'network_type': self.network_type.value,
            'chain_id': self.chain_id,
            'rpc_url': self.rpc_url,
            'explorer_url': self.explorer_url,
            'contract_address': self.contract_address,
            'gas_price_gwei': self.gas_price_gwei,
            'confirmation_blocks': self.confirmation_blocks
        }


# Predefined network configurations
NETWORK_CONFIGS: Dict[NetworkType, NetworkConfig] = {
    NetworkType.ETHEREUM_MAINNET: NetworkConfig(
        name="Ethereum Mainnet",
        network_type=NetworkType.ETHEREUM_MAINNET,
        chain_id=1,
        rpc_url="https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
        explorer_url="https://etherscan.io",
        gas_price_gwei=30.0,
        confirmation_blocks=12
    ),
    NetworkType.ETHEREUM_SEPOLIA: NetworkConfig(
        name="Ethereum Sepolia Testnet",
        network_type=NetworkType.ETHEREUM_SEPOLIA,
        chain_id=11155111,
        rpc_url="https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY",
        explorer_url="https://sepolia.etherscan.io",
        gas_price_gwei=10.0,
        confirmation_blocks=3
    ),
    NetworkType.POLYGON_MAINNET: NetworkConfig(
        name="Polygon Mainnet",
        network_type=NetworkType.POLYGON_MAINNET,
        chain_id=137,
        rpc_url="https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
        explorer_url="https://polygonscan.com",
        gas_price_gwei=50.0,
        confirmation_blocks=128
    ),
    NetworkType.POLYGON_MUMBAI: NetworkConfig(
        name="Polygon Mumbai Testnet",
        network_type=NetworkType.POLYGON_MUMBAI,
        chain_id=80001,
        rpc_url="https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY",
        explorer_url="https://mumbai.polygonscan.com",
        gas_price_gwei=10.0,
        confirmation_blocks=5
    ),
    NetworkType.LOCAL: NetworkConfig(
        name="Local Development",
        network_type=NetworkType.LOCAL,
        chain_id=1337,
        rpc_url="http://localhost:8545",
        explorer_url="http://localhost:8545",
        gas_price_gwei=1.0,
        confirmation_blocks=1
    )
}


def get_network_config(network_type: NetworkType) -> NetworkConfig:
    """Get network configuration"""
    return NETWORK_CONFIGS.get(network_type, NETWORK_CONFIGS[NetworkType.LOCAL])


def get_explorer_url(network_type: NetworkType, tx_hash: str) -> str:
    """Get block explorer URL for transaction"""
    config = get_network_config(network_type)
    return f"{config.explorer_url}/tx/{tx_hash}"
