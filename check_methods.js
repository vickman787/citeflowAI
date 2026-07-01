require('dotenv').config({ path: '.env.local' });
const { initiateUserControlledWalletsClient } = require('@circle-fin/user-controlled-wallets');
const client = initiateUserControlledWalletsClient({apiKey: '123'});
console.log(client.createTransaction.toString());
