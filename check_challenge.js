const { initiateUserControlledWalletsClient } = require('@circle-fin/user-controlled-wallets');
const client = initiateUserControlledWalletsClient({apiKey: '123'});
const keys = [];
for (let k in client) {
    if (k.toLowerCase().includes('challenge')) {
        keys.push(k);
    }
}
console.log(keys);
