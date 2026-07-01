require('dotenv').config({ path: '.env.local' });
const { initiateUserControlledWalletsClient } = require('@circle-fin/user-controlled-wallets');

async function test() {
  const client = initiateUserControlledWalletsClient({ apiKey: process.env.CIRCLE_API_KEY });
  try {
    const res = await client.createDeviceTokenForEmailLogin({
      email: 'vickmancrypto@gmail.com',
      deviceId: require('crypto').randomUUID(),
      idempotencyKey: require('crypto').randomUUID()
    });
    console.log("RESPONSE DATA:", JSON.stringify(res.data, null, 2));
  } catch (e) {
    if (e.response && e.response.data) {
        console.error(JSON.stringify(e.response.data, null, 2));
    } else {
        console.error(e);
    }
  }
}
test();
