import crypto from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import type { NetworkId } from '@/lib/network'

export async function authorizePayment(
  sessionId: string, sourceId: string, _amountUsdc: number, _recipientAddress: string,
  network: NetworkId = 'arc-testnet'
) {
  const dailyLimit = Number(process.env.DAILY_TREASURY_LIMIT_USDC || '100')
  if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) throw new Error('Invalid DAILY_TREASURY_LIMIT_USDC')
  const authorizationId = `auth_${crypto.randomBytes(12).toString('hex')}`
  const { data, error } = await createAdminClient().rpc('reserve_license_authorization', {
    p_session_id: sessionId,
    p_source_id: sourceId,
    p_network: network,
    p_authorization_id: authorizationId,
    p_daily_limit: dailyLimit,
  })
  if (error || data === null) throw new Error(`Could not reserve creator payout: ${error?.message || 'unknown error'}`)
  return { authorizationId, amount: String(data) }
}
