import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { maxUint256, parseUnits } from 'viem'

const SWEEP_ID = process.argv[2]
if (!SWEEP_ID) {
  console.error('Usage: node scripts/retry-gateway-sweep.mjs <gateway_sweeps.id>')
  process.exit(1)
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const timeout = (ms) => AbortSignal.timeout(ms)
const hex = (s) => (s.startsWith('0x') ? s.slice(2) : s)
const u32 = (b, o) => b.readUInt32BE(o)
const u256 = (b, o) => BigInt(`0x${b.subarray(o, o + 32).toString('hex')}`).toString()
const b32 = (b, o) => `0x${b.subarray(o, o + 32).toString('hex')}`

async function ciphertext() {
  const res = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY_MAINNET}` },
    signal: timeout(20_000),
  })
  const data = await res.json()
  return crypto
    .publicEncrypt(
      { key: data.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(process.env.RAW_ENTITY_SECRET_MAINNET, 'hex')
    )
    .toString('base64')
}

function specFromAttestation(attestation) {
  const buf = Buffer.from(hex(attestation), 'hex')
  const len = u32(buf, 36)
  const spec = buf.subarray(40, 40 + len)
  let o = 4 // Skip TransferSpec magic 0xca85def7.
  const parsed = { version: u32(spec, o) }
  o += 4
  parsed.sourceDomain = u32(spec, o)
  o += 4
  parsed.destinationDomain = u32(spec, o)
  o += 4
  parsed.sourceContract = b32(spec, o)
  o += 32
  parsed.destinationContract = b32(spec, o)
  o += 32
  parsed.sourceToken = b32(spec, o)
  o += 32
  parsed.destinationToken = b32(spec, o)
  o += 32
  parsed.sourceDepositor = b32(spec, o)
  o += 32
  parsed.destinationRecipient = b32(spec, o)
  o += 32
  parsed.sourceSigner = b32(spec, o)
  o += 32
  parsed.destinationCaller = b32(spec, o)
  o += 32
  parsed.value = u256(spec, o)
  o += 32
  parsed.salt = b32(spec, o)
  o += 32
  const hookLen = u32(spec, o)
  o += 4
  parsed.hookData = `0x${spec.subarray(o, o + hookLen).toString('hex')}`
  return parsed
}

async function main() {
  const { data: sweep, error } = await supabase.from('gateway_sweeps').select('*').eq('id', SWEEP_ID).single()
  if (error) throw error
  if (!sweep.attestation) throw new Error('Sweep has no attestation to reconstruct from')

  const spec = specFromAttestation(sweep.attestation)
  const burnIntent = {
    maxBlockHeight: maxUint256.toString(),
    maxFee: parseUnits('2.01', 6).toString(),
    spec,
  }
  const typedData = {
    domain: { name: 'GatewayWallet', version: '1' },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
      ],
      TransferSpec: [
        { name: 'version', type: 'uint32' },
        { name: 'sourceDomain', type: 'uint32' },
        { name: 'destinationDomain', type: 'uint32' },
        { name: 'sourceContract', type: 'bytes32' },
        { name: 'destinationContract', type: 'bytes32' },
        { name: 'sourceToken', type: 'bytes32' },
        { name: 'destinationToken', type: 'bytes32' },
        { name: 'sourceDepositor', type: 'bytes32' },
        { name: 'destinationRecipient', type: 'bytes32' },
        { name: 'sourceSigner', type: 'bytes32' },
        { name: 'destinationCaller', type: 'bytes32' },
        { name: 'value', type: 'uint256' },
        { name: 'salt', type: 'bytes32' },
        { name: 'hookData', type: 'bytes' },
      ],
      BurnIntent: [
        { name: 'maxBlockHeight', type: 'uint256' },
        { name: 'maxFee', type: 'uint256' },
        { name: 'spec', type: 'TransferSpec' },
      ],
    },
    primaryType: 'BurnIntent',
    message: burnIntent,
  }

  console.log('Signing reconstructed burn intent...')
  const signRes = await fetch('https://api.circle.com/v1/w3s/developer/sign/typedData', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY_MAINNET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletId: process.env.CIRCLE_WALLET_ID_MAINNET,
      entitySecretCiphertext: await ciphertext(),
      data: JSON.stringify(typedData),
    }),
    signal: timeout(30_000),
  })
  const signData = await signRes.json()
  if (!signRes.ok || !signData.data?.signature) throw new Error(`sign failed: ${JSON.stringify(signData)}`)

  console.log('Requesting fresh Gateway attestation...')
  const transferRes = await fetch('https://gateway-api.circle.com/v1/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-ARC-PRIVATE-MAINNET-ENABLED': 'true' },
    body: JSON.stringify([{ burnIntent, signature: signData.data.signature }]),
    signal: timeout(30_000),
  })
  const transfer = await transferRes.json()
  console.log('Gateway transfer status:', transferRes.status, transfer.message || '')
  if (!transfer.attestation || !transfer.signature) {
    console.log(JSON.stringify(transfer, null, 2))
    return
  }
  await supabase
    .from('gateway_sweeps')
    .update({ attestation: transfer.attestation, gateway_signature: transfer.signature, updated_at: new Date().toISOString() })
    .eq('id', sweep.id)

  console.log('Submitting gatewayMint at LOW fee...')
  const mintRes = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY_MAINNET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      walletId: process.env.CIRCLE_WALLET_ID_MAINNET,
      contractAddress: '0x2222222d7164433c4C09B0b0D809a9b52C04C205',
      abiFunctionSignature: 'gatewayMint(bytes,bytes)',
      abiParameters: [transfer.attestation, transfer.signature],
      feeLevel: 'LOW',
      entitySecretCiphertext: await ciphertext(),
    }),
    signal: timeout(30_000),
  })
  const mint = await mintRes.json()
  console.log('Mint response:', JSON.stringify({ status: mintRes.status, body: mint }, null, 2))
  if (mintRes.ok && mint.data?.id) {
    await supabase
      .from('gateway_sweeps')
      .update({ status: 'submitted', mint_transaction_id: mint.data.id, updated_at: new Date().toISOString() })
      .eq('id', sweep.id)
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
