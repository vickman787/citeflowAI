require('dotenv').config({ path: '.env.local' });
const { initiateUserControlledWalletsClient } = require('@circle-fin/user-controlled-wallets');
const crypto = require('crypto');

async function test() {
  const client = initiateUserControlledWalletsClient({ apiKey: process.env.CIRCLE_API_KEY });
  try {
    const userId = "10332349-3598-4a74-9010-2e7e102c1808"; // existing user
    
    // Create a user token
    const tokenRes = await client.createUserToken({
        userId: userId
    });
    const userToken = tokenRes.data.userToken;

    // Now try to create wallet AND set PIN (which will fail with 409)
    const res = await client.createUserPinWithWallets({
        userToken: userToken,
        blockchains: ['ARC-TESTNET'],
        accountType: 'EOA',
        idempotencyKey: crypto.randomUUID()
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log("e.response.data:", e?.response?.data);
    console.log("e.code:", e.code);
    console.log("e.status:", e.status);
    console.log("e:", e);
  }
}
test();
