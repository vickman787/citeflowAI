import crypto from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { executeGatewayTransfer, getCircleTransaction } from './circle-api'
import type { NetworkId } from '@/lib/network'

export type LicenseResult = { status: 'confirmed' | 'submitted'; transactionId: string; txHash?: string }

function payoutIdempotencyKey(authorizationId: string): string {
  const digest = crypto.createHash('sha256').update(`license:${authorizationId}`).digest('hex')
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

function isTemporaryFloatShortfall(error: any): boolean {
  const text = typeof error?.message === 'string' ? error.message : JSON.stringify(error || '')
  return /insufficient token balance|asset amount owned by the wallet is insufficient/i.test(text)
}

async function submitPayout(authorizationId: string, recipient: string, amount: string, network: NetworkId): Promise<string> {
  const db = createAdminClient()
  // Replays use the same Circle idempotency key and the recipient/amount saved
  // before the first external call. Never recalculate these from a mutable profile.
  const transactionId = await executeGatewayTransfer(recipient, amount, network, payoutIdempotencyKey(authorizationId))
  const { error: recordError } = await db.from('payment_settlements')
    .update({ gateway_settlement_id: transactionId, status: 'submitted' })
    .eq('authorization_id', authorizationId).eq('status', 'processing')
  if (recordError) throw new Error(`Payout submitted (${transactionId}) but ledger update failed: ${recordError.message}`)
  await db.from('payment_authorizations').update({ status: 'submitted' }).eq('authorization_id', authorizationId)
  return transactionId
}

export async function retryProcessingPayouts(): Promise<number> {
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data, error } = await db.from('payment_settlements')
    .select('authorization_id, recipient_wallet, payout_amount_usdc, network')
    .eq('status', 'processing').lt('created_at', cutoff).limit(25)
  if (error) throw new Error(`Could not load processing payouts: ${error.message}`)
  let retried = 0
  for (const row of data || []) {
    if (!row.recipient_wallet || !row.payout_amount_usdc || !['arc-testnet', 'arc-mainnet'].includes(row.network)) {
      console.error('Payout requires manual recovery: missing saved details', row.authorization_id)
      continue
    }
    try {
      await submitPayout(row.authorization_id, row.recipient_wallet, Number(row.payout_amount_usdc).toFixed(6), row.network as NetworkId)
      retried++
    } catch (error) {
      console.error('Payout retry failed', row.authorization_id, error)
    }
  }
  return retried
}

export async function settleCreatorLicense(authorizationId: string, sourceId: string, network: NetworkId): Promise<LicenseResult> {
  const db = createAdminClient()
  // The RPC checks source, price, session network and recipient, then atomically
  // claims exactly one pending authorization under a row lock.
  const { data: claim, error: claimError } = await db.rpc('claim_license_authorization', {
    p_authorization_id: authorizationId, p_source_id: sourceId, p_network: network,
  }).single()
  if (claimError || !claim) throw new Error(`Payment authorization unavailable: ${claimError?.message || 'already used'}`)
  const claimed = claim as { amount_usdc: string; recipient_wallet: string }
  const cents = BigInt(Math.round(Number(claimed.amount_usdc) * 1_000_000))
  const creatorPayout = cents * BigInt(80) / BigInt(100)
  const amount = `${creatorPayout / BigInt(1_000_000)}.${(creatorPayout % BigInt(1_000_000)).toString().padStart(6, '0')}`
  const { error: ledgerError } = await db.from('payment_settlements').insert({
    authorization_id: authorizationId, status: 'processing', recipient_wallet: claimed.recipient_wallet,
    payout_amount_usdc: amount, network,
  })
  if (ledgerError) throw new Error(`Could not create payout ledger: ${ledgerError.message}`)

  // Leave the claim in processing if Circle's response is uncertain. A fresh
  // transfer could pay twice; reconciliation must inspect this authorization.
  let transactionId: string
  try {
    transactionId = await submitPayout(authorizationId, claimed.recipient_wallet, amount, network)
  } catch (error: any) {
    if (network === 'arc-mainnet' && isTemporaryFloatShortfall(error)) {
      // Circle Gateway payments can land in the treasury Gateway balance before
      // they are available as on-chain wallet float. Keep the claimed payout in
      // processing so the reconciliation job can retry with the same saved
      // recipient and amount after Gateway sweep/finality.
      return { status: 'submitted', transactionId: 'pending_gateway_sweep' }
    }
    throw error
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    let tx
    try { tx = await getCircleTransaction(transactionId, network) }
    catch (error: any) {
      console.warn(`Payout ${transactionId} lookup unavailable; leaving submitted:`, error.message)
      return { status: 'submitted', transactionId }
    }
    if (tx.state === 'COMPLETE' && tx.txHash) {
      await db.from('payment_settlements').update({ status: 'confirmed', transaction_hash: tx.txHash })
        .eq('authorization_id', authorizationId)
      await db.from('payment_authorizations').update({ status: 'settled' }).eq('authorization_id', authorizationId)
      return { status: 'confirmed', transactionId, txHash: tx.txHash }
    }
    if (['FAILED', 'DENIED', 'CANCELLED'].includes(tx.state)) {
      await db.from('payment_settlements').update({ status: 'failed' }).eq('authorization_id', authorizationId)
      await db.from('payment_authorizations').update({ status: 'failed' }).eq('authorization_id', authorizationId)
      throw new Error(`Circle payout ${tx.state}: ${tx.error || transactionId}`)
    }
    await new Promise(resolve => setTimeout(resolve, 2500))
  }
  return { status: 'submitted', transactionId }
}
