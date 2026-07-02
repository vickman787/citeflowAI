require('dotenv').config({ path: '.env.local' });

async function test() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 700,
      system: 'You must return a valid JSON object matching the requested schema. Output only the raw JSON without any markdown code blocks.',
      messages: [{ role: 'user', content: "Hello" }]
    })
  });
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

test().catch(console.error);
