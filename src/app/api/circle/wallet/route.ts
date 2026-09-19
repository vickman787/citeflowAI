import { NextRequest, NextResponse } from 'next/server'
import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'

export async function GET(request: NextRequest) {
  try {
    const userToken = request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!userToken) {
      return NextResponse.json({ error: 'Missing user token' }, { status: 401 })
    }

    const networkHeader = request.headers.get('x-network')
    const { searchParams } = new URL(request.url)
    const network = networkHeader || searchParams.get('network')
    const isMainnet = network === 'arc-mainnet'

    const apiKey = isMainnet
      ? (process.env.CIRCLE_API_KEY_MAINNET || process.env.CIRCLE_API_KEY)
      : process.env.CIRCLE_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Circle API Key' }, { status: 500 })
    }

    const circleClient = initiateUserControlledWalletsClient({
      apiKey,
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
