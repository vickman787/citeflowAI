export type CiteflowNetwork = 'arc-testnet' | 'arc-mainnet'

export interface CircleCredentials {
  apiKey: string
  walletId: string
  rawEntitySecret: string
}

function requireEnv(name: string, network: CiteflowNetwork): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing ${name} for ${network}. Mainnet credentials must be configured explicitly and never fall back to testnet.`
    )
  }
  return value
}

// Resolve Circle credentials for a network. Mainnet never silently falls back
// to testnet credentials: a missing mainnet env var is a hard error.
export function getCircleCredentials(network: CiteflowNetwork | string = 'arc-testnet'): CircleCredentials {
  if (network === 'arc-mainnet') {
    return {
      apiKey: requireEnv('CIRCLE_API_KEY_MAINNET', 'arc-mainnet'),
      walletId: requireEnv('CIRCLE_WALLET_ID_MAINNET', 'arc-mainnet'),
      rawEntitySecret: requireEnv('RAW_ENTITY_SECRET_MAINNET', 'arc-mainnet'),
    }
  }
  return {
    apiKey: requireEnv('CIRCLE_API_KEY', 'arc-testnet'),
    walletId: requireEnv('CIRCLE_WALLET_ID', 'arc-testnet'),
    rawEntitySecret: requireEnv('RAW_ENTITY_SECRET', 'arc-testnet'),
  }
}

// Resolve the treasury (payTo) address for a network with the same strict rule.
export function getTreasuryAddress(network: CiteflowNetwork | string = 'arc-testnet'): string {
  return network === 'arc-mainnet'
    ? requireEnv('AGENT_TREASURY_ADDRESS_MAINNET', 'arc-mainnet')
    : requireEnv('AGENT_TREASURY_ADDRESS', 'arc-testnet')
}
