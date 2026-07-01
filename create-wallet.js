const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function createWallet() {
  const envPath = path.join(__dirname, '.env.local');
  const secretTxtPath = path.join(__dirname, 'circle-secret.txt');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=["']?([^"'\r\n]+)["']?`));
    return match ? match[1] : null;
  };

  const apiKey = getEnv('CIRCLE_API_KEY');
  let rawSecret = getEnv('RAW_ENTITY_SECRET');

  // If not in .env.local, try to rescue it from circle-secret.txt
  if (!rawSecret && fs.existsSync(secretTxtPath)) {
    const txtContent = fs.readFileSync(secretTxtPath, 'utf-8');
    const lines = txtContent.split('\n');
    const secretLine = lines.find(l => l.length === 64 && !l.includes('-'));
    if (secretLine) {
      rawSecret = secretLine.trim();
    }
  }

  if (!apiKey) {
    console.error('❌ Missing CIRCLE_API_KEY in .env.local');
    process.exit(1);
  }

  if (!rawSecret) {
    console.error('❌ Missing RAW_ENTITY_SECRET. Please add it to your .env.local!');
    process.exit(1);
  }

  // Helper function to dynamically generate fresh ciphertexts!
  async function generateFreshCiphertext() {
    const response = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await response.json();
    const publicKeyPem = data.data.publicKey;
    
    return crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(rawSecret, 'hex') // Convert hex string back to 32 bytes
    ).toString('base64');
  }

  try {
    console.log('1. Creating a Wallet Set for the Treasury...');
    const freshCiphertext1 = await generateFreshCiphertext();
    
    const walletSetRes = await fetch('https://api.circle.com/v1/w3s/developer/walletSets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        entitySecretCiphertext: freshCiphertext1,
        name: 'CiteFlow Agent Treasury'
      })
    });

    const walletSetData = await walletSetRes.json();
    if (!walletSetRes.ok) throw new Error(walletSetData.message || 'Failed to create Wallet Set');
    
    const walletSetId = walletSetData.data.walletSet.id;
    console.log(`✅ Wallet Set Created: ${walletSetId}`);

    console.log('\n2. Generating an EVM Wallet within the Set...');
    const freshCiphertext2 = await generateFreshCiphertext(); // Must generate a NEW one!
    
    const walletRes = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        entitySecretCiphertext: freshCiphertext2,
        blockchains: ['ARC-TESTNET'], 
        count: 1,
        walletSetId: walletSetId
      })
    });

    const walletData = await walletRes.json();
    if (!walletRes.ok) throw new Error(walletData.message || 'Failed to create Wallet');

    const wallet = walletData.data.wallets[0];
    console.log(`✅ Wallet Created Successfully!`);
    console.log(`\n--- ADD THESE TO YOUR .env.local ---`);
    console.log(`CIRCLE_WALLET_ID="${wallet.id}"`);
    console.log(`AGENT_TREASURY_ADDRESS="${wallet.address}"`);
    console.log(`RAW_ENTITY_SECRET="${rawSecret}" (Remove the old CIRCLE_ENTITY_SECRET_CIPHERTEXT)`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

createWallet();
