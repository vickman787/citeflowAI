import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, deviceId, network } = await req.json();

    if (!email || !deviceId) {
        return NextResponse.json(
            { error: 'Email and deviceId are required' },
            { status: 400 }
        );
    }

    const apiKey = (network === 'arc-mainnet'
      ? (process.env.CIRCLE_API_KEY_MAINNET || process.env.CIRCLE_API_KEY)
      : process.env.CIRCLE_API_KEY) as string;

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
    console.error('Circle OTP Error:', error?.response?.data || error);
    return NextResponse.json(
      { error: error?.response?.data?.message || 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
