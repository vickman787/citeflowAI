require('dotenv').config({ path: '.env.local' });
const { generateEntitySecretCiphertext } = require('@circle-fin/developer-controlled-wallets');
const crypto = require('crypto');
const fs = require('fs');

async function run() {
  try {
    const apiKey = process.env.CIRCLE_API_KEY;
    if (!apiKey) throw new Error("Missing CIRCLE_API_KEY");

    let rawEntitySecret = process.env.RAW_ENTITY_SECRET;

    // STEP 1: Generate or load RAW_ENTITY_SECRET
    if (!rawEntitySecret) {
      console.log('1. Generating new 32-byte hex RAW_ENTITY_SECRET...');
      rawEntitySecret = crypto.randomBytes(32).toString('hex');
      
      // Save it immediately so we don't lose it!
      let envData = fs.readFileSync('.env.local', 'utf8');
      envData += `\nRAW_ENTITY_SECRET="${rawEntitySecret}"`;
      fs.writeFileSync('.env.local', envData);
      process.env.RAW_ENTITY_SECRET = rawEntitySecret;
    } else {
      console.log('1. Found existing RAW_ENTITY_SECRET in .env.local');
    }

    console.log('2. Encrypting secret using official Circle helper...');
    const ciphertext = await generateEntitySecretCiphertext({ apiKey, entitySecret: rawEntitySecret });

    console.log('\n======================================================');
    console.log('IMPORTANT: Please copy the following Ciphertext:');
    console.log(ciphertext);
    console.log('======================================================\n');

    // STEP 2: Create WalletSet using pure fetch to bypass SDK bugs
    console.log('3. Trying to create a WalletSet...');
    const walletSetRes = await fetch('https://api.circle.com/v1/w3s/developer/walletSets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        name: 'Treasury WalletSet',
        entitySecretCiphertext: ciphertext
      })
    });
    
    const walletSetData = await walletSetRes.json();
    if (!walletSetRes.ok) {
       console.log('WalletSet Creation Failed:', walletSetData);
       if (walletSetData?.message?.includes('register') || walletSetData?.code === 155101) {
           console.log('\n❌ You must manually register the Ciphertext printed above in the Circle Console!');
           return;
       }
       throw new Error('Failed to create WalletSet');
    }

    const walletSetId = walletSetData.data.walletSet.id;
    console.log(`   -> WalletSet ID: ${walletSetId}`);

    // STEP 3: Create Wallet
    console.log('4. Creating the Treasury Wallet on Polygon Amoy...');
    const walletRes = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        blockchains: ['MATIC-AMOY'],
        walletSetId: walletSetId,
        count: 1,
        entitySecretCiphertext: ciphertext
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

    console.log('5. Updating .env.local...');
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
    console.log('✅ Done! .env.local updated successfully.');

  } catch (error) {
    console.error('Script Error:', error);
  }
}

run();
