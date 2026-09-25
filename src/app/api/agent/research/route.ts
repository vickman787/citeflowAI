import { NextRequest, NextResponse } from 'next/server'
import {
  getX402Server,
  RESEARCH_PAYMENT_ACCEPTS,
  AGENT_TREASURY_ADDRESS,
  AGENT_TREASURY_ADDRESS_MAINNET,
} from '@/lib/x402/server'
import { buildRequestContext } from '@/lib/x402/next-adapter'
import { createAdminClient } from '@/utils/supabase/admin'
import { runResearchAgent } from '@/lib/ai/research-agent'
import { verifyEip3009Payment, settleEip3009Payment } from '@/lib/x402/eip3009'

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
    parsedPayment?.accepted?.extra?.verifyingContract === '0x77777777dcc4d5a8b6e418fd04d8997ef11000ee'

  // Standard x402 Exact EIP 3009 Rail (OKX Agent Wallet, Goat SDK, universal x402 agents)
  if (!isGatewayBatched) {
    const query = request.nextUrl.searchParams.get('q')
    if (!query || query.trim().length < 5) {
      return NextResponse.json(
        { error: 'Missing or too short "q" query parameter (min 5 characters)' },
        { status: 400 }
      )
    }

    const acceptedNetwork = parsedPayment.accepted?.network || parsedPayment.network || 'eip155:5042'
    const isMainnet =
      acceptedNetwork === 'eip155:5042' ||
      request.headers.get('x-network') === 'arc-mainnet' ||
      request.nextUrl.searchParams.get('network') === 'arc-mainnet'
    const activeNetwork = isMainnet ? 'arc-mainnet' : 'arc-testnet'
    const expectedPayTo = isMainnet ? AGENT_TREASURY_ADDRESS_MAINNET : AGENT_TREASURY_ADDRESS

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

      // On chain settlement on Arc Mainnet
      const settlement = await settleEip3009Payment(eipPayload, acceptedNetwork)

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

  const isMainnet =
    result.paymentRequirements.network === 'eip155:5042' ||
    request.headers.get('x-network') === 'arc-mainnet' ||
    request.nextUrl.searchParams.get('network') === 'arc-mainnet'
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
