import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { CREATOR_SHARE, MAINNET_EPOCH } from '@/lib/stats'

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
      try {
        let answersServed = 0
        let settledAmounts: any[] = []
        let recentPayments: any[] = []
        let totalPaidCitations = 0

        const sessionRes = await supabase
          .from('research_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .eq('network', 'arc-mainnet')

        if (!sessionRes.error) {
          answersServed = sessionRes.count || 0
          const [authRes, payRes] = await Promise.all([
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
              .limit(5)
          ])
          settledAmounts = authRes.data || []
          recentPayments = payRes.data || []
          totalPaidCitations = payRes.count || 0
        } else {
          // Fallback to MAINNET_EPOCH partitioning
          const [sess, auth, pay] = await Promise.all([
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
              .gte('created_at', MAINNET_EPOCH)
              .order('created_at', { ascending: false })
              .limit(5)
          ])
          answersServed = sess.count || 0
          settledAmounts = auth.data || []
          recentPayments = pay.data || []
          totalPaidCitations = pay.count || 0
        }

        const totalSettled = (settledAmounts || []).reduce((acc, r) => acc + parseFloat(r.amount_usdc), 0)
        const paidToCreators = totalSettled * CREATOR_SHARE

        return NextResponse.json({
          network: 'arc-mainnet',
          answersServed: answersServed || 0,
          paidToCreators: paidToCreators || 0,
          avgAnswerCost: answersServed ? totalSettled / answersServed : 0,
          registeredSources: registeredSources || 0,
          recentPayments: recentPayments || [],
          totalPaidCitations: totalPaidCitations || 0,
        })
      } catch (err) {
        return NextResponse.json({
          network: 'arc-mainnet',
          answersServed: 0,
          paidToCreators: 0,
          avgAnswerCost: 0,
          registeredSources: registeredSources || 0,
          recentPayments: [],
          totalPaidCitations: 0,
        })
      }
    }

    // Arc Testnet stats
    let answersServed = 0
    let settledAmounts: any[] = []
    let recentPayments: any[] = []
    let totalPaidCitations = 0

    const sessionRes = await supabase
      .from('research_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .eq('network', 'arc-testnet')

    if (!sessionRes.error) {
      answersServed = sessionRes.count || 0
      const [authRes, payRes] = await Promise.all([
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
          .limit(5)
      ])
      settledAmounts = authRes.data || []
      recentPayments = payRes.data || []
      totalPaidCitations = payRes.count || 0
    } else {
      const [sess, auth, pay] = await Promise.all([
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
          .lt('created_at', MAINNET_EPOCH)
          .order('created_at', { ascending: false })
          .limit(5)
      ])
      answersServed = sess.count || 0
      settledAmounts = auth.data || []
      recentPayments = pay.data || []
      totalPaidCitations = pay.count || 0
    }

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
