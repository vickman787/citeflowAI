import { createClient } from '@/utils/supabase/server'

export const CREATOR_SHARE = 0.8 // 20% platform fee
// Network isolation is now enforced by an explicit `network` column on sources,
// sessions and payment authorizations, not by a timestamp cutover.

export interface NetworkStats {
  answersServed: number
  paidToCreators: number
  avgAnswerCost: number
  registeredSources: number
}

// Live network stats from the ledger — used by the ticker and the landing page tiles
export async function getNetworkStats(networkId?: string): Promise<NetworkStats> {
  const isMainnet = networkId === 'arc-mainnet'
  const supabase = await createClient()

  if (isMainnet) {
    try {
      const [
        sessionRes,
        authRes,
        sourceRes
      ] = await Promise.all([
        supabase
          .from('research_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .eq('network', 'arc-mainnet'),
        supabase
          .from('payment_authorizations')
          .select('amount_usdc')
          .eq('status', 'settled')
          .eq('network', 'arc-mainnet'),
        supabase
          .from('sources')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'extracted')
          .eq('network', 'arc-mainnet'),
      ])

      const answersServed = sessionRes.count || 0
      const settledAmounts = authRes.data || []
      const registeredSources = sourceRes.count || 0

      const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
      const paidToCreators = totalSettled * CREATOR_SHARE

      return {
        answersServed,
        paidToCreators,
        avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
        registeredSources,
      }
    } catch {
      return {
        answersServed: 0,
        paidToCreators: 0,
        avgAnswerCost: 0,
        registeredSources: 0,
      }
    }
  }

  // Testnet
  const [sessionRes, authRes, sourceRes] = await Promise.all([
    supabase
      .from('research_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .eq('network', 'arc-testnet'),
    supabase
      .from('payment_authorizations')
      .select('amount_usdc')
      .eq('status', 'settled')
      .eq('network', 'arc-testnet'),
    supabase
      .from('sources')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'extracted')
      .eq('network', 'arc-testnet'),
  ])

  const answersServed = sessionRes.count || 0
  const settledAmounts = authRes.data || []
  const registeredSources = sourceRes.count || 0

  const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
  const paidToCreators = totalSettled * CREATOR_SHARE

  return {
    answersServed,
    paidToCreators,
    avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
    registeredSources,
  }
}
