require('dotenv').config({ path: '.env.local' });
const { generateEntitySecretCiphertext } = require('@circle-fin/developer-controlled-wallets');
const crypto = require('crypto');
const fs = require('fs');

async function run() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const rawEntitySecret = process.env.RAW_ENTITY_SECRET;
  
  // The WalletSet was already created successfully in the previous run
  const walletSetId = "25ac17a9-a007-57ec-a98c-43348712150a";

  console.log('1. Encrypting secret to generate a completely fresh Ciphertext for the Wallet Creation...');
  const walletCiphertext = await generateEntitySecretCiphertext({ apiKey, entitySecret: rawEntitySecret });

  console.log(`2. Creating the Treasury Wallet on Polygon Amoy inside WalletSet ${walletSetId}...`);
  const walletRes = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      blockchains: ['ARC-TESTNET'],
      walletSetId: walletSetId,
      count: 1,
      entitySecretCiphertext: walletCiphertext
    })
  });

  const walletData = await walletRes.json();
  if (!walletRes.ok) {
    console.log('Wallet Creation Failed:', walletData);
    throw new Error('Failed to create Wallet');
  }

  const newWallet = walletData.data.wallets[0];
  const walletId = newWallet.id;
  const address = newWallet.address;
  console.log(`   -> Wallet ID: ${walletId}`);
  console.log(`   -> Address: ${address}`);

  console.log('3. Updating .env.local...');
  let envData = fs.readFileSync('.env.local', 'utf8');
  
  const updates = { CIRCLE_WALLET_ID: walletId, AGENT_TREASURY_ADDRESS: address };

  for (const [key, val] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envData)) {
      envData = envData.replace(regex, `${key}="${val}"`);
    } else {
      envData += `\n${key}="${val}"`;
    }
  }

  fs.writeFileSync('.env.local', envData);
  console.log('✅ Done! .env.local updated successfully. The Treasury Wallet is officially ready!');
}
run();
