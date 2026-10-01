import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCircleCredentials } from '@/lib/circle-credentials';

export async function POST(req: Request) {
  try {
    const { email, deviceId, network } = await req.json();

    if (!email || !deviceId) {
        return NextResponse.json(
            { error: 'Email and deviceId are required' },
            { status: 400 }
        );
    }
    if (network && network !== 'arc-mainnet' && network !== 'arc-testnet') {
      return NextResponse.json({ error: 'Invalid network' }, { status: 400 });
    }

    const isMainnet = network === 'arc-mainnet';
    if (isMainnet && !process.env.CIRCLE_API_KEY_MAINNET) {
      return NextResponse.json(
        { error: 'Arc Mainnet is selected, but CIRCLE_API_KEY_MAINNET is missing in Vercel environment variables. Please add it and redeploy.' },
        { status: 500 }
      );
    }

    const apiKey = getCircleCredentials(isMainnet ? 'arc-mainnet' : 'arc-testnet').apiKey;

    const circleUserSdk = initiateUserControlledWalletsClient({ apiKey });

    console.log(`Sending Email OTP to: ${email} for device: ${deviceId} (${network || 'testnet'})`);

    // Call the Circle API to send the OTP
    const response = await circleUserSdk.createDeviceTokenForEmailLogin({
        email: email,
        deviceId: deviceId,
        idempotencyKey: crypto.randomUUID()
    });

    return NextResponse.json(response.data);

  } catch (error: any) {
    const detailedError = error?.response?.data?.message || error?.message || 'Failed to send OTP';
    console.error('Circle OTP Error:', error?.response?.data || error);
    return NextResponse.json(
      { error: detailedError },
      { status: 500 }
    );
  }
}
