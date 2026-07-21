import { NextRequest, NextResponse } from 'next/server'
import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'

export async function GET(request: NextRequest) {
  try {
    const userToken = request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!userToken) {
      return NextResponse.json({ error: 'Missing user token' }, { status: 401 })
    }

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: 'Missing CIRCLE_API_KEY' }, { status: 500 })
    }

    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    })

    const walletsRes = await circleClient.listWallets({ userToken })
    const userWallet = walletsRes.data?.wallets?.[0]

    if (!userWallet) {
      return NextResponse.json({ error: 'No wallets found for user' }, { status: 404 })
    }

    const balancesRes = await circleClient.getWalletTokenBalance({
      walletId: userWallet.id,
      userToken
    })
    
    const usdcBalance = balancesRes.data?.tokenBalances?.find(t => t.token.symbol === 'USDC')?.amount || '0.00'

    return NextResponse.json({
      walletId: userWallet.id,
      address: userWallet.address,
      balance: usdcBalance
    })

  } catch (error: any) {
    // Circle codes 155103/155104/155105: userToken not found / expired / invalid.
    // Signal the client to drop its stored session rather than treating it as a server fault.
    const circleCode = error?.code || error?.response?.data?.code
    if ([155103, 155104, 155105].includes(circleCode)) {
      return NextResponse.json({ error: 'Wallet session expired', code: 'TOKEN_EXPIRED' }, { status: 401 })
    }
    console.error('Circle Wallet Fetch Error:', error?.response?.data || error)
    return NextResponse.json({ error: 'Failed to fetch wallet info' }, { status: 500 })
  }
}
