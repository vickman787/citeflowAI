import crypto from 'crypto'
import dns from 'dns'
import { getCircleCredentials } from '@/lib/circle-credentials'
import { isArcUsdcToken } from './usdc-token'
import type { NetworkId } from '@/lib/network'

dns.setDefaultResultOrder('ipv4first')

export async function generateDynamicCiphertext(rawEntitySecretHex: string, customApiKey?: string): Promise<string> {
  const apiKey = customApiKey || process.env.CIRCLE_API_KEY
  if (!apiKey) throw new Error('Circle API key missing')

  const response = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })
  
  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Failed to fetch Circle Public Key: ${err.message}`)
  }

  const data = await response.json()
  const publicKeyPem = data.data.publicKey
  
  const encryptedData = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(rawEntitySecretHex, 'hex') // Must be 32 bytes!
  )

  return encryptedData.toString('base64')
}

// Resolve USDC token ID by querying the treasury wallet balance.
// Circle requires a tokenId for ERC-20 transfers. We look it up live
// rather than hardcode it, so any network is supported automatically.
async function resolveUsdcTokenId(apiKey: string, walletId: string, network: NetworkId): Promise<string> {
  // Use the standard w3s wallets balance endpoint
  const res = await fetch(`https://api.circle.com/v1/w3s/wallets/${walletId}/balances`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Failed to fetch treasury wallet balances: ${data.message || JSON.stringify(data)}`)

  const balances: any[] = data.data?.tokenBalances ?? []
  const usdc = balances.find((b: any) => isArcUsdcToken(b.token, network) && !b.token?.isNative)
    || balances.find((b: any) => isArcUsdcToken(b.token, network))

  if (!usdc?.token?.id) {
    throw new Error(
      'No USDC token found in the treasury wallet. Please fund the treasury wallet with USDC before issuing transfers.'
    )
  }

  return usdc.token.id
}

export async function executeGatewayTransfer(
  destinationAddress: string,
  amountUsdc: string,
  network: NetworkId,
  idempotencyKey?: string
): Promise<string> {
  if (network !== 'arc-mainnet' && network !== 'arc-testnet') throw new Error('Invalid transfer network')
  const isMainnet = network === 'arc-mainnet'
  const { apiKey, walletId, rawEntitySecret: rawSecret } = getCircleCredentials(
    isMainnet ? 'arc-mainnet' : 'arc-testnet'
  )

  // Resolve the USDC token ID live from the treasury wallet on either network
  const tokenId = await resolveUsdcTokenId(apiKey, walletId, isMainnet ? 'arc-mainnet' : 'arc-testnet')

  // Stable across retries: if an attempt is actually submitted but the response
  // is lost, Circle deduplicates the retry instead of sending a second transfer.
  // A fresh key per attempt was causing duplicate creator payouts.
  idempotencyKey = idempotencyKey || crypto.randomUUID()

  let lastError: any = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ciphertext = await generateDynamicCiphertext(rawSecret, apiKey)
      const payload: any = {
        idempotencyKey,
        entitySecretCiphertext: ciphertext,
        amounts: [amountUsdc.toString()],
        destinationAddress: destinationAddress,
        tokenId,
        feeLevel: 'MEDIUM',
        walletId: walletId,
      }

      const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      if (!response.ok) {
        lastError = result
        if (attempt < 3 && JSON.stringify(result).toLowerCase().includes('insufficient')) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
        throw new Error(JSON.stringify(result) || 'Circle API transaction failed')
      }

      if (!result.data?.id) throw new Error('Circle accepted a transfer without returning a transaction ID')
      return result.data.id
    } catch (err: any) {
      lastError = err
      if (attempt < 3 && err.message?.toLowerCase().includes('insufficient')) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      throw err
    }
  }

  throw lastError || new Error('Circle API transfer failed after retries')
}

// Circle's create-transaction response only means submitted. A payout is paid
// only after the transaction reaches COMPLETE and has an on-chain hash.
export async function getCircleTransaction(transactionId: string, network: string): Promise<{
  state: string; txHash: string | null; error: string | null
}> {
  if (!/^[0-9a-f-]{36}$/i.test(transactionId)) throw new Error('Invalid Circle transaction ID')
  const { apiKey } = getCircleCredentials(network)
  const response = await fetch(`https://api.circle.com/v1/w3s/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok || !result.data?.transaction) {
    throw new Error(`Circle transaction lookup failed: ${result.message || response.status}`)
  }
  const tx = result.data.transaction
  return { state: tx.state, txHash: tx.txHash || null, error: tx.errorMessage || null }
}
