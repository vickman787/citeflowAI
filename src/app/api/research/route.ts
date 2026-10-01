import { NextRequest, NextResponse } from 'next/server'
import { runResearchAgent } from '@/lib/ai/research-agent'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'
import { getCircleCredentials } from '@/lib/circle-credentials'
import { z } from 'zod'
import { DEAD_FUNDING_STATES, inspectUserFunding } from '@/lib/payments/user-funding'
import type { NetworkId } from '@/lib/network'

const researchRequestSchema = z.object({
  sessionId: z.string().uuid(),
  challengeId: z.string().min(1),
  userToken: z.string().min(1),
  network: z.string().optional()
})

// The challenge ties a Circle transaction to the durable, authenticated session.
async function getChallengeTransaction(userToken: string, challengeId: string, network: NetworkId) {
  const apiKey = getCircleCredentials(network).apiKey

  const circleClient = initiateUserControlledWalletsClient({
    apiKey,
  })

  const challengeRes = await circleClient.getUserChallenge({ userToken, challengeId })
  const challenge = challengeRes.data?.challenge

  if (!challenge) throw new Error('Payment challenge not found')
  if (challenge.status === 'FAILED' || challenge.status === 'EXPIRED') return { status: challenge.status, transactionId: null }
  if (challenge.status !== 'COMPLETE') return { status: challenge.status, transactionId: null }

  const transactionId = challenge.correlationIds?.[0]
  if (!transactionId) {
    throw new Error('Payment challenge has no associated transaction')
  }

  return { status: challenge.status, transactionId }
}

export async function POST(request: NextRequest) {
  try {
    // Identify the caller from their Supabase session cookies (set by wallet-login)
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please connect your wallet first.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = researchRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { sessionId, challengeId, userToken, network: bodyNetwork } = parsed.data
    const networkHeader = request.headers.get('x-network')
    const activeNetwork = bodyNetwork || networkHeader || 'arc-testnet'
    if (!['arc-mainnet', 'arc-testnet'].includes(activeNetwork)) {
      return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
    }
    const network = activeNetwork as NetworkId
    const supabase = createAdminClient()
    const { data: session, error: sessionError } = await supabase.from('research_sessions')
      .select('id, user_id, query, budget_usdc, status, network, funding_challenge_id, funding_transaction_id, circle_user_id, payer_address')
      .eq('id', sessionId).eq('user_id', user.id).single()
    if (sessionError || !session || session.network !== network || session.funding_challenge_id !== challengeId) {
      return NextResponse.json({ error: 'Funding session not found for this wallet and network' }, { status: 404 })
    }
    if (session.status === 'completed') return NextResponse.json({ error: 'Research already completed; see history' }, { status: 409 })
    if (session.status === 'active') return NextResponse.json({ error: 'Research is already running; see history shortly' }, { status: 409 })
    if (!['awaiting_funding', 'funding_pending'].includes(session.status)) {
      return NextResponse.json({ error: `Payment attempt is ${session.status}; check refunds before trying again` }, { status: 409 })
    }

    // Verify the upfront payment with Circle before doing any work
    let transactionId: string
    let funding
    try {
      const challenge = await getChallengeTransaction(userToken, challengeId, network)
      if (challenge.status === 'FAILED' || challenge.status === 'EXPIRED') {
        await supabase.from('research_sessions').update({ status: 'failed' }).eq('id', session.id)
        return NextResponse.json({ error: `Payment challenge ${challenge.status}; no research started` }, { status: 402 })
      }
      if (!challenge.transactionId) return NextResponse.json({ status: 'awaiting_funding', sessionId: session.id,
        message: 'Payment authorization has not finished. Do not create another transfer yet.' }, { status: 202 })
      transactionId = challenge.transactionId
      if (session.funding_transaction_id && session.funding_transaction_id !== transactionId) {
        throw new Error('Challenge transaction changed; manual review required')
      }
      funding = await inspectUserFunding({ transactionId, userToken, circleUserId: session.circle_user_id,
        network, payerAddress: session.payer_address, budget: Number(session.budget_usdc) })
    } catch (verifyError: any) {
      console.error('Funding verification failed:', verifyError?.response?.data || verifyError)
      return NextResponse.json({ error: `Payment verification failed: ${verifyError.message}` }, { status: 422 })
    }
    const { error: recordError } = await supabase.from('research_sessions')
      .update({ funding_transaction_id: transactionId }).eq('id', session.id)
      .in('status', ['awaiting_funding', 'funding_pending'])
    if (recordError) return NextResponse.json({ error: 'Could not record funding transaction; contact support' }, { status: 503 })
    if (DEAD_FUNDING_STATES.includes(funding.state)) {
      await supabase.from('research_sessions').update({ status: 'failed' }).eq('id', session.id)
      return NextResponse.json({ error: `Funding transaction ${funding.state}; no research started` }, { status: 402 })
    }
    if (funding.state !== 'COMPLETE' || !funding.txHash) {
      await supabase.from('research_sessions').update({ status: 'funding_pending' }).eq('id', session.id).eq('status', 'awaiting_funding')
      return NextResponse.json({ status: 'funding_pending', sessionId: session.id,
        message: 'Payment submitted. Waiting for on-chain confirmation; do not pay again.' }, { status: 202 })
    }

    // Replay guard: each funding transaction can only fund one research session
    const { data: priorUse } = await supabase
      .from('audit_events')
      .select('id')
      .eq('event_type', 'funding_tx_used')
      .eq('details->>transactionId', transactionId)
      .limit(1)

    if (priorUse && priorUse.length > 0) {
      await supabase.from('research_sessions').update({ status: 'payment_review' }).eq('id', session.id)
      return NextResponse.json({ error: 'This payment is already linked to a research session; manual review required. Do not pay again.' }, { status: 409 })
    }

    // Refund destination is the verified payer, falling back to the profile wallet
    const refundAddress = session.payer_address
    if (!refundAddress || !/^0x[0-9a-f]{40}$/i.test(refundAddress)) {
      return NextResponse.json({ error: 'Confirmed payment has no verified refund address; contact support before retrying' }, { status: 422 })
    }

    const { data: claimed, error: claimError } = await supabase.rpc('claim_confirmed_user_research', { p_session_id: session.id })
    if (claimError || !claimed) return NextResponse.json({ error: 'Payment is already being processed; check history' }, { status: 409 })

    const { error: guardError } = await supabase.from('audit_events').insert({
      event_type: 'funding_tx_used',
      details: {
        transactionId,
        sessionId: session.id,
        userId: user.id,
        amount: Number(session.budget_usdc),
        network,
        txHash: funding.txHash
      }
    })
    if (guardError) {
      await supabase.from('research_sessions').update({ status: 'payment_review' }).eq('id', session.id)
      return NextResponse.json({ error: 'Confirmed payment needs manual review before research or refund. Do not pay again.' }, { status: 409 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const pushUpdate = (type: string, payload: any) => {
          controller.enqueue(encoder.encode(JSON.stringify({ type, payload }) + '\n'))
        }

        try {
          const result = await runResearchAgent(
            session.id,
            session.query,
            Number(session.budget_usdc),
            refundAddress,
            (msg) => pushUpdate('progress', msg),
            request.headers.get('cookie') || undefined,
            activeNetwork
          )

          // Mark successful research complete, but keep refund-only outcomes out
          // of completed history while the refund is being reconciled.
          const { error: saveError } = await supabase
            .from('research_sessions')
            .update({ status: (result as any).refunded ? 'refund_pending' : 'completed', result: result })
            .eq('id', session.id)
          if (saveError) throw new Error('Research finished but result could not be saved; contact support with the session ID')

          pushUpdate('done', { result, sessionId: session.id })
          controller.close()
        } catch (error: any) {
          await supabase.from('research_sessions').update({ status: error.message?.includes('result could not be saved') ? 'payment_review' : 'failed' }).eq('id', session.id)
          pushUpdate('error', error.message)
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Research API Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
