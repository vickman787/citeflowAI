import { x402ResourceServer, x402HTTPResourceServer, type RoutesConfig, type FacilitatorClient } from '@x402/core/server'
import { BatchFacilitatorClient, GatewayEvmScheme } from '@circle-fin/x402-batching/server'

// Circle's testnet and mainnet Gateway facilitators
const testnetFacilitator = new BatchFacilitatorClient({
  url: 'https://gateway-api-testnet.circle.com',
}) as unknown as FacilitatorClient

const mainnetFacilitator = new BatchFacilitatorClient({
  url: 'https://gateway-api.circle.com',
}) as unknown as FacilitatorClient

const coreServer = new x402ResourceServer([testnetFacilitator, mainnetFacilitator])

// GatewayEvmScheme merges facilitator extra data (verifyingContract, EIP-712 domain, USDC address)
// Register both Arc Testnet and Arc Mainnet
coreServer.register('eip155:5042002', new GatewayEvmScheme())
coreServer.register('eip155:5042', new GatewayEvmScheme())

export const AGENT_TREASURY_ADDRESS = process.env.AGENT_TREASURY_ADDRESS || '0x4465bfaa087d1cc8ed8b8bdb49fd28844d553e97'
export const AGENT_TREASURY_ADDRESS_MAINNET = process.env.AGENT_TREASURY_ADDRESS_MAINNET || '0x30d20839e4279358dd0c908cb7d96424e683aba3'

export const RESEARCH_PAYMENT_ACCEPTS = [
  // Arc Mainnet: Standard x402 Exact EIP-3009 (for OKX Agent Wallet and universal x402 agents)
  {
    scheme: 'exact',
    network: 'eip155:5042',
    amount: '1000000',
    asset: '0x3600000000000000000000000000000000000000',
    payTo: AGENT_TREASURY_ADDRESS_MAINNET,
    maxTimeoutSeconds: 2592000,
    extra: {
      name: 'USDC',
      version: '2',
    },
  },
  // Arc Mainnet: Circle Gateway Batched (for Circle Agent Wallet)
  {
    scheme: 'exact',
    network: 'eip155:5042',
    amount: '1000000',
    asset: '0x3600000000000000000000000000000000000000',
    payTo: AGENT_TREASURY_ADDRESS_MAINNET,
    maxTimeoutSeconds: 2592000,
    extra: {
      name: 'GatewayWalletBatched',
      version: '1',
      verifyingContract: '0x77777777dcc4d5a8b6e418fd04d8997ef11000ee',
    },
  },
  // Arc Testnet: Standard x402 Exact EIP-3009
  {
    scheme: 'exact',
    network: 'eip155:5042002',
    amount: '1000000',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    payTo: AGENT_TREASURY_ADDRESS,
    maxTimeoutSeconds: 2592000,
    extra: {
      name: 'USDC',
      version: '2',
    },
  },
  // Arc Testnet: Circle Gateway Batched
  {
    scheme: 'exact',
    network: 'eip155:5042002',
    amount: '1000000',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    payTo: AGENT_TREASURY_ADDRESS,
    maxTimeoutSeconds: 2592000,
    extra: {
      name: 'GatewayWalletBatched',
      version: '1',
      verifyingContract: '0x77777777dcc4d5a8b6e418fd04d8997ef11000ee',
    },
  },
]

const routes: RoutesConfig = {
  'GET /api/treasury/fund': {
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:5042002', // Arc Testnet
        payTo: AGENT_TREASURY_ADDRESS,
        price: '$0.50',
        maxTimeoutSeconds: 604800,
      },
      {
        scheme: 'exact',
        network: 'eip155:5042', // Arc Mainnet
        payTo: AGENT_TREASURY_ADDRESS_MAINNET,
        price: '$0.50',
        maxTimeoutSeconds: 604800,
      },
    ],
    resource: '/api/treasury/fund',
    description: 'CiteFlow AI treasury funding',
    mimeType: 'application/json',
  },
  'GET /api/agent/research': {
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:5042002', // Arc Testnet
        payTo: AGENT_TREASURY_ADDRESS,
        price: '$1.00',
        maxTimeoutSeconds: 2592000,
      },
      {
        scheme: 'exact',
        network: 'eip155:5042', // Arc Mainnet
        payTo: AGENT_TREASURY_ADDRESS_MAINNET,
        price: '$1.00',
        maxTimeoutSeconds: 2592000,
      },
    ],
    resource: '/api/agent/research',
    description: 'CiteFlow AI grounded research answer, agent-payable via x402',
    mimeType: 'application/json',
  },
}

const httpServer = new x402HTTPResourceServer(coreServer, routes)

let initialized: Promise<void> | null = null

// Route handlers run per-request in a serverless/edge environment, but the
// resource server only needs to fetch facilitator support once — cache the
// initialize() promise so concurrent requests share a single init.
export async function getX402Server() {
  if (!initialized) {
    initialized = httpServer.initialize()
  }
  await initialized
  return httpServer
}
