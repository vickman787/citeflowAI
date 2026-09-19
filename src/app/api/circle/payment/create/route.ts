import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userToken, walletAddress, amount, network } = body;
    const networkHeader = req.headers.get('x-network');
    const activeNetwork = network || networkHeader || 'arc-testnet';
    const isMainnet = activeNetwork === 'arc-mainnet';

    if (!userToken || !walletAddress || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const apiKey = (isMainnet
      ? (process.env.CIRCLE_API_KEY_MAINNET || process.env.CIRCLE_API_KEY)
      : process.env.CIRCLE_API_KEY) as string;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Circle API Key' }, { status: 500 });
    }

    const circleUserSdk = initiateUserControlledWalletsClient({ apiKey });

    // 0. Fetch real walletId from the address
    const walletsRes = await circleUserSdk.listWallets({ userToken });
    const wallet = walletsRes.data?.wallets?.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());
    
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
    // Assuming the user has USDC. In a real scenario, we'd check symbol === 'USDC'
    const usdcToken = tokens.length > 0 ? tokens[0].token : null;

    if (!usdcToken) {
      return NextResponse.json({ error: 'Wallet has no tokens to pay with' }, { status: 400 });
    }

    // 2. Create the transfer transaction challenge
    const treasuryAddress = isMainnet
      ? (process.env.AGENT_TREASURY_ADDRESS_MAINNET || process.env.AGENT_TREASURY_ADDRESS)
      : process.env.AGENT_TREASURY_ADDRESS;
    
    if (!treasuryAddress) {
      throw new Error("AGENT_TREASURY_ADDRESS is not configured");
    }

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

    return NextResponse.json({ challengeId: txRes.data.challengeId });
  } catch (error: any) {
    console.error('Payment Create Error:', error.response?.data || error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
