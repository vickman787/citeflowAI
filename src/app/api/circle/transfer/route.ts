import { NextRequest, NextResponse } from 'next/server'
import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userToken, walletId, amount, destinationAddress } = body

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: 'Missing CIRCLE_API_KEY' }, { status: 500 })
    }

    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    })

    const idempotencyKey = crypto.randomUUID()

    // 1. Fetch the user's actual Wallet ID
    const walletsRes = await circleClient.listWallets({ userToken })
    const userWallet = walletsRes.data?.wallets?.[0]
    
    if (!userWallet) {
      return NextResponse.json({ error: 'No wallets found for user' }, { status: 400 })
    }

    const actualWalletId = userWallet.id

    // 2. Fetch the Token ID for USDC on MATIC-AMOY
    // To transfer a specific ERC20 token, we need its Token ID. 
    // For this hackathon demo, we will attempt to execute a transfer, but it will fail 
    // unless the wallet is funded via the Circle Faucet!
    const tokenBalanceRes = await circleClient.getWalletTokenBalance({
      userToken,
      walletId: actualWalletId
    })
    
    // Find the USDC token ID or fallback to the native token (e.g., MATIC)
    const usdcToken = tokenBalanceRes.data?.tokenBalances?.find(t => t.token?.symbol === 'USDC')
    const nativeToken = tokenBalanceRes.data?.tokenBalances?.find(t => t.token?.isNative)
    
    const targetTokenId = usdcToken?.token?.id || nativeToken?.token?.id

    if (!targetTokenId) {
      return NextResponse.json({ error: 'No tokens available to transfer. Please fund the wallet via Faucet.' }, { status: 400 })
    }

    const res = await circleClient.createTransaction({
      userToken,
      walletId: actualWalletId,
      tokenId: targetTokenId,
      destinationAddress,
      amounts: [amount],
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM"
        }
      },
      idempotencyKey
    })

    return NextResponse.json({
      challengeId: res.data?.challengeId
    })

  } catch (error: any) {
    console.error('Circle Transfer Error:', error?.response?.data || error)
    return NextResponse.json({ error: 'Failed to initialize transfer challenge' }, { status: 500 })
  }
}
