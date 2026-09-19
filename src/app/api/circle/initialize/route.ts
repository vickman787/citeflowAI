import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  const { userToken, network, blockchain } = await req.json();

  if (!userToken) {
    return NextResponse.json({ error: 'User Token is required' }, { status: 400 });
  }

  const isMainnet = network === 'arc-mainnet' || blockchain === 'ARC';

  if (isMainnet && !process.env.CIRCLE_API_KEY_MAINNET) {
    return NextResponse.json(
      { error: 'Arc Mainnet is selected, but CIRCLE_API_KEY_MAINNET is missing in Vercel environment variables. Please add it and redeploy.' },
      { status: 500 }
    );
  }

  const apiKey = (isMainnet
    ? (process.env.CIRCLE_API_KEY_MAINNET || process.env.CIRCLE_API_KEY)
    : process.env.CIRCLE_API_KEY) as string;

  const targetChain = blockchain || (isMainnet ? 'ARC' : 'ARC-TESTNET');
  const circleUserSdk = initiateUserControlledWalletsClient({ apiKey });

  try {
    console.log(`Generating challenge for user token on ${targetChain}...`);

    // Call Circle API to generate a challenge for the user to create a wallet
    const response = await circleUserSdk.createUserPinWithWallets({
        userToken: userToken,
        blockchains: [targetChain as any],
        accountType: 'EOA',
        idempotencyKey: crypto.randomUUID()
    });

    return NextResponse.json(response.data);

  } catch (error: any) {
    const errorCode = error?.response?.data?.code || error?.code;
    const errorStatus = error?.response?.status || error?.status;
    
    if (errorCode === 155106 || errorStatus === 409) {
      console.log("User already initialized, fetching existing wallet...");
      try {
        const walletsRes = await circleUserSdk.listWallets({ userToken });
        if (walletsRes.data?.wallets && walletsRes.data.wallets.length > 0) {
          return NextResponse.json({
            address: walletsRes.data.wallets[0].address
          });
        } else {
          const createRes = await circleUserSdk.createWallet({
            userToken,
            blockchains: [targetChain as any],
            accountType: 'EOA',
            idempotencyKey: crypto.randomUUID()
          });
          return NextResponse.json(createRes.data);
        }
      } catch (innerError: any) {
        console.error('Inner Circle Error:', innerError?.response?.data || innerError);
        return NextResponse.json(
          { error: innerError?.response?.data?.message || innerError?.message || 'Failed to fetch existing wallet' },
          { status: 500 }
        );
      }
    }

    const detailedError = error?.response?.data?.message || error?.message || 'Failed to initialize wallet challenge';
    console.error('Circle Initialize Error:', error?.response?.data || error);
    return NextResponse.json(
      { error: detailedError },
      { status: 500 }
    );
  }
}
