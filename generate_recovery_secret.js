require('dotenv').config({ path: '.env.local' });
const { generateEntitySecretCiphertext } = require('@circle-fin/developer-controlled-wallets');
const crypto = require('crypto');

async function run() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const rawEntitySecret = crypto.randomBytes(32).toString('hex');
  const ciphertext = await generateEntitySecretCiphertext({ apiKey, entitySecret: rawEntitySecret });

  console.log('\n=== YOUR NEW RAW SECRET (Save to .env.local) ===');
  console.log(`RAW_ENTITY_SECRET="${rawEntitySecret}"`);

  console.log('\n=== YOUR NEW CIPHERTEXT (Paste into Console) ===');
  console.log(ciphertext);
}
run();
