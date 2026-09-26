import { NextRequest, NextResponse } from 'next/server'
import { autoDisburseGatewayBalance } from '@/lib/payments/gateway_disbursement'
import { executeGatewayTransfer } from '@/lib/payments/circle-api'
import { createAdminClient } from '@/utils/supabase/admin'

// Sweeps the treasury's Arc mainnet Circle Gateway balance on-chain, then pays
// any refunds still owed. Buyer payments settle into the treasury's Gateway
// balance while refunds and creator payouts come from the on-chain wallet, and
// Gateway settlement is batched, so this runs on a schedule (see vercel.json)
// and is safe to call manually:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/treasury/disburse
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('CRON_SECRET is not set; /api/treasury/disburse is publicly callable.')
  }

  const sweep = await autoDisburseGatewayBalance('arc-mainnet')
  const refunds = await processPendingRefunds()

  return NextResponse.json({ sweep, refunds })
}

async function processPendingRefunds(limit = 25) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('pending_refunds')
    .select('id, payer_address, amount_usdc, network, attempts')
    .eq('status', 'pending')
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    return { paid: 0, failed: 0, total: 0, error: error.message }
  }

  let paid = 0
  let failed = 0

  for (const refund of data || []) {
    const network = refund.network === 'arc-mainnet' ? 'arc-mainnet' : 'arc-testnet'
    try {
      const txId = await executeGatewayTransfer(
        refund.payer_address,
        Number(refund.amount_usdc).toFixed(2),
        network
      )
      await supabase
        .from('pending_refunds')
        .update({ status: 'paid', paid_transaction_id: txId })
        .eq('id', refund.id)
      paid++
    } catch (e: any) {
      failed++
      await supabase
        .from('pending_refunds')
        .update({ attempts: (refund.attempts || 0) + 1, last_error: e.message })
        .eq('id', refund.id)
    }
  }

  return { paid, failed, total: (data || []).length }
}
