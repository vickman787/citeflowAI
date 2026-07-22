import { x402ResourceServer, x402HTTPResourceServer, type RoutesConfig, type FacilitatorClient } from '@x402/core/server'
import { BatchFacilitatorClient, GatewayEvmScheme } from '@circle-fin/x402-batching/server'

// Circle's testnet Gateway facilitator — mirrors the URL already used by
// the hand-rolled version of this route, now driving the real spec-compliant
// x402ResourceServer instead of a manually-built challenge/settle pair.
//
// The cast below works around @circle-fin/x402-batching resolving its own
// (structurally identical) copy of @x402/core's ESM type declarations rather
// than the CJS ones x402ResourceServer sees here — a dual-build artifact,
// not a real interface mismatch.
const facilitator = new BatchFacilitatorClient({
  url: 'https://gateway-api-testnet.circle.com',
}) as unknown as FacilitatorClient

const coreServer = new x402ResourceServer([facilitator])

// GatewayEvmScheme (not the generic ExactEvmScheme) is required here: it
// merges the facilitator's extra.verifyingContract/name/version into the
// requirements sent to clients — without it, Circle's own buyer SDK can't
// recognize this as a batched Gateway payment and construct the correct
// EIP-712 signing domain. It also knows Arc Testnet's USDC address
// internally, so a plain "$0.50" Money string works without a manual lookup.
coreServer.register('eip155:5042002', new GatewayEvmScheme())

const AGENT_TREASURY_ADDRESS = process.env.AGENT_TREASURY_ADDRESS || '0x933a2405f84c224be1ef373ba16e992e1f459682'

const routes: RoutesConfig = {
  'GET /api/treasury/fund': {
    accepts: {
      scheme: 'exact',
      network: 'eip155:5042002', // Arc Testnet
      payTo: AGENT_TREASURY_ADDRESS,
      price: '$0.50',
      maxTimeoutSeconds: 604800,
    },
    resource: '/api/treasury/fund',
    description: 'CiteFlow AI treasury funding',
    mimeType: 'application/json',
  },
  'GET /api/agent/research': {
    accepts: {
      scheme: 'exact',
      network: 'eip155:5042002', // Arc Testnet
      payTo: AGENT_TREASURY_ADDRESS,
      price: '$1.00',
      maxTimeoutSeconds: 604800,
    },
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
