import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { CREATOR_SHARE } from '@/lib/stats'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const network = searchParams.get('network') || 'arc-testnet'
    const isMainnet = network === 'arc-mainnet'

    const supabase = await createClient()

    if (isMainnet) {
      try {
        const [
          sessionRes,
          authRes,
          payRes,
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
            .from('payment_authorizations')
            .select(`
              authorization_id,
              amount_usdc,
              created_at,
              sources (
                title
              )
            `, { count: 'exact' })
            .eq('status', 'settled')
            .eq('network', 'arc-mainnet')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('sources')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'extracted')
            .eq('network', 'arc-mainnet'),
        ])

        const answersServed = sessionRes.count || 0
        const settledAmounts = authRes.data || []
        const recentPayments = payRes.data || []
        const totalPaidCitations = payRes.count || 0
        const registeredSources = sourceRes.count || 0

        const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
        const paidToCreators = totalSettled * CREATOR_SHARE

        return NextResponse.json({
          network: 'arc-mainnet',
          answersServed,
          paidToCreators,
          avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
          registeredSources,
          recentPayments,
          totalPaidCitations,
        })
      } catch (err) {
        return NextResponse.json({
          network: 'arc-mainnet',
          answersServed: 0,
          paidToCreators: 0,
          avgAnswerCost: 0,
          registeredSources: 0,
          recentPayments: [],
          totalPaidCitations: 0,
        })
      }
    }

    // Arc Testnet stats
    const [
      sessionRes,
      authRes,
      payRes,
      sourceRes
    ] = await Promise.all([
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
        .from('payment_authorizations')
        .select(`
          authorization_id,
          amount_usdc,
          created_at,
          sources (
            title
          )
        `, { count: 'exact' })
        .eq('status', 'settled')
        .eq('network', 'arc-testnet')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('sources')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'extracted')
        .eq('network', 'arc-testnet'),
    ])

    const answersServed = sessionRes.count || 0
    const settledAmounts = authRes.data || []
    const recentPayments = payRes.data || []
    const totalPaidCitations = payRes.count || 0
    const registeredSources = sourceRes.count || 0

    const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
    const paidToCreators = totalSettled * CREATOR_SHARE

    return NextResponse.json({
      network: 'arc-testnet',
      answersServed,
      paidToCreators,
      avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
      registeredSources,
      recentPayments,
      totalPaidCitations,
    })

  } catch (error: any) {
    console.error('Stats fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch network stats' }, { status: 500 })
  }
}
