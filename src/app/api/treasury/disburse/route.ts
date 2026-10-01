import { NextRequest, NextResponse } from 'next/server'
import { autoDisburseGatewayBalance } from '@/lib/payments/gateway_disbursement'
import { claimRefund, claimRefunds, processClaimedRefund, queueRefund, reconcileRefund } from '@/lib/payments/refunds'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCircleTransaction } from '@/lib/payments/circle-api'
import { retryProcessingPayouts } from '@/lib/payments/license'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  // Fail closed. Missing CRON_SECRET must never make treasury operations public.
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = createAdminClient()
    // If a buyer's on-chain settlement outlived the request timeout, do not
    // run research against a pending payment. Refund it after confirmation.
    const { data: fundingPending } = await db.from('research_sessions')
      .select('id, funding_transaction_id, payer_address, budget_usdc, network')
      .eq('status', 'funding_pending').not('funding_transaction_id', 'is', null).limit(25)
    const fundingReconciled = []
    for (const session of fundingPending || []) {
      try {
        const tx = await getCircleTransaction(session.funding_transaction_id, session.network)
        if (tx.state === 'COMPLETE' && tx.txHash) {
          const refund = await queueRefund(session.id, session.payer_address, Number(session.budget_usdc), session.network)
          await db.from('research_sessions').update({ status: 'refund_pending' }).eq('id', session.id)
          const claimed = await claimRefund(refund.id)
          if (claimed) await processClaimedRefund(claimed)
          fundingReconciled.push('refund queued')
        } else if (['FAILED', 'DENIED', 'CANCELLED'].includes(tx.state)) {
          await db.from('research_sessions').update({ status: 'failed' }).eq('id', session.id)
          fundingReconciled.push('settlement failed')
        } else fundingReconciled.push('pending')
      } catch (error: any) { fundingReconciled.push(`lookup error: ${error.message}`) }
    }
    const { data: submitted } = await db.from('pending_refunds').select('*').eq('status', 'submitted').limit(50)
    const reconciled = []
    for (const refund of submitted || []) {
      try { reconciled.push(await reconcileRefund(refund)) }
      catch (error: any) { reconciled.push(`lookup error: ${error.message}`) }
    }

    const claims = await claimRefunds(25)
    const refunds = []
    for (const refund of claims) refunds.push(await processClaimedRefund(refund))

    const retriedPayouts = await retryProcessingPayouts()
    const { data: payouts } = await db.from('payment_settlements')
      .select('authorization_id, gateway_settlement_id, payment_authorizations(network)')
      .eq('status', 'submitted').not('gateway_settlement_id', 'is', null).limit(50)
    let confirmedPayouts = 0
    for (const payout of payouts || []) {
      const network = (payout as any).payment_authorizations?.network || 'arc-testnet'
      try {
        const tx = await getCircleTransaction(payout.gateway_settlement_id, network)
        if (tx.state === 'COMPLETE' && tx.txHash) {
          await db.from('payment_settlements').update({ status: 'confirmed', transaction_hash: tx.txHash })
            .eq('authorization_id', payout.authorization_id)
          await db.from('payment_authorizations').update({ status: 'settled' })
            .eq('authorization_id', payout.authorization_id)
          confirmedPayouts++
        } else if (['FAILED', 'DENIED', 'CANCELLED'].includes(tx.state)) {
          await db.from('payment_settlements').update({ status: 'failed' }).eq('authorization_id', payout.authorization_id)
          await db.from('payment_authorizations').update({ status: 'failed' }).eq('authorization_id', payout.authorization_id)
        }
      } catch (error: any) { console.error('Payout reconciliation failed', payout.authorization_id, error) }
    }

    const { data: pendingSweeps } = await db.from('gateway_sweeps')
      .select('id, mint_transaction_id').eq('status', 'submitted').not('mint_transaction_id', 'is', null).limit(10)
    const sweepReconciled = []
    for (const pendingSweep of pendingSweeps || []) {
      try {
        const mint = await getCircleTransaction(pendingSweep.mint_transaction_id, 'arc-mainnet')
        if (mint.state === 'COMPLETE' && mint.txHash) {
          await db.from('gateway_sweeps').update({ status: 'confirmed', transaction_hash: mint.txHash,
            updated_at: new Date().toISOString() }).eq('id', pendingSweep.id)
          sweepReconciled.push('confirmed')
        } else if (['FAILED', 'DENIED', 'CANCELLED'].includes(mint.state)) {
          await db.from('gateway_sweeps').update({ status: 'mint_failed', last_error: mint.error || mint.state,
            updated_at: new Date().toISOString() }).eq('id', pendingSweep.id)
          sweepReconciled.push('mint failed — manual retry required')
        } else sweepReconciled.push('pending')
      } catch (error: any) { sweepReconciled.push(`lookup error: ${error.message}`) }
    }

    const sweep = await autoDisburseGatewayBalance('arc-mainnet')
    return NextResponse.json({ refunds, reconciled, retriedPayouts, confirmedPayouts, fundingReconciled, sweepReconciled, sweep })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Treasury reconciliation failed' }, { status: 500 })
  }
}
