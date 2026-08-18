// Manual smoke test for the x402 payment flow against the live research
// endpoint. Usage: CITEFLOW_PRIVATE_KEY=0x... node x402-test.mjs
import { GatewayClient } from '@circle-fin/x402-batching/client'

const PRIVATE_KEY = process.env.CITEFLOW_PRIVATE_KEY
const RESEARCH_URL = process.env.CITEFLOW_RESEARCH_URL || 'https://citeflowai.xyz/api/agent/research'
const QUERY = process.argv[2] || 'What is x402 and why does it matter for AI agents?'

if (!PRIVATE_KEY) {
  console.error('Missing CITEFLOW_PRIVATE_KEY environment variable (a funded Arc Testnet wallet key).')
  process.exit(1)
}

const client = new GatewayClient({
  chain: 'arcTestnet',
  privateKey: PRIVATE_KEY,
  rpcUrl: 'https://rpc.drpc.testnet.arc.network',
})

console.log('$ citeflow-x402-test')
console.log(`buyer wallet: ${client.account?.address ?? '(derived from key)'}`)
console.log(`endpoint:     ${RESEARCH_URL}`)
console.log(`query:        "${QUERY}"`)
console.log('')

console.log('[1/3] checking gateway balance...')
let balances = await client.getBalances()
console.log(`      wallet USDC:  ${balances.wallet.formatted}`)
console.log(`      gateway avail: ${balances.gateway.formattedAvailable}`)

if (BigInt(balances.gateway.available) < 1_000_000n) {
  console.log('')
  console.log('[2/3] depositing 2.00 USDC into gateway...')
  await client.deposit('2.00')
  balances = await client.getBalances()
  console.log(`      gateway avail now: ${balances.gateway.formattedAvailable}`)
} else {
  console.log('[2/3] gateway already funded, skipping deposit')
}

console.log('')
console.log('[3/3] paying for research via x402...')
const t0 = Date.now()
const { data, response } = await client.pay(`${RESEARCH_URL}?q=${encodeURIComponent(QUERY)}`)
const ms = Date.now() - t0

console.log(`      ✓ settled in ${ms}ms`)
console.log('')
console.log('--- answer ---')
console.log(data.answer)
console.log('')
if (data.purchasedSources?.length) {
  console.log('--- sources cited & paid ---')
  for (const s of data.purchasedSources) {
    console.log(`  - ${s.title} (${s.url})`)
  }
} else {
  console.log('(no sources cited on this run)')
}
console.log('')
console.log('citeflow-x402-test: PASS')
