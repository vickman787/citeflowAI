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
  // Circle-issued USDC contract address. Arc uses the same address on mainnet
  // and testnet. Source: https://developers.circle.com/stablecoins/usdc-contract-addresses
  usdcAddress: string;
  // Circle Gateway wallet contract used for batched x402 payments.
  gatewayWallet: string;
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
    usdcAddress: '0x3600000000000000000000000000000000000000',
    gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
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
    usdcAddress: '0x3600000000000000000000000000000000000000',
    gatewayWallet: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE',
  },
};

export const DEFAULT_NETWORK_ID: NetworkId = 'arc-testnet';

export function getNetworkConfig(id?: string | null): NetworkConfig {
  if (id && id in NETWORKS) {
    return NETWORKS[id as NetworkId];
  }
  return NETWORKS[DEFAULT_NETWORK_ID];
}
