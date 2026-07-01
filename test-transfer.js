const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.match(/CIRCLE_API_KEY=["']?([^"'\r\n]+)["']?/)[1].trim();
const walletId = env.match(/CIRCLE_WALLET_ID=["']?([^"'\r\n]+)["']?/)[1].trim();
const crypto = require('crypto');
const payload = {
  idempotencyKey: crypto.randomUUID(),
  entitySecretCiphertext: 'dummy',
  amounts: ['0.1'],
  destinationAddress: '0x1234567890123456789012345678901234567890',
  feeLevel: 'HIGH',
  walletId: walletId
};
fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2))).catch(console.error);
