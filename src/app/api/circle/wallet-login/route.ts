import { NextRequest, NextResponse } from 'next/server'
import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userToken } = body

    if (!userToken) {
      return NextResponse.json({ error: 'Missing userToken' }, { status: 400 })
    }

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: 'Missing CIRCLE_API_KEY' }, { status: 500 })
    }

    // 1. Verify userToken with Circle and get the wallet address
    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    })

    const walletsRes = await circleClient.listWallets({ userToken })
    const userWallet = walletsRes.data?.wallets?.[0]
    
    if (!userWallet || !userWallet.address) {
      return NextResponse.json({ error: 'No wallet found for this userToken' }, { status: 400 })
    }

    const walletAddress = userWallet.address.toLowerCase()

    // 2. We now cryptographically know the user owns this wallet address.
    // Let's create an "Invisible Supabase Session" for them.
    const supabase = await createClient()
    const email = `${walletAddress}@citeflow.local`
    
    // Generate a deterministic but secure password so they can log in next time
    const password = crypto.createHash('sha256').update(walletAddress + process.env.CIRCLE_API_KEY).digest('hex')

    let userId = null;

    // Try to sign in first
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      // If sign in fails, it means the user doesn't exist yet, so we sign them up!
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        console.error('Invisible Supabase SignUp Error:', signUpError)
        return NextResponse.json({ error: 'Failed to create internal user session' }, { status: 500 })
      }
      userId = signUpData.user?.id;
    } else {
      userId = signInData.user?.id;
    }

    if (userId) {
      // Wait 500ms to ensure Supabase's handle_new_user database trigger has finished creating the row
      await new Promise(resolve => setTimeout(resolve, 500));

      const adminAuth = createAdminClient();
      
      // Automatically set their wallet_address in the profiles table (Bypassing RLS)
      const { error: profileError } = await adminAuth
        .from('profiles')
        .update({ wallet_address: walletAddress })
        .eq('id', userId);

      if (profileError) console.error('Admin Profile Update Error:', profileError);

      // Automatically initialize their creator profile so they don't have to manually click "Complete Setup"
      const { error: creatorError } = await adminAuth
        .from('creator_profiles')
        .insert({ user_id: userId })
        // Ignore error if it already exists (duplicate key)
        .select()
        .single();
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
