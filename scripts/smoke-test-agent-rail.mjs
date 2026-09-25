// Smoke test for the agent-payable research rail against a deployed CiteFlowAI.
//
// Runs against a live URL (default https://citeflowai.xyz). It does NOT need a
// funded wallet: it signs a throwaway EIP-3009 authorization with a random key.
//
// What it checks:
//   1. The 402 challenge advertises the correct Arc USDC + Gateway addresses.
//   2. A fresh authorization is accepted for processing (not rejected as replay).
//   3. Reusing the same authorization is rejected with HTTP 409.
//
// Side effects on the target: one research session row, one audit_events replay
// guard row, and one settlement attempt that is expected to fail (unfunded payer).
//
// Usage:
//   node scripts/smoke-test-agent-rail.mjs
//   CITEFLOW_URL=https://staging.example.com node scripts/smoke-test-agent-rail.mjs
//
// Exits non-zero on any failure, so it is CI-friendly.

import { randomBytes } from 'crypto'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'

const BASE_URL = process.env.CITEFLOW_URL || 'https://citeflowai.xyz'
const ENDPOINT = `${BASE_URL}/api/agent/research`
const QUERY = 'What is x402 and how do agent payments work?'

const ARC_USDC = '0x3600000000000000000000000000000000000000'
const ARC_TESTNET_GATEWAY = '0x0077777deba4688bdef3e311b846f25870a19b9'
const ARC_MAINNET_GATEWAY = '0x77777777dcc4d5a8b6e418fd04d8997ef11000ee'
const ARC_TESTNET_CHAIN_ID = 5042002

let failures = 0
function check(name, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${name}`)
  } else {
    failures++
    console.error(`  FAIL  ${name}${detail ? ` :: ${detail}` : ''}`)
  }
}

function findAccept(accepts, network, name) {
  return (accepts || []).find((a) => a.network === network && a.extra?.name === name)
}

async function main() {
  console.log(`Smoke test against ${ENDPOINT}\n`)

  // --- 1. Challenge and advertised addresses -------------------------------
  console.log('1) 402 challenge and advertised payment addresses')
  const challengeRes = await fetch(`${ENDPOINT}?q=${encodeURIComponent(QUERY)}`)
  const challenge = await challengeRes.json().catch(() => null)
  const accepts = challenge?.accepts || []

  check('endpoint returns 402 without payment', challengeRes.status === 402, `status=${challengeRes.status}`)

  const tExact = findAccept(accepts, 'eip155:5042002', 'USDC')
  const tBatch = findAccept(accepts, 'eip155:5042002', 'GatewayWalletBatched')
  const mExact = findAccept(accepts, 'eip155:5042', 'USDC')
  const mBatch = findAccept(accepts, 'eip155:5042', 'GatewayWalletBatched')

  check('testnet exact requirement present', !!tExact)
  check('mainnet exact requirement present', !!mExact)
  check('testnet Arc USDC is 0x3600...0000', tExact?.asset?.toLowerCase() === ARC_USDC, `got ${tExact?.asset}`)
  check('mainnet Arc USDC is 0x3600...0000', mExact?.asset?.toLowerCase() === ARC_USDC, `got ${mExact?.asset}`)
  check('testnet gateway wallet is 0x0077777...', tBatch?.extra?.verifyingContract?.toLowerCase() === ARC_TESTNET_GATEWAY, `got ${tBatch?.extra?.verifyingContract}`)
  check('mainnet gateway wallet is 0x7777777...', mBatch?.extra?.verifyingContract?.toLowerCase() === ARC_MAINNET_GATEWAY, `got ${mBatch?.extra?.verifyingContract}`)

  if (!tExact) {
    console.error('\nNo testnet exact requirement in the challenge; cannot continue.')
    process.exit(1)
  }

  // --- 2. Sign a throwaway EIP-3009 authorization ---------------------------
  const account = privateKeyToAccount(generatePrivateKey())
  const now = Math.floor(Date.now() / 1000)
  const authorization = {
    from: account.address,
    to: tExact.payTo,
    value: String(tExact.amount),
    validAfter: String(now - 600),
    validBefore: String(now + 3600),
    nonce: `0x${randomBytes(32).toString('hex')}`,
  }

  const signature = await account.signTypedData({
    domain: {
      name: tExact.extra?.name || 'USDC',
      version: tExact.extra?.version || '2',
      chainId: ARC_TESTNET_CHAIN_ID,
      verifyingContract: tExact.asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  })

  const paymentHeader = Buffer.from(
    JSON.stringify({
      x402Version: 2,
      scheme: 'exact',
      network: 'eip155:5042002',
      accepted: tExact,
      payload: { authorization, signature },
    })
  ).toString('base64')

  const send = async () => {
    const res = await fetch(`${ENDPOINT}?q=${encodeURIComponent(QUERY)}`, {
      headers: { 'payment-signature': paymentHeader },
    })
    const body = await res.json().catch(() => null)
    return { res, body }
  }

  // --- 3. Replay guard ------------------------------------------------------
  console.log('\n2) Replay guard on the standard EIP-3009 rail')
  const first = await send()
  check('first use is not rejected as replay (not 409)', first.res.status !== 409, `status=${first.res.status}`)
  check('first use passed payment verification (not 402 signature mismatch)', first.res.status !== 402 || !String(first.body?.error || '').includes('verification'), `status=${first.res.status} body=${JSON.stringify(first.body)}`)

  const second = await send()
  check('replay is rejected with 409', second.res.status === 409, `status=${second.res.status} body=${JSON.stringify(second.body)}`)

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
