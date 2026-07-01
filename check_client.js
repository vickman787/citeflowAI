const { initiateUserControlledWalletsClient } = require('@circle-fin/user-controlled-wallets');
const client = initiateUserControlledWalletsClient({apiKey: '123'});
console.log(Object.keys(client));
// Let's check what methods are on client directly or prototype
for (const key in client) {
  if (typeof client[key] === 'function') console.log(key);
}
