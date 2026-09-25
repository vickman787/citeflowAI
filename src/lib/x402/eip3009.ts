import { verifyTypedData, type Hex, type Address } from 'viem'
import crypto from 'crypto'
import { generateDynamicCiphertext } from '@/lib/payments/circle-api'

export const ARC_MAINNET_USDC = '0x3600000000000000000000000000000000000000' as const
export const ARC_TESTNET_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const

export const ARC_MAINNET_CHAIN_ID = 5042
export const ARC_TESTNET_CHAIN_ID = 5042002

export const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

export interface Eip3009Authorization {
  from: string
  to: string
  value: string | number
  validAfter: string | number
  validBefore: string | number
  nonce: string
  v?: number | string
  r?: string
  s?: string
}

export interface Eip3009PaymentPayload {
  authorization: Eip3009Authorization
  signature?: string
}

export function extractSignatureParts(
  auth: Eip3009Authorization,
  rawSignature?: string
): {
  signature: Hex
  r: Hex
  s: Hex
  v: number
} {
  if (rawSignature && rawSignature.startsWith('0x') && rawSignature.length >= 132) {
    const r = `0x${rawSignature.slice(2, 66)}` as Hex
    const s = `0x${rawSignature.slice(66, 130)}` as Hex
    let v = parseInt(rawSignature.slice(130, 132), 16)
    if (v < 27) v += 27
    return { signature: rawSignature as Hex, r, s, v }
  }

  if (auth.r && auth.s && auth.v !== undefined) {
    const rRaw = auth.r.startsWith('0x') ? auth.r.slice(2) : auth.r
    const sRaw = auth.s.startsWith('0x') ? auth.s.slice(2) : auth.s
    const r = `0x${rRaw.padStart(64, '0')}` as Hex
    const s = `0x${sRaw.padStart(64, '0')}` as Hex
    let v = typeof auth.v === 'string' ? parseInt(auth.v, 16) : Number(auth.v)
    if (v < 27) v += 27
    const vHex = v.toString(16).padStart(2, '0')
    const signature = `0x${rRaw.padStart(64, '0')}${sRaw.padStart(64, '0')}${vHex}` as Hex
    return { signature, r, s, v }
  }

  throw new Error('Missing signature parameters for EIP 3009 authorization')
}

export async function verifyEip3009Payment(
  payload: Eip3009PaymentPayload,
  network: 'eip155:5042' | 'eip155:5042002' | string,
  expectedPayTo: string,
  requiredAmountAtomic: string = '1000000'
): Promise<{
  valid: boolean
  payer: string
  error?: string
}> {
  try {
    const auth = payload.authorization
    if (!auth) {
      return { valid: false, payer: '', error: 'Missing authorization object in payment payload' }
    }

    const isMainnet = network === 'eip155:5042' || network === 'arc-mainnet'
    const chainId = isMainnet ? ARC_MAINNET_CHAIN_ID : ARC_TESTNET_CHAIN_ID
    const usdcAddress = (isMainnet ? ARC_MAINNET_USDC : ARC_TESTNET_USDC) as Address

    if (!auth.from || !auth.to || !auth.value || !auth.nonce) {
      return { valid: false, payer: '', error: 'Incomplete authorization fields' }
    }

    if (auth.to.toLowerCase() !== expectedPayTo.toLowerCase()) {
      return {
        valid: false,
        payer: auth.from,
        error: `Payment recipient mismatch: expected ${expectedPayTo}, received ${auth.to}`,
      }
    }

    const authValue = BigInt(auth.value.toString())
    const requiredValue = BigInt(requiredAmountAtomic)
    if (authValue < requiredValue) {
      return {
        valid: false,
        payer: auth.from,
        error: `Insufficient payment amount: required ${requiredAmountAtomic}, authorized ${auth.value}`,
      }
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const validBefore = Number(auth.validBefore)
    const validAfter = Number(auth.validAfter)

    if (validBefore > 0 && nowSeconds > validBefore) {
      return {
        valid: false,
        payer: auth.from,
        error: 'Authorization has expired',
      }
    }

    if (validAfter > 0 && nowSeconds < validAfter) {
      return {
        valid: false,
        payer: auth.from,
        error: 'Authorization not yet active',
      }
    }

    const { signature } = extractSignatureParts(auth, payload.signature)

    const domain = {
      name: 'USDC',
      version: '2',
      chainId,
      verifyingContract: usdcAddress,
    } as const

    const message = {
      from: auth.from as Address,
      to: auth.to as Address,
      value: BigInt(auth.value.toString()),
      validAfter: BigInt(auth.validAfter.toString()),
      validBefore: BigInt(auth.validBefore.toString()),
      nonce: (auth.nonce.startsWith('0x') ? auth.nonce : `0x${auth.nonce}`) as Hex,
    }

    const isValid = await verifyTypedData({
      address: auth.from as Address,
      domain,
      types: EIP3009_TYPES,
      primaryType: 'TransferWithAuthorization',
      message,
      signature,
    })

    if (!isValid) {
      return {
        valid: false,
        payer: auth.from,
        error: 'Cryptographic signature verification failed for EIP 3009 authorization',
      }
    }

    return {
      valid: true,
      payer: auth.from,
    }
  } catch (err: any) {
    return {
      valid: false,
      payer: payload.authorization?.from || '',
      error: err.message || 'Signature verification error',
    }
  }
}

export async function settleEip3009Payment(
  payload: Eip3009PaymentPayload,
  network: 'eip155:5042' | 'eip155:5042002' | string
): Promise<{
  success: boolean
  txHash?: string
  error?: string
}> {
  try {
    const isMainnet = network === 'eip155:5042' || network === 'arc-mainnet'
    const apiKey = isMainnet
      ? (process.env.CIRCLE_API_KEY_MAINNET || process.env.CIRCLE_API_KEY)
      : process.env.CIRCLE_API_KEY
    const walletId = isMainnet
      ? (process.env.CIRCLE_WALLET_ID_MAINNET || process.env.CIRCLE_WALLET_ID)
      : process.env.CIRCLE_WALLET_ID
    const rawSecret = isMainnet
      ? (process.env.RAW_ENTITY_SECRET_MAINNET || process.env.RAW_ENTITY_SECRET)
      : process.env.RAW_ENTITY_SECRET

    if (!apiKey || !walletId || !rawSecret) {
      return { success: false, error: 'Circle configuration missing for on chain settlement' }
    }

    const auth = payload.authorization
    const { r, s, v } = extractSignatureParts(auth, payload.signature)
    const usdcAddress = isMainnet ? ARC_MAINNET_USDC : ARC_TESTNET_USDC

    const ciphertext = await generateDynamicCiphertext(rawSecret, apiKey)

    const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        walletId,
        contractAddress: usdcAddress,
        abiFunctionSignature: 'transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)',
        abiParameters: [
          auth.from,
          auth.to,
          auth.value.toString(),
          auth.validAfter.toString(),
          auth.validBefore.toString(),
          auth.nonce.startsWith('0x') ? auth.nonce : `0x${auth.nonce}`,
          v,
          r,
          s,
        ],
        feeLevel: 'MEDIUM',
        entitySecretCiphertext: ciphertext,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return {
        success: false,
        error: `Circle contractExecution failed: ${data.message || JSON.stringify(data)}`,
      }
    }

    const txId = data.data?.id || data.data?.txHash || 'settled'
    return {
      success: true,
      txHash: txId,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'On chain settlement failed',
    }
  }
}
