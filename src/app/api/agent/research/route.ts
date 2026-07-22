import { NextRequest, NextResponse } from 'next/server'
import { getX402Server } from '@/lib/x402/server'
import { buildRequestContext } from '@/lib/x402/next-adapter'
import { createAdminClient } from '@/utils/supabase/admin'
import { runResearchAgent } from '@/lib/ai/research-agent'

// Agent-payable research endpoint. Any x402 client — human or autonomous —
// can pay $1.00 in USDC via a gasless signed authorization (no Circle
// wallet UI, no PIN, no browser session) and get a grounded, cited answer,
// with any unspent portion refunded to the paying wallet.
//
// This is deliberately separate from /api/research, which is untouched and
// keeps serving the human flow (Circle wallet-UI PIN payment + Supabase
// session). The two payment rails don't share funds or identity:
//
//   - /api/research pays into the treasury via a Circle Developer-Controlled
//     Wallet transfer, verified by inspecting that transaction directly.
//   - This route pays via Circle Gateway's batched x402 settlement, which
//     lands on-chain later (in a periodic batch), not immediately.
//
// Both refund unspent budget through the same executeGatewayTransfer
// mechanism (Circle Developer-Controlled Wallets), which sends from the
// treasury's own on-chain balance — a separate pool from whatever this
// specific x402 payment settles into. On testnet that pool has ample slack
// from prior payments, so refunds succeed in practice; this is a real
// architectural gap worth closing before relying on this in production,
// since it isn't guaranteed the treasury will always have settled balance
// on hand the instant an agent-paid session needs to refund.
export async function GET(request: NextRequest) {
  const server = await getX402Server()
  const context = await buildRequestContext(request, '/api/agent/research')
  const result = await server.processHTTPRequest(context)

  if (result.type === 'payment-error') {
    return NextResponse.json(result.response.body ?? {}, {
      status: result.response.status,
      headers: result.response.headers,
    })
  }

  if (result.type === 'no-payment-required') {
    return NextResponse.json({ error: 'Route is missing its payment configuration' }, { status: 500 })
  }

  const query = request.nextUrl.searchParams.get('q')
  if (!query || query.trim().length < 5) {
    return NextResponse.json(
      { error: 'Missing or too-short "q" query parameter (min 5 characters)' },
      { status: 400 }
    )
  }

  const budget = parseFloat(result.paymentRequirements.amount) / 1_000_000 // base units -> USDC decimal

  // The verified EIP-3009 authorization's "from" field is the paying wallet —
  // used as the refund destination for unspent budget, same as the human flow.
  const authorization = result.paymentPayload.payload?.authorization as { from?: string } | undefined
  const payerAddress = authorization?.from

  const supabase = createAdminClient()
  const { data: session, error: sessionError } = await supabase
    .from('research_sessions')
    .insert({ user_id: null, query, budget_usdc: budget, status: 'active' })
    .select('id')
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Failed to create research session' }, { status: 500 })
  }

  try {
    const agentResult = await runResearchAgent(session.id, query, budget, payerAddress)

    await supabase
      .from('research_sessions')
      .update({ status: 'completed', result: agentResult })
      .eq('id', session.id)

    // Serve first, settle after — matches the x402/Gateway model where the
    // buyer's funds are already locked once verified; settlement finalizes
    // the batch but doesn't gate serving the resource.
    const settlement = await server.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
      result.declaredExtensions
    )

    if (!settlement.success) {
      console.error('x402 settlement failed after serving research:', settlement.errorReason)
      return NextResponse.json({
        answer: agentResult.answer,
        citationsUsed: agentResult.citationsUsed,
        purchasedSources: agentResult.purchasedSources,
        settlementWarning: settlement.errorReason,
      })
    }

    return NextResponse.json(
      {
        answer: agentResult.answer,
        citationsUsed: agentResult.citationsUsed,
        purchasedSources: agentResult.purchasedSources,
        transaction: settlement.transaction,
      },
      { headers: settlement.headers }
    )
  } catch (err: any) {
    try {
      await supabase.from('research_sessions').update({ status: 'failed' }).eq('id', session.id)
    } catch {
      // Best-effort bookkeeping only — the original error below is what matters.
    }
    // Do not settle on failure — the verified authorization is simply never
    // submitted, so no funds move. The buyer isn't charged for a failed run.
    return NextResponse.json({ error: err.message || 'Agent execution failed' }, { status: 500 })
  }
}
