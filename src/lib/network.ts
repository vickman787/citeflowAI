export type NetworkId = 'arc-testnet' | 'arc-mainnet';

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  shortName: string;
  badge: string;
  chainId: number;
  circleChain: string;
  rpcUrl: string;
  explorerUrl: string;
  hasFaucet: boolean;
  faucetUrl?: string;
  eip155: string;
  gatewayUrl: string;
  isMainnet: boolean;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    shortName: 'Testnet',
    badge: 'ARC-TESTNET',
    chainId: 5042002,
    circleChain: 'ARC-TESTNET',
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
    hasFaucet: true,
    faucetUrl: 'https://faucet.circle.com/',
    eip155: 'eip155:5042002',
    gatewayUrl: 'https://gateway-api-testnet.circle.com',
    isMainnet: false,
  },
  'arc-mainnet': {
    id: 'arc-mainnet',
    name: 'Arc Mainnet',
    shortName: 'Mainnet',
    badge: 'ARC-MAINNET',
    chainId: 5042,
    circleChain: 'ARC',
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerUrl: 'https://explorer.arc.io',
    hasFaucet: false,
    eip155: 'eip155:5042',
    gatewayUrl: 'https://gateway-api.circle.com',
    isMainnet: true,
  },
};

export const DEFAULT_NETWORK_ID: NetworkId = 'arc-testnet';

export function getNetworkConfig(id?: string | null): NetworkConfig {
  if (id && id in NETWORKS) {
    return NETWORKS[id as NetworkId];
  }
  return NETWORKS[DEFAULT_NETWORK_ID];
}
