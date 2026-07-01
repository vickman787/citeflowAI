require('dotenv').config({ path: '.env.local' });
const { initiateUserControlledWalletsClient } = require('@circle-fin/user-controlled-wallets');
const crypto = require('crypto');

async function test() {
  const client = initiateUserControlledWalletsClient({ apiKey: process.env.CIRCLE_API_KEY });
  try {
    const res = await client.createWallet({
        userToken: "dummy-user-token",
        blockchains: ['ARC-TESTNET'],
        accountType: 'EOA',
        idempotencyKey: crypto.randomUUID()
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    if (e.response && e.response.data) {
        console.error("CIRCLE ERROR:", JSON.stringify(e.response.data, null, 2));
    } else {
        console.error("OTHER ERROR:", e.message);
    }
  }
}
test();
