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

const AGENT_TREASURY_ADDRESS = process.env.AGENT_TREASURY_ADDRESS || '0x4465bfaa087d1cc8ed8b8bdb49fd28844d553e97'
const AGENT_TREASURY_ADDRESS_MAINNET = process.env.AGENT_TREASURY_ADDRESS_MAINNET || AGENT_TREASURY_ADDRESS

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
