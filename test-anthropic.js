const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.match(/ANTHROPIC_API_KEY=["']?([^"'\r\n]+)["']?/)[1].trim();

fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'hello' }]
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
