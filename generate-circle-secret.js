const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function generateSecret() {
  const envPath = path.join(__dirname, '.env.local');
  let apiKey = process.env.CIRCLE_API_KEY;

  if (!apiKey && fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    const match = envFile.match(/CIRCLE_API_KEY=["']?([^"'\r\n]+)["']?/);
    if (match) {
      apiKey = match[1];
    }
  }

  if (!apiKey) {
    console.error('❌ Error: Could not find CIRCLE_API_KEY.');
    process.exit(1);
  }

  try {
    console.log('Fetching Circle Public Key using your API key...');
    const response = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch public key');

    const publicKeyPem = data.data.publicKey;
    
    // Generate exactly 32 bytes of random data (Buffer)
    const rawSecretBuffer = crypto.randomBytes(32);
    const hexSecret = rawSecretBuffer.toString('hex'); // The hex representation to save
    
    // Encrypt the EXACT 32 bytes (not the hex string) using Circle's Public Key
    const encryptedData = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      rawSecretBuffer
    );

    const entitySecretCiphertext = encryptedData.toString('base64');

    fs.writeFileSync('circle-secret.txt', `--- EXACT CIPHERTEXT (Paste this into the Web UI and your .env.local) ---\n${entitySecretCiphertext}\n\n--- RAW ENTITY SECRET (Store this safely in a password manager!) ---\n${hexSecret}\n`);

    console.log('\n✅ Successfully generated your Entity Secret!');
    console.log('⚠️ I have saved the exact string to "circle-secret.txt".');
    console.log('Please open that file, copy the ciphertext, and register it!');
    
  } catch (error) {
    console.error('\n❌ Error generating secret:', error.message);
  }
}

generateSecret();
