import fs from 'fs';
import crypto from 'crypto';

const envPath = '.env.local';
const envContent = fs.readFileSync(envPath, 'utf-8');

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`${key}=["']?([^"'\r\n]+)["']?`));
  return match ? match[1].trim() : null;
};

const apiKey = getEnv('CIRCLE_API_KEY_MAINNET');
const rawSecret = getEnv('RAW_ENTITY_SECRET_MAINNET');

if (!apiKey) {
  console.error('❌ Missing CIRCLE_API_KEY_MAINNET in .env.local');
  process.exit(1);
}

if (!rawSecret) {
  console.error('❌ Missing RAW_ENTITY_SECRET_MAINNET in .env.local');
  process.exit(1);
}

async function generateFreshCiphertext() {
  const response = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Failed to fetch Circle public key: ' + JSON.stringify(data));
  const publicKeyPem = data.data.publicKey;

  return crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(rawSecret, 'hex')
  ).toString('base64');
}

async function setupTreasury() {
  try {
    console.log('1. Creating a Wallet Set for the Production Treasury...');
    const ciphertext1 = await generateFreshCiphertext();

    const walletSetRes = await fetch('https://api.circle.com/v1/w3s/developer/walletSets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        entitySecretCiphertext: ciphertext1,
        name: 'CiteFlow Mainnet Treasury'
      })
    });

    const walletSetData = await walletSetRes.json();
    if (!walletSetRes.ok) {
      if (walletSetData.code === 156016) {
        console.error('\n⚠️ Entity secret is not registered yet in the Circle Console.');
        console.error('Please register the ciphertext in Circle Developer Console first.');
        process.exit(1);
      }
      throw new Error(walletSetData.message || JSON.stringify(walletSetData));
    }

    const walletSetId = walletSetData.data.walletSet.id;
    console.log(`✅ Wallet Set Created: ${walletSetId}`);

    console.log('\n2. Generating Arc Mainnet EVM Treasury Wallet...');
    const ciphertext2 = await generateFreshCiphertext();

    // Try ARC blockchain first, fallback to EVM if necessary
    let walletRes = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        entitySecretCiphertext: ciphertext2,
        blockchains: ['ARC'],
        count: 1,
        walletSetId: walletSetId
      })
    });

    let walletData = await walletRes.json();
    if (!walletRes.ok) {
      console.warn('ARC blockchain call returned:', walletData.message, '- attempting with EVM standard...');
      const ciphertext3 = await generateFreshCiphertext();
      walletRes = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          entitySecretCiphertext: ciphertext3,
          blockchains: ['EVM'],
          count: 1,
          walletSetId: walletSetId
        })
      });
      walletData = await walletRes.json();
      if (!walletRes.ok) {
        throw new Error(walletData.message || JSON.stringify(walletData));
      }
    }

    const wallet = walletData.data.wallets[0];
    console.log(`✅ Production Treasury Wallet Created!`);
    console.log(`Address: ${wallet.address}`);
    console.log(`Wallet ID: ${wallet.id}`);

    // Update .env.local
    let updated = fs.readFileSync(envPath, 'utf-8');
    if (!updated.includes('CIRCLE_WALLET_ID_MAINNET=')) {
      updated += `CIRCLE_WALLET_ID_MAINNET="${wallet.id}"\n`;
    }
    if (!updated.includes('AGENT_TREASURY_ADDRESS_MAINNET=')) {
      updated += `AGENT_TREASURY_ADDRESS_MAINNET="${wallet.address}"\n`;
    }
    fs.writeFileSync(envPath, updated);
    console.log('✅ Updated .env.local with production treasury wallet details!');

  } catch (error) {
    console.error('\n❌ Setup Error:', error.message || error);
  }
}

setupTreasury();
