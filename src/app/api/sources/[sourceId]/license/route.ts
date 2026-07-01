import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import crypto from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { sourceId } = await params
    const supabase = await createClient()

    // Find the source and its creator's wallet
    const { data, error } = await supabase
      .from('sources')
      .select('price_usdc, creator_id, creator_profiles(user_id, profiles(wallet_address))')
      .eq('id', sourceId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    const source = data as any;
    const walletAddress = source.creator_profiles?.profiles?.wallet_address

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Creator has not configured a wallet address' },
        { status: 400 }
      )
    }

    // Return the HTTP 402 Payment Required response as per x402 standards
    return NextResponse.json(
      {
        message: 'Payment Required',
        amount: source.price_usdc,
        currency: 'USDC',
        recipient: walletAddress,
        network: 'arc-testnet',
        paymentEndpoint: `/api/sources/${sourceId}/license`
      },
      { status: 402 }
    )
  } catch (error: any) {
    console.error('License GET Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { sourceId } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { authorizationId, amount, nonce, validAfter, validBefore } = body

    if (!authorizationId) {
      return NextResponse.json({ error: 'Missing payment authorization payload' }, { status: 400 })
    }

    // 1. Verify the source exists and price matches
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('price_usdc, creator_profiles(profiles(wallet_address))')
      .eq('id', sourceId)
      .single()

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    if (parseFloat(amount) < parseFloat(source.price_usdc)) {
      return NextResponse.json({ error: 'Insufficient payment amount' }, { status: 400 })
    }

    const recipientWallet = (source as any).creator_profiles?.profiles?.wallet_address
    if (!recipientWallet) {
      return NextResponse.json({ error: 'Creator wallet not found' }, { status: 400 })
    }

    // Validate authorization exists in our DB (ensuring the agent actually authorized this)
    const { data: paymentAuth, error: authError } = await supabase
      .from('payment_authorizations')
      .select('id, status')
      .eq('authorization_id', authorizationId)
      .single()

    if (authError || !paymentAuth) {
      return NextResponse.json({ error: 'Invalid or unknown payment authorization' }, { status: 400 })
    }

    // 2. Execute the REAL Circle Web3 Services API!
    let gatewaySettlementId: string
    try {
      const { executeGatewayTransfer } = await import('@/lib/payments/circle-api')
      
      // Calculate 20% platform fee
      const platformFeePercent = 0.20
      const price = parseFloat(source.price_usdc)
      const creatorPayout = (price * (1 - platformFeePercent)).toFixed(6)
      
      console.log(`[Take Rate Executed] Citation Price: $${price} | Platform Fee: $${(price * platformFeePercent).toFixed(6)} | Creator Payout: $${creatorPayout}`)
      
      gatewaySettlementId = await executeGatewayTransfer(recipientWallet, creatorPayout)
    } catch (apiError: any) {
      console.error('Circle API Execution Failed:', apiError)
      return NextResponse.json({ error: apiError.message || 'Payment execution failed at Gateway' }, { status: 500 })
    }

    const { error: settlementError } = await supabase
      .from('payment_settlements')
      .insert({
        authorization_id: authorizationId,
        gateway_settlement_id: gatewaySettlementId,
        status: 'settled' // The Developer API executed it!
      })

    if (settlementError) {
      return NextResponse.json({ error: 'Payment already settled or failed to record settlement' }, { status: 400 })
    }

    // Update the authorization status
    await supabase
      .from('payment_authorizations')
      .update({ status: 'settled' })
      .eq('authorization_id', authorizationId)

    // 3. Return the cryptographic citation receipt
    const receiptPayload = `${sourceId}:${authorizationId}:${Date.now()}`
    const receiptSignature = crypto.createHmac('sha256', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'fallback_secret')
                                   .update(receiptPayload)
                                   .digest('hex')

    return NextResponse.json({
      success: true,
      receipt: {
        payload: receiptPayload,
        signature: receiptSignature,
        gatewaySettlementId
      }
    })

  } catch (error: any) {
    console.error('License POST Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
