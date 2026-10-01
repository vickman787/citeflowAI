import { NextRequest, NextResponse } from 'next/server'
import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCircleCredentials } from '@/lib/circle-credentials'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userToken, network } = body
    const networkHeader = request.headers.get('x-network')
    const activeNetwork = network || networkHeader || 'arc-testnet'
    if (activeNetwork !== 'arc-mainnet' && activeNetwork !== 'arc-testnet') {
      return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
    }
    const isMainnet = activeNetwork === 'arc-mainnet'

    const apiKey = getCircleCredentials(isMainnet ? 'arc-mainnet' : 'arc-testnet').apiKey

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Circle API Key' }, { status: 500 })
    }

    // 1. Verify userToken with Circle and get the wallet address
    const circleClient = initiateUserControlledWalletsClient({
      apiKey,
    })

    const walletsRes = await circleClient.listWallets({ userToken })
    const userWallet = walletsRes.data?.wallets?.[0]
    
    if (!userWallet || !userWallet.address) {
      return NextResponse.json({ error: 'No wallet found for this userToken' }, { status: 400 })
    }

    const walletAddress = userWallet.address.toLowerCase()

    // Circle has verified possession of this wallet's user token. Issue a
    // one-time Supabase login for its deterministic internal email, preserving
    // any existing account and creator profile regardless of its old password.
    const supabase = await createClient()
    const email = `${walletAddress}@citeflow.local`
    const adminAuth = createAdminClient()
    const { data: link, error: linkError } = await adminAuth.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkError || !link.properties?.hashed_token || link.user?.email?.toLowerCase() !== email) {
      console.error('Wallet Supabase link generation failed:', linkError)
      return NextResponse.json({ error: 'Could not prepare wallet login' }, { status: 500 })
    }
    const { data: login, error: loginError } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: 'magiclink',
    })
    if (loginError || !login.user || !login.session || login.user.id !== link.user.id) {
      console.error('Wallet Supabase login failed:', loginError)
      return NextResponse.json({ error: 'Could not establish wallet session' }, { status: 500 })
    }

    const userId = login.user.id
    const { error: profileError } = await adminAuth.from('profiles')
      .upsert({ id: userId, wallet_address: walletAddress }, { onConflict: 'id' })
    if (profileError) {
      console.error('Wallet profile update failed:', profileError)
      return NextResponse.json({ error: 'Could not save wallet profile' }, { status: 500 })
    }
    const { error: creatorError } = await adminAuth.from('creator_profiles')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (creatorError) {
      console.error('Wallet creator profile update failed:', creatorError)
      return NextResponse.json({ error: 'Could not save creator profile' }, { status: 500 })
    }

    // Once signed in/up, the cookies are automatically set by our Supabase SSR utility!
    return NextResponse.json({ 
      success: true, 
      walletAddress 
    })

  } catch (error: any) {
    console.error('Wallet Login Error:', error?.response?.data || error)
    return NextResponse.json({ error: 'Failed to execute wallet login' }, { status: 500 })
  }
}
