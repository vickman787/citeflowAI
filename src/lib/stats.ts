import { createClient } from '@/utils/supabase/server'

export const CREATOR_SHARE = 0.8 // 20% platform fee
export const MAINNET_EPOCH = '2026-09-19T00:00:00Z'

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

  // Registered sources is shared across networks
  const { count: registeredSources } = await supabase
    .from('sources')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'extracted')

  if (isMainnet) {
    try {
      let answersServed = 0
      let settledAmounts: any[] = []

      const sessionRes = await supabase
        .from('research_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .eq('network', 'arc-mainnet')

      if (!sessionRes.error) {
        answersServed = sessionRes.count || 0
        const authRes = await supabase
          .from('payment_authorizations')
          .select('amount_usdc')
          .eq('status', 'settled')
          .eq('network', 'arc-mainnet')
        settledAmounts = authRes.data || []
      } else {
        // Fallback to epoch-based date filter
        const [sess, auth] = await Promise.all([
          supabase
            .from('research_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed')
            .gte('created_at', MAINNET_EPOCH),
          supabase
            .from('payment_authorizations')
            .select('amount_usdc')
            .eq('status', 'settled')
            .gte('created_at', MAINNET_EPOCH),
        ])
        answersServed = sess.count || 0
        settledAmounts = auth.data || []
      }

      const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
      const paidToCreators = totalSettled * CREATOR_SHARE

      return {
        answersServed: answersServed || 0,
        paidToCreators,
        avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
        registeredSources: registeredSources || 0,
      }
    } catch {
      return {
        answersServed: 0,
        paidToCreators: 0,
        avgAnswerCost: 0,
        registeredSources: registeredSources || 0,
      }
    }
  }

  // Testnet
  let answersServed = 0
  let settledAmounts: any[] = []

  const sessionRes = await supabase
    .from('research_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .eq('network', 'arc-testnet')

  if (!sessionRes.error) {
    answersServed = sessionRes.count || 0
    const authRes = await supabase
      .from('payment_authorizations')
      .select('amount_usdc')
      .eq('status', 'settled')
      .eq('network', 'arc-testnet')
    settledAmounts = authRes.data || []
  } else {
    const [sess, auth] = await Promise.all([
      supabase
        .from('research_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .lt('created_at', MAINNET_EPOCH),
      supabase
        .from('payment_authorizations')
        .select('amount_usdc')
        .eq('status', 'settled')
        .lt('created_at', MAINNET_EPOCH),
    ])
    answersServed = sess.count || 0
    settledAmounts = auth.data || []
  }

  const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
  const paidToCreators = totalSettled * CREATOR_SHARE

  return {
    answersServed: answersServed || 0,
    paidToCreators,
    avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
    registeredSources: registeredSources || 0,
  }
}
