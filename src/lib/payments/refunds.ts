import crypto from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { executeGatewayTransfer, getCircleTransaction } from './circle-api'
import type { NetworkId } from '@/lib/network'

type Refund = { id: string; session_id: string; payer_address: string; amount_usdc: string; network: NetworkId; status: string; attempts: number; paid_transaction_id?: string }

export function usdcAmount(amount: number | string): string {
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) throw new Error('Invalid USDC amount')
  const atomic = Math.round(value * 1_000_000)
  return `${Math.floor(atomic / 1_000_000)}.${String(atomic % 1_000_000).padStart(6, '0')}`
}

export async function queueRefund(sessionId: string, payer: string, amount: number, network: NetworkId): Promise<Refund> {
  if (!/^0x[0-9a-f]{40}$/i.test(payer)) throw new Error('Missing verified payer address for refund')
  const db = createAdminClient()
  const { error } = await db.from('pending_refunds').upsert({
    session_id: sessionId, payer_address: payer.toLowerCase(), amount_usdc: usdcAmount(amount), network, status: 'pending',
  }, { onConflict: 'session_id', ignoreDuplicates: true })
  if (error) throw new Error(`Could not queue refund: ${error.message}`)
  const { data, error: readError } = await db.from('pending_refunds').select('*').eq('session_id', sessionId).single()
  if (readError || !data) throw new Error('Refund was not recorded')
  if (data.payer_address.toLowerCase() !== payer.toLowerCase() || data.network !== network) {
    throw new Error('Existing refund recipient/network differs; manual review required')
  }
  return data as Refund
}

export async function claimRefunds(limit = 25): Promise<Refund[]> {
  const { data, error } = await createAdminClient().rpc('claim_pending_refunds', { p_limit: limit })
  if (error) throw new Error(`Could not claim refunds: ${error.message}`)
  return (data || []) as Refund[]
}

export async function claimRefund(id: string): Promise<Refund | null> {
  const { data, error } = await createAdminClient().rpc('claim_refund', { p_id: id })
  if (error) throw new Error(`Could not claim refund: ${error.message}`)
  return ((data || [])[0] as Refund) || null
}

export async function processClaimedRefund(refund: Refund): Promise<'paid' | 'submitted' | 'failed'> {
  const db = createAdminClient()
  const digest = crypto.createHash('sha256').update(`refund:${refund.id}`).digest('hex')
  const key = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`
  // Only use the on-chain Circle transfer rail for refunds. Gateway burn/mint
  // needs persisted attestations before it can be safely retried.
  let transactionId: string
  try {
    transactionId = await executeGatewayTransfer(refund.payer_address, usdcAmount(refund.amount_usdc), refund.network, key)
  } catch (error: any) {
    // Retrying the same persisted refund uses the same Circle idempotency key.
    await db.from('pending_refunds').update({ status: refund.attempts >= 5 ? 'failed' : 'pending', last_error: error.message }).eq('id', refund.id)
    return 'failed'
  }
  const { error: recordError } = await db.from('pending_refunds')
    .update({ status: 'submitted', paid_transaction_id: transactionId, last_error: null }).eq('id', refund.id)
  if (recordError) throw new Error(`Refund submitted (${transactionId}) but ledger update failed: ${recordError.message}`)
  return reconcileRefund({ ...refund, status: 'submitted', paid_transaction_id: transactionId })
}

export async function reconcileRefund(refund: Refund): Promise<'paid' | 'submitted' | 'failed'> {
  if (!refund.paid_transaction_id) return 'failed'
  const db = createAdminClient()
  const tx = await getCircleTransaction(refund.paid_transaction_id, refund.network)
  if (tx.state === 'COMPLETE' && tx.txHash) {
    await db.from('pending_refunds').update({ status: 'paid', transaction_hash: tx.txHash, last_error: null }).eq('id', refund.id)
    return 'paid'
  }
  if (['FAILED', 'DENIED', 'CANCELLED'].includes(tx.state)) {
    await db.from('pending_refunds').update({ status: 'failed', last_error: tx.error || tx.state }).eq('id', refund.id)
    return 'failed'
  }
  return 'submitted'
}
