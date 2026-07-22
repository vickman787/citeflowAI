import { NextRequest, NextResponse } from 'next/server'
import { getX402Server } from '@/lib/x402/server'
import { buildRequestContext } from '@/lib/x402/next-adapter'

// Real, spec-compliant x402 endpoint — built on @x402/core + Circle's
// BatchFacilitatorClient, replacing the earlier hand-rolled challenge/settle
// pair that a genuine x402 client (verified against @circle-fin/x402-batching's
// own GatewayClient) could not actually complete a payment against.
//
// A single GET handles both halves of the flow: no PAYMENT-SIGNATURE header
// returns the 402 challenge; a request with a valid signed authorization gets
// verified and settled against Circle's Gateway.
export async function GET(request: NextRequest) {
  const server = await getX402Server()
  const context = await buildRequestContext(request, '/api/treasury/fund')
  const result = await server.processHTTPRequest(context)

  if (result.type === 'payment-error') {
    return NextResponse.json(result.response.body ?? {}, {
      status: result.response.status,
      headers: result.response.headers,
    })
  }

  if (result.type === 'no-payment-required') {
    // Should not happen for this route — it always declares a payment
    // requirement — but fail loudly rather than silently serving for free.
    return NextResponse.json({ error: 'Route is missing its payment configuration' }, { status: 500 })
  }

  // payment-verified: the facilitator has already confirmed the signature
  // and requirements are valid. Settle, then serve the resource.
  const settlement = await server.processSettlement(
    result.paymentPayload,
    result.paymentRequirements,
    result.declaredExtensions
  )

  if (!settlement.success) {
    return NextResponse.json(settlement.response.body ?? { error: settlement.errorReason }, {
      status: settlement.response.status,
      headers: settlement.response.headers,
    })
  }

  return NextResponse.json(
    { success: true, transaction: settlement.transaction, network: settlement.network },
    { headers: settlement.headers }
  )
}
