require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function getAppId() {
  try {
    const res = await axios.get('https://api.circle.com/v1/w3s/config/entity', {
      headers: {
        'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`
      }
    });
    console.log("APP ID:", res.data.data.appId);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
getAppId();
