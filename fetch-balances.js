const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.match(/CIRCLE_API_KEY=["']?([^"'\r\n]+)["']?/)[1].trim();
const walletId = env.match(/CIRCLE_WALLET_ID=["']?([^"'\r\n]+)["']?/)[1].trim();

fetch(`https://api.circle.com/v1/w3s/wallets/${walletId}/balances`, {
  headers: { 'Authorization': 'Bearer ' + key }
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)))
.catch(console.error);
