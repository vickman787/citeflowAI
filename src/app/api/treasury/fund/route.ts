import { NextRequest, NextResponse } from 'next/server'

// 0.50 USDC = 500,000 units (6 decimals)
const PROMPT_FEE_USDC = "500000" 

export async function GET(request: NextRequest) {
  // Generate the 402 challenge
  const challenge = {
    accepts: [
      {
        network: "eip155:5042002", // Arc Testnet
        amount: PROMPT_FEE_USDC,
        payTo: process.env.AGENT_TREASURY_ADDRESS || "0x933a2405f84c224be1ef373ba16e992e1f459682", // Fallback if missing
        maxTimeoutSeconds: 604800,
        extra: { 
          verifyingContract: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" // GatewayWalletBatched
        }
      }
    ],
    resource: "/api/treasury/fund"
  }

  const challengeBase64 = Buffer.from(JSON.stringify(challenge)).toString('base64')

  return new NextResponse('Payment Required', {
    status: 402,
    headers: {
      'PAYMENT-REQUIRED': challengeBase64,
      'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED'
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const paymentSignatureHeader = request.headers.get('payment-signature')
    
    if (!paymentSignatureHeader) {
      return NextResponse.json({ error: 'Missing payment-signature header' }, { status: 400 })
    }

    const paymentPayload = JSON.parse(Buffer.from(paymentSignatureHeader, 'base64').toString('utf-8'))

    // Forward the signature to Circle's Facilitator API
    const facilitatorRes = await fetch("https://gateway-api-testnet.circle.com/v1/x402/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentPayload)
    })

    if (!facilitatorRes.ok) {
      const errText = await facilitatorRes.text()
      console.error("Facilitator error:", errText)
      return NextResponse.json({ error: `Facilitator settlement failed: ${errText}` }, { status: 400 })
    }

    const data = await facilitatorRes.json()

    // Succeeded! Return the settlementId
    return NextResponse.json({
      success: true,
      settlementId: data.id || data.settlementId
    })

  } catch (error: any) {
    console.error('Fund POST Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
