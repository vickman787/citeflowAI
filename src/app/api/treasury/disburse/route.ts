import { NextRequest, NextResponse } from 'next/server'
import { autoDisburseGatewayBalance } from '@/lib/payments/gateway_disbursement'

// Sweeps the treasury's Arc mainnet Circle Gateway balance to its on-chain
// wallet. Buyer payments settle into the treasury's *Gateway* balance, while
// creator payouts and refunds come from the on-chain wallet, so without this
// sweep the on-chain float drains even though the funds are safely held.
//
// Triggered by the Vercel cron (see vercel.json) and safe to call manually:
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

  const result = await autoDisburseGatewayBalance('arc-mainnet')
  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}
