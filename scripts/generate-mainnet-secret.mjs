import fs from 'fs';
import crypto from 'crypto';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const apiKeyMatch = envFile.match(/CIRCLE_API_KEY_MAINNET=["']?([^"'\r\n]+)["']?/);

if (!apiKeyMatch) {
  console.error('❌ CIRCLE_API_KEY_MAINNET not found in .env.local');
  process.exit(1);
}

const apiKey = apiKeyMatch[1];

// 1. Fetch production public key
const pkRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
  headers: { Authorization: `Bearer ${apiKey}` }
});
const pkData = await pkRes.json();
const publicKeyPem = pkData.data.publicKey;

// 2. Generate 32 bytes (64 hex characters)
const rawSecretBuffer = crypto.randomBytes(32);
const hexSecret = rawSecretBuffer.toString('hex');

// 3. Encrypt using Circle Production Public Key
const encryptedData = crypto.publicEncrypt(
  {
    key: publicKeyPem,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  },
  rawSecretBuffer
);
const ciphertext = encryptedData.toString('base64');

// Save to circle-mainnet-secret.txt
fs.writeFileSync(
  'circle-mainnet-secret.txt',
  `=== CIRCLE PRODUCTION ENTITY SECRET ===\n\n` +
  `1. CIPHERTEXT TO PASTE IN CIRCLE CONSOLE:\n${ciphertext}\n\n` +
  `2. RAW ENTITY SECRET (Keep safe!):\n${hexSecret}\n`
);

// Append or update in .env.local
let updatedEnv = envFile;
if (!updatedEnv.includes('RAW_ENTITY_SECRET_MAINNET=')) {
  updatedEnv += `\nRAW_ENTITY_SECRET_MAINNET="${hexSecret}"\n`;
  fs.writeFileSync('.env.local', updatedEnv);
}

console.log('✅ Generated Production Entity Secret!');
console.log('📄 Saved to circle-mainnet-secret.txt');
console.log('🔑 Saved RAW_ENTITY_SECRET_MAINNET to .env.local');
