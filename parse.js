const fs = require('fs');
const html = fs.readFileSync('C:\\\\Users\\\\pc\\\\.gemini\\\\antigravity\\\\brain\\\\269c3374-a0e7-4d50-9c6d-d692576e4065\\\\.system_generated\\\\steps\\\\1400\\\\content.md', 'utf8');
const match = html.match(/FB_PUBLIC_LOAD_DATA_ = (\[.*?\]);/s);
if (match) {
  try {
    const data = JSON.parse(match[1]);
    const questions = data[1][1].map(q => q[1]);
    console.log(questions.join('\n'));
  } catch (e) {
    console.log('Error parsing JSON');
  }
} else {
  // Try matching <div class="M7eMe">...</div>
  const matches = html.match(/<div class="M7eMe"[^>]*>([^<]+)<\/div>/g);
  if (matches) {
    console.log(matches.map(m => m.replace(/<[^>]+>/g, '')).join('\n'));
  } else {
    // If not, maybe just match any bold text or label text
    const labels = html.match(/class="M7eMe[^>]*>([^<]+)/g);
    if (labels) {
      console.log(labels.map(l => l.split('>')[1]).join('\n'));
    }
  }
}
