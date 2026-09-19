import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { CREATOR_SHARE } from '@/lib/stats'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const network = searchParams.get('network') || 'arc-testnet'
    const isMainnet = network === 'arc-mainnet'

    const supabase = await createClient()

    // Query registered sources (shared knowledge base available to both networks)
    const { count: registeredSources } = await supabase
      .from('sources')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'extracted')

    if (isMainnet) {
      // Arc Mainnet stats:
      // Until transactions are executed on Arc Mainnet, mainnet ledger starts fresh
      try {
        const [
          { count: answersServed, error: sessionErr },
          { data: settledAmounts, error: authErr },
          { data: recentPayments, count: totalPaidCitations, error: payErr }
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
            .limit(3)
        ])

        if (sessionErr || authErr || payErr) {
          // Column 'network' does not exist yet; mainnet starts at 0
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

        const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
        const paidToCreators = totalSettled * CREATOR_SHARE

        return NextResponse.json({
          network: 'arc-mainnet',
          answersServed: answersServed || 0,
          paidToCreators: paidToCreators || 0,
          avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
          registeredSources: 0,
          recentPayments: recentPayments || [],
          totalPaidCitations: totalPaidCitations || 0,
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

    // Arc Testnet stats:
    // Retains all 113 existing testnet citations and 127 research sessions
    const [
      { count: answersServed },
      { data: settledAmounts },
      { data: recentPayments, count: totalPaidCitations }
    ] = await Promise.all([
      supabase
        .from('research_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabase
        .from('payment_authorizations')
        .select('amount_usdc')
        .eq('status', 'settled'),
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
        .order('created_at', { ascending: false })
        .limit(3)
    ])

    const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
    const paidToCreators = totalSettled * CREATOR_SHARE

    return NextResponse.json({
      network: 'arc-testnet',
      answersServed: answersServed || 0,
      paidToCreators: paidToCreators || 0,
      avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
      registeredSources: registeredSources || 0,
      recentPayments: recentPayments || [],
      totalPaidCitations: totalPaidCitations || 0,
    })

  } catch (error: any) {
    console.error('Stats fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch network stats' }, { status: 500 })
  }
}
