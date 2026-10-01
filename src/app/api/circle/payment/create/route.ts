import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets';
import { getCircleCredentials, getTreasuryAddress } from '@/lib/circle-credentials';
import { NextResponse } from 'next/server';
import { isArcUsdcToken } from '@/lib/payments/usdc-token';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { z } from 'zod';

const inputSchema = z.object({
  userToken: z.string().min(1),
  walletAddress: z.string().regex(/^0x[0-9a-f]{40}$/i),
  amount: z.coerce.number().min(0.01).max(100),
  query: z.string().min(5),
  network: z.enum(['arc-testnet', 'arc-mainnet']),
});

export async function POST(req: Request) {
  try {
    const parsed = inputSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment request' }, { status: 400 });
    const { userToken, walletAddress, amount, network } = parsed.data;
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Connect your wallet first' }, { status: 401 });
    const { data: profile } = await createAdminClient().from('profiles')
      .select('wallet_address').eq('id', user.id).single();
    if (profile?.wallet_address?.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Payment wallet does not match your login' }, { status: 403 });
    }
    const { data: openAttempt, error: openError } = await createAdminClient().from('research_sessions')
      .select('id').eq('user_id', user.id).eq('network', network)
      .not('funding_challenge_id', 'is', null)
      .in('status', ['awaiting_funding', 'funding_pending', 'active', 'payment_review', 'refund_pending'])
      .limit(1);
    if (openError) return NextResponse.json({ error: 'Could not check existing payments' }, { status: 503 });
    if (openAttempt?.length) return NextResponse.json({ error: 'An earlier payment is still being checked. Do not pay again; open Research to resume it.' }, { status: 409 });
    const networkHeader = req.headers.get('x-network');
    const activeNetwork = network || networkHeader || 'arc-testnet';
    if (activeNetwork !== 'arc-mainnet' && activeNetwork !== 'arc-testnet') {
      return NextResponse.json({ error: 'Invalid network' }, { status: 400 });
    }
    const isMainnet = activeNetwork === 'arc-mainnet';

    let apiKey: string;
    let treasuryAddress: string;
    try {
      const activeNetworkCreds = isMainnet ? 'arc-mainnet' : 'arc-testnet';
      apiKey = getCircleCredentials(activeNetworkCreds).apiKey;
      treasuryAddress = getTreasuryAddress(activeNetworkCreds);
    } catch (credErr: any) {
      return NextResponse.json({ error: credErr.message }, { status: 500 });
    }

    const circleUserSdk = initiateUserControlledWalletsClient({ apiKey });

    // 0. Fetch real walletId from the address
    const walletsRes = await circleUserSdk.listWallets({ userToken });
    const wallet = walletsRes.data?.wallets?.find(w =>
      w.address.toLowerCase() === walletAddress.toLowerCase() && w.blockchain === (isMainnet ? 'ARC' : 'ARC-TESTNET'));
    
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found for this user' }, { status: 404 });
    }

    const walletId = wallet.id;

    // 1. Fetch wallet token balance to get the USDC tokenId
    const balanceRes = await circleUserSdk.getWalletTokenBalance({
      walletId,
      userToken,
    });

    const tokens = balanceRes.data?.tokenBalances || [];
    const usdcToken = tokens.find(t => isArcUsdcToken(t.token, activeNetwork))?.token;

    if (!usdcToken) {
      return NextResponse.json({ error: 'Wallet has no Arc USDC on the selected network' }, { status: 400 });
    }

    // 2. Create the transfer transaction challenge
    const txRes = await circleUserSdk.createTransaction({
      userToken,
      walletId,
      amounts: [amount.toString()],
      destinationAddress: treasuryAddress,
      tokenId: usdcToken.id,
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM'
        }
      }
    });

    if (!txRes.data?.challengeId) {
      return NextResponse.json({ error: 'Failed to generate challenge' }, { status: 500 });
    }
    if (!wallet.userId) return NextResponse.json({ error: 'Circle wallet has no user ID; payment not started' }, { status: 500 });
    // Do not hand the challenge to the browser until its recovery record exists.
    const { data: session, error: sessionError } = await createAdminClient().from('research_sessions')
      .insert({ user_id: user.id, query: parsed.data.query, budget_usdc: amount,
        status: 'awaiting_funding', network: activeNetwork,
        funding_challenge_id: txRes.data.challengeId, circle_user_id: wallet.userId,
        payer_address: walletAddress.toLowerCase() })
      .select('id').single();
    if (sessionError || !session) {
      console.error('Funding record creation failed', sessionError);
      return NextResponse.json({ error: 'Could not record payment attempt; do not approve this challenge' }, { status: 503 });
    }
    return NextResponse.json({ challengeId: txRes.data.challengeId, sessionId: session.id });
  } catch (error: any) {
    console.error('Payment Create Error:', error.response?.data || error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
