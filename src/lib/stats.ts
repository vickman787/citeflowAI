import { createClient } from '@/utils/supabase/server'

export const CREATOR_SHARE = 0.8 // 20% platform fee

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
        { count: answersServed, error: sessionErr },
        { data: settledAmounts, error: authErr }
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
      ])

      if (sessionErr || authErr) {
        return {
          answersServed: 0,
          paidToCreators: 0,
          avgAnswerCost: 0,
          registeredSources: 0,
        }
      }

      const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
      const paidToCreators = totalSettled * CREATOR_SHARE

      return {
        answersServed: answersServed || 0,
        paidToCreators,
        avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
        registeredSources: 0,
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

  const [{ count: answersServed }, { data: settledAmounts }, { count: registeredSources }] = await Promise.all([
    supabase.from('research_sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('payment_authorizations').select('amount_usdc').eq('status', 'settled'),
    supabase.from('sources').select('*', { count: 'exact', head: true }).eq('status', 'extracted'),
  ])

  const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
  const paidToCreators = totalSettled * CREATOR_SHARE

  return {
    answersServed: answersServed || 0,
    paidToCreators,
    avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
    registeredSources: registeredSources || 0,
  }
}
