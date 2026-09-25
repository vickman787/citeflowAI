import { NextRequest, NextResponse } from 'next/server'
import {
  getX402Server,
  RESEARCH_PAYMENT_ACCEPTS,
} from '@/lib/x402/server'
import { getTreasuryAddress } from '@/lib/circle-credentials'
import { buildRequestContext } from '@/lib/x402/next-adapter'
import { createAdminClient } from '@/utils/supabase/admin'
import { runResearchAgent } from '@/lib/ai/research-agent'
import { verifyEip3009Payment, settleEip3009Payment } from '@/lib/x402/eip3009'
import { NETWORKS } from '@/lib/network'

const GATEWAY_WALLETS = [
  NETWORKS['arc-mainnet'].gatewayWallet.toLowerCase(),
  NETWORKS['arc-testnet'].gatewayWallet.toLowerCase(),
]

function parseRawPaymentHeader(rawHeader: string | undefined | null): any | null {
  if (!rawHeader) return null
  try {
    return JSON.parse(rawHeader)
  } catch {
    try {
      const decoded = Buffer.from(rawHeader, 'base64').toString('utf-8')
      return JSON.parse(decoded)
    } catch {
      return null
    }
  }
}

// Agent payable research endpoint supporting both OKX Agent Wallet (standard x402 exact EIP 3009)
// and Circle Agent Wallet (Circle Gateway batched x402) concurrently.
export async function GET(request: NextRequest) {
  const rawAuth = request.headers.get('authorization')
  const authVal = rawAuth ? rawAuth.replace(/^Bearer\s+/i, '') : undefined
  const paymentHeader =
    request.headers.get('payment-signature') ||
    request.headers.get('x-payment') ||
    authVal ||
    undefined

  const parsedPayment = parseRawPaymentHeader(paymentHeader)

  // 1. Initial 402 challenge when no payment payload is provided
  if (!parsedPayment) {
    const challengeBody = {
      x402Version: 2,
      error: 'Payment required',
      resource: {
        url: '/api/agent/research',
        description: 'CiteFlow AI grounded research answer, agent-payable via x402',
        mimeType: 'application/json',
      },
      accepts: RESEARCH_PAYMENT_ACCEPTS,
    }
    const challengeBase64 = Buffer.from(JSON.stringify(challengeBody)).toString('base64')
    return NextResponse.json(challengeBody, {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'PAYMENT-REQUIRED': challengeBase64,
        'X-PAYMENT-REQUIRED': challengeBase64,
      },
    })
  }

  // 2. Identify payment rail
  const isGatewayBatched =
    parsedPayment?.accepted?.extra?.name === 'GatewayWalletBatched' ||
    GATEWAY_WALLETS.includes(
      String(parsedPayment?.accepted?.extra?.verifyingContract || '').toLowerCase()
    )

  // Standard x402 Exact EIP 3009 Rail (OKX Agent Wallet, Goat SDK, universal x402 agents)
  if (!isGatewayBatched) {
    const query = request.nextUrl.searchParams.get('q')
    if (!query || query.trim().length < 5) {
      return NextResponse.json(
        { error: 'Missing or too short "q" query parameter (min 5 characters)' },
        { status: 400 }
      )
    }

    // The payment's own network is authoritative. A client header or query param
    // must never override which treasury the signed payment has to target.
    const acceptedNetwork = parsedPayment.accepted?.network || parsedPayment.network || 'eip155:5042'
    const isMainnet = acceptedNetwork === 'eip155:5042'
    const activeNetwork = isMainnet ? 'arc-mainnet' : 'arc-testnet'
    let expectedPayTo: string
    try {
      expectedPayTo = getTreasuryAddress(activeNetwork)
    } catch (credErr: any) {
      return NextResponse.json({ error: credErr.message }, { status: 500 })
    }

    const authObj = parsedPayment.payload?.authorization || parsedPayment.payload
    const rawSig = parsedPayment.payload?.signature || parsedPayment.signature
    const eipPayload = { authorization: authObj, signature: rawSig }

    const verification = await verifyEip3009Payment(
      eipPayload,
      acceptedNetwork,
      expectedPayTo,
      '1000000'
    )

    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Payment verification failed', details: verification.error },
        { status: 402 }
      )
    }

    const payerAddress = verification.payer
    const budget = 1.0

    const supabase = createAdminClient()

    // Replay guard: a signed EIP-3009 authorization carries a unique nonce and
    // can only fund one research session. Without this, a replayed authorization
    // would serve research and pay creators again before on-chain settlement
    // rejects the reused nonce.
    const authNonce = authObj?.nonce ? String(authObj.nonce) : ''
    if (authNonce) {
      const { data: priorUse } = await supabase
        .from('audit_events')
        .select('id')
        .eq('event_type', 'agent_eip3009_auth_used')
        .eq('details->>nonce', authNonce)
        .limit(1)

      if (priorUse && priorUse.length > 0) {
        return NextResponse.json(
          { error: 'This payment authorization has already been used' },
          { status: 409 }
        )
      }
    }

    const { data: session, error: sessionError } = await supabase
      .from('research_sessions')
      .insert({ user_id: null, query, budget_usdc: budget, status: 'active' })
      .select('id')
      .single()

    if (sessionError || !session) {
      console.error('Failed to create research session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create research session', details: sessionError?.message },
        { status: 500 }
      )
    }

    if (authNonce) {
      const { error: guardError } = await supabase.from('audit_events').insert({
        event_type: 'agent_eip3009_auth_used',
        details: {
          nonce: authNonce,
          payer: payerAddress,
          sessionId: session.id,
          network: activeNetwork,
        },
      })

      if (guardError) {
        // 23505 = unique_violation. A partial unique index on (details->>nonce)
        // makes this the atomic backstop for the pre-check above, closing the
        // check-then-insert race.
        if ((guardError as any).code === '23505') {
          await supabase.from('research_sessions').update({ status: 'failed' }).eq('id', session.id)
          return NextResponse.json(
            { error: 'This payment authorization has already been used' },
            { status: 409 }
          )
        }
        // Any other bookkeeping error must never block a valid payment.
        console.error('Failed to record EIP-3009 replay guard entry:', guardError)
      }
    }

    try {
      // Settle the buyer's payment BEFORE any creator payout. The research agent
      // pays creators from the treasury; if we served and paid first and settlement
      // then failed, the treasury would absorb the loss. Settling first means an
      // unsettled authorization never triggers payouts.
      const settlement = await settleEip3009Payment(eipPayload, acceptedNetwork)

      if (!settlement.success) {
        await supabase.from('research_sessions').update({ status: 'failed' }).eq('id', session.id)
        return NextResponse.json(
          { error: 'Payment settlement failed', details: settlement.error },
          { status: 402 }
        )
      }

      const agentResult = await runResearchAgent(
        session.id,
        query,
        budget,
        payerAddress,
        undefined,
        undefined,
        activeNetwork
      )

      await supabase
        .from('research_sessions')
        .update({ status: 'completed', result: agentResult })
        .eq('id', session.id)

      const paymentResponseData = {
        success: settlement.success,
        transaction: settlement.txHash || 'settled',
        network: acceptedNetwork,
        amount: '1000000',
        payer: payerAddress,
      }
      const paymentResponseBase64 = Buffer.from(JSON.stringify(paymentResponseData)).toString('base64')

      return NextResponse.json(
        {
          answer: agentResult.answer,
          citationsUsed: agentResult.citationsUsed,
          purchasedSources: agentResult.purchasedSources,
          transaction: settlement.txHash,
        },
        {
          headers: {
            'PAYMENT-RESPONSE': paymentResponseBase64,
            'X-PAYMENT-RESPONSE': paymentResponseBase64,
          },
        }
      )
    } catch (err: any) {
      try {
        await supabase.from('research_sessions').update({ status: 'failed' }).eq('id', session.id)
      } catch {}
      return NextResponse.json({ error: err.message || 'Agent execution failed' }, { status: 500 })
    }
  }

  // Circle Gateway Batched Rail (Circle Agent Wallet)
  const server = await getX402Server()
  const context = await buildRequestContext(request, '/api/agent/research')
  const result = await server.processHTTPRequest(context)

  if (result.type === 'payment-error') {
    const body: any = result.response.body ?? {}
    if (result.response.status === 402 && (!body.accepts || body.accepts.length < 2)) {
      body.accepts = RESEARCH_PAYMENT_ACCEPTS
    }
    return NextResponse.json(body, {
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
      { error: 'Missing or too short "q" query parameter (min 5 characters)' },
      { status: 400 }
    )
  }

  const budget = parseFloat(result.paymentRequirements.amount) / 1_000_000

  const authorization = result.paymentPayload.payload?.authorization as { from?: string } | undefined
  const payerAddress = authorization?.from

  const isMainnet = result.paymentRequirements.network === 'eip155:5042'
  const activeNetwork = isMainnet ? 'arc-mainnet' : 'arc-testnet'

  const supabase = createAdminClient()
  const { data: session, error: sessionError } = await supabase
    .from('research_sessions')
    .insert({ user_id: null, query, budget_usdc: budget, status: 'active' })
    .select('id')
    .single()

  if (sessionError || !session) {
    console.error('Failed to create research session:', sessionError)
    return NextResponse.json(
      { error: 'Failed to create research session', details: sessionError?.message },
      { status: 500 }
    )
  }

  try {
    const agentResult = await runResearchAgent(
      session.id,
      query,
      budget,
      payerAddress,
      undefined,
      undefined,
      activeNetwork
    )

    await supabase
      .from('research_sessions')
      .update({ status: 'completed', result: agentResult })
      .eq('id', session.id)

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

    if (activeNetwork === 'arc-mainnet') {
      import('@/lib/payments/gateway_disbursement')
        .then(({ autoDisburseGatewayBalance }) => {
          autoDisburseGatewayBalance('arc-mainnet').catch(disburseErr => {
            console.error('Automated Gateway post settlement disbursement error:', disburseErr)
          })
        })
        .catch(importErr => {
          console.error('Failed to load gateway_disbursement module:', importErr)
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
    } catch {}
    return NextResponse.json({ error: err.message || 'Agent execution failed' }, { status: 500 })
  }
}
