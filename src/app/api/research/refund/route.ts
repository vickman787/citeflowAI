import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { z } from 'zod'
import { reconcileRefund, type Refund } from '@/lib/payments/refunds'

export async function GET(request: NextRequest) {
  const sessionId = z.string().uuid().safeParse(new URL(request.url).searchParams.get('sessionId'))
  if (!sessionId.success) return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const { data: session } = await db.from('research_sessions').select('id')
    .eq('id', sessionId.data).eq('user_id', user.id).single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  const { data: initialRefund, error } = await db.from('pending_refunds')
    .select('*')
    .eq('session_id', session.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load refund' }, { status: 500 })
  let refund = initialRefund
  if (refund?.status === 'submitted' && refund.paid_transaction_id) {
    try {
      await reconcileRefund(refund as Refund)
      const refreshed = await db.from('pending_refunds')
        .select('*').eq('session_id', session.id).maybeSingle()
      if (!refreshed.error) refund = refreshed.data
    } catch (reconcileError) {
      console.warn('Refund reconciliation deferred', reconcileError)
    }
  }
  return NextResponse.json({ refund: refund ? {
    amount_usdc: refund.amount_usdc,
    status: refund.status,
    paid_transaction_id: refund.paid_transaction_id,
    transaction_hash: refund.transaction_hash,
  } : null })
}
