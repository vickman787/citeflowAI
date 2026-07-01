require('dotenv').config({path: '.env.local'});
const http = require('https');
const req = http.request('https://api.circle.com/v1/w3s/users/emails', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.CIRCLE_API_KEY,
    'Content-Type': 'application/json'
  }
}, res => {
  res.on('data', d => process.stdout.write(d));
});
req.write('{}');
req.end();
