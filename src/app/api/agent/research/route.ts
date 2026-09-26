import { NextRequest, NextResponse } from 'next/server'
import {
  RESEARCH_PAYMENT_ACCEPTS,
  getGatewayRequirement,
  getGatewayFacilitator,
} from '@/lib/x402/server'
import { getTreasuryAddress } from '@/lib/circle-credentials'
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
      .insert({ user_id: null, query, budget_usdc: budget, status: 'active', network: activeNetwork })
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

  // Circle Gateway Batched Rail (Circle Agent Wallet).
  //
  // Deliberately bypasses the strict x402 requirement matcher. Circle CLI
  // normalizes addresses (checksummed payTo/asset) and drops extra fields
  // (minValiditySeconds, assets[]) from the echoed `accepted`, which the matcher
  // rejects with "No matching payment requirements". We verify and settle
  // directly with the Gateway facilitator using our own canonical requirement.
  const gwQuery = request.nextUrl.searchParams.get('q')
  if (!gwQuery || gwQuery.trim().length < 5) {
    return NextResponse.json(
      { error: 'Missing or too short "q" query parameter (min 5 characters)' },
      { status: 400 }
    )
  }

  const gwNetwork = parsedPayment?.accepted?.network || parsedPayment?.network || 'eip155:5042'
  const gwIsMainnet = gwNetwork === 'eip155:5042'
  const gwActiveNetwork = gwIsMainnet ? 'arc-mainnet' : 'arc-testnet'

  const gwBase = getGatewayRequirement(gwNetwork)
  if (!gwBase) {
    return NextResponse.json({ error: `Unsupported payment network: ${gwNetwork}` }, { status: 400 })
  }

  // Use our own amount/asset/payTo (a client must not be able to redirect the
  // payment), but take the EIP-712 domain fields from what the client echoed so
  // Circle verifies the signature against the domain the wallet actually used.
  const gwAcceptedExtra = (parsedPayment?.accepted?.extra || {}) as Record<string, unknown>
  const gwRequirement = {
    scheme: gwBase.scheme,
    network: gwBase.network,
    amount: gwBase.amount,
    asset: gwBase.asset,
    payTo: gwBase.payTo,
    maxTimeoutSeconds: gwBase.maxTimeoutSeconds,
    extra: { ...gwBase.extra, ...gwAcceptedExtra },
  }

  const gwFacilitator = getGatewayFacilitator(gwNetwork)

  let gwVerify: any
  try {
    gwVerify = await gwFacilitator.verify(parsedPayment, gwRequirement)
  } catch (verifyErr: any) {
    console.error('Gateway verify error:', verifyErr)
    return NextResponse.json({ error: 'Payment verification failed', details: verifyErr.message }, { status: 402 })
  }

  if (!gwVerify?.isValid) {
    return NextResponse.json(
      { error: 'Payment verification failed', details: gwVerify?.invalidReason || 'requirements not satisfied' },
      { status: 402 }
    )
  }

  const gwBudget = parseFloat(gwRequirement.amount) / 1_000_000
  const gwAuthorization = (parsedPayment?.payload?.authorization || {}) as { from?: string; nonce?: string }
  // The wallet that signed the payment (authorization.from) is the wallet the
  // user pays from, so refunds must follow it. Circle's verify "payer" has been
  // observed to be a different address and is only a fallback.
  const gwPayer = gwAuthorization.from || gwVerify.payer
  const gwNonce = gwAuthorization.nonce ? String(gwAuthorization.nonce) : ''

  const supabase = createAdminClient()

  // Replay guard: same event type and unique index as the standard rail, so a
  // signed authorization nonce can never fund two sessions on either rail.
  if (gwNonce) {
    const { data: priorUse } = await supabase
      .from('audit_events')
      .select('id')
      .eq('event_type', 'agent_eip3009_auth_used')
      .eq('details->>nonce', gwNonce)
      .limit(1)

    if (priorUse && priorUse.length > 0) {
      return NextResponse.json({ error: 'This payment authorization has already been used' }, { status: 409 })
    }
  }

  const { data: session, error: sessionError } = await supabase
    .from('research_sessions')
    .insert({ user_id: null, query: gwQuery, budget_usdc: gwBudget, status: 'active', network: gwActiveNetwork })
    .select('id')
    .single()

  if (sessionError || !session) {
    console.error('Failed to create research session:', sessionError)
    return NextResponse.json(
      { error: 'Failed to create research session', details: sessionError?.message },
      { status: 500 }
    )
  }

  if (gwNonce) {
    const { error: guardError } = await supabase.from('audit_events').insert({
      event_type: 'agent_eip3009_auth_used',
      details: {
        nonce: gwNonce,
        payer: gwPayer,
        signer: gwAuthorization.from,
        verifiedPayer: gwVerify.payer,
        sessionId: session.id,
        network: gwActiveNetwork,
      },
    })
    if (guardError) {
      if ((guardError as any).code === '23505') {
        await supabase.from('research_sessions').update({ status: 'failed' }).eq('id', session.id)
        return NextResponse.json({ error: 'This payment authorization has already been used' }, { status: 409 })
      }
      console.error('Failed to record Gateway replay guard entry:', guardError)
    }
  }

  try {
    // Settle first so the buyer's funds are committed to the treasury before any
    // creator payout or refund runs. A session that never settles never pays out.
    let gwSettlement: any
    try {
      gwSettlement = await gwFacilitator.settle(parsedPayment, gwRequirement)
    } catch (settleErr: any) {
      console.error('Gateway settle error:', settleErr)
      gwSettlement = { success: false, errorReason: settleErr.message }
    }

    if (!gwSettlement?.success) {
      await supabase.from('research_sessions').update({ status: 'failed' }).eq('id', session.id)
      return NextResponse.json(
        { error: 'Payment settlement failed', details: gwSettlement?.errorReason || 'settlement failed' },
        { status: 402 }
      )
    }

    // Move the buyer's funds from the treasury's Gateway balance onto the chain,
    // so creator payouts and the unspent refund have on-chain float to draw from.
    // The Gateway batch can take a moment to credit the balance, so poll briefly.
    if (gwActiveNetwork === 'arc-mainnet') {
      try {
        const { autoDisburseGatewayBalance, getTreasuryGatewayBalance } = await import(
          '@/lib/payments/gateway_disbursement'
        )
        const expected = parseFloat(gwRequirement.amount) / 1_000_000
        const deadline = Date.now() + 8000
        while (Date.now() < deadline) {
          const bal = await getTreasuryGatewayBalance()
          if (bal + 0.0005 >= expected) break
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
        const sweep = await autoDisburseGatewayBalance('arc-mainnet')
        if (!sweep.success) {
          console.warn('Pre-research Gateway sweep did not complete:', sweep.message)
        }
      } catch (sweepErr: any) {
        console.error('Pre-research Gateway sweep error:', sweepErr)
      }
    }

    const agentResult = await runResearchAgent(
      session.id,
      gwQuery,
      gwBudget,
      gwPayer,
      undefined,
      undefined,
      gwActiveNetwork
    )

    await supabase
      .from('research_sessions')
      .update({ status: 'completed', result: agentResult })
      .eq('id', session.id)

    const paymentResponseData = {
      success: true,
      transaction: gwSettlement.transaction,
      network: gwNetwork,
      amount: gwRequirement.amount,
      payer: gwPayer,
    }
    const paymentResponseBase64 = Buffer.from(JSON.stringify(paymentResponseData)).toString('base64')

    return NextResponse.json(
      {
        answer: agentResult.answer,
        citationsUsed: agentResult.citationsUsed,
        purchasedSources: agentResult.purchasedSources,
        transaction: gwSettlement.transaction,
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
