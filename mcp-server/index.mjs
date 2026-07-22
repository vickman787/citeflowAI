#!/usr/bin/env node
// CiteFlow AI MCP server — exposes the x402-payable research endpoint
// (/api/agent/research) as a native tool for any MCP-compatible agent
// (Claude, Cursor, etc). Handles Gateway deposit, signing, and payment
// internally — the calling agent never sees any of the payment mechanics.
//
// Config (environment variables):
//   CITEFLOW_PRIVATE_KEY        required — your agent's own EVM wallet key.
//                                Never CiteFlow's; this wallet pays for calls.
//   CITEFLOW_RESEARCH_URL       optional — defaults to the production endpoint.
//   CITEFLOW_CHAIN              optional — defaults to 'arcTestnet'.
//   CITEFLOW_AUTO_DEPOSIT_USDC  optional — top-up amount when Gateway balance
//                                runs low, defaults to '5.00'.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { GatewayClient } from '@circle-fin/x402-batching/client'
import { z } from 'zod'

const PRIVATE_KEY = process.env.CITEFLOW_PRIVATE_KEY
const RESEARCH_URL = process.env.CITEFLOW_RESEARCH_URL || 'https://citeflowai.xyz/api/agent/research'
const CHAIN = process.env.CITEFLOW_CHAIN || 'arcTestnet'
const AUTO_DEPOSIT_USDC = process.env.CITEFLOW_AUTO_DEPOSIT_USDC || '5.00'
const PRICE_PER_CALL_ATOMIC = 500_000n // $0.50 in USDC's 6-decimal base units — must match the server's declared price

if (!PRIVATE_KEY) {
  console.error('[citeflow-mcp] Missing CITEFLOW_PRIVATE_KEY environment variable. Set it to your own EVM private key (never CiteFlow\'s).')
  process.exit(1)
}

const client = new GatewayClient({ chain: CHAIN, privateKey: PRIVATE_KEY })

// Tops up the Gateway balance automatically so a first-time caller doesn't
// hit a confusing "insufficient balance" error before they've deposited.
async function ensureFunded() {
  const balances = await client.getBalances()
  if (balances.gateway.available < PRICE_PER_CALL_ATOMIC) {
    await client.deposit(AUTO_DEPOSIT_USDC)
  }
}

const server = new McpServer({ name: 'citeflow-research', version: '1.0.0' })

server.registerTool(
  'citeflow_research',
  {
    title: 'CiteFlow Research',
    description:
      "Ask CiteFlow AI's research agent a question and get a grounded, cited answer sourced from its registered article corpus. " +
      'Costs $0.50 USDC per call, paid automatically via x402/Circle Gateway from this tool\'s configured wallet — no human approval needed.',
    inputSchema: {
      query: z.string().min(5).describe('The research question to ask'),
    },
  },
  async ({ query }) => {
    try {
      await ensureFunded()
      const { data } = await client.pay(`${RESEARCH_URL}?q=${encodeURIComponent(query)}`)

      const sources = data.purchasedSources || []
      const citationSummary = sources.map((s) => `- ${s.title} (${s.url})`).join('\n')
      const text = citationSummary
        ? `${data.answer}\n\nSources cited (paid automatically):\n${citationSummary}`
        : data.answer

      return { content: [{ type: 'text', text }] }
    } catch (err) {
      return {
        content: [{ type: 'text', text: `CiteFlow research failed: ${err.message}` }],
        isError: true,
      }
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[citeflow-mcp] CiteFlow MCP server running on stdio.')
