import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const network = new URL(request.url).searchParams.get('network')
  if (network !== 'arc-testnet' && network !== 'arc-mainnet') {
    return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
  }
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await db.from('research_sessions')
    .select('id, funding_challenge_id, status, query, budget_usdc')
    .eq('user_id', user.id).eq('network', network)
    .in('status', ['awaiting_funding', 'funding_pending', 'active', 'payment_review', 'refund_pending'])
    .not('funding_challenge_id', 'is', null)
    .order('created_at', { ascending: false }).limit(1)
  if (error) return NextResponse.json({ error: 'Could not check pending payment' }, { status: 500 })
  const session = data?.[0]
  return NextResponse.json({ attempt: session ? {
    sessionId: session.id,
    challengeId: session.funding_challenge_id,
    query: session.query,
    budget: String(session.budget_usdc),
    status: session.status,
  } : null })
}
