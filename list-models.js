require('dotenv').config({ path: '.env.local' });

async function listModels() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  });
  console.log(await response.json());
}

listModels().catch(console.error);
