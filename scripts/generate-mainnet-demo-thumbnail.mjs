import sharp from 'sharp';
import fs from 'fs';

const W = 1920;
const H = 1080;

const GREEN = '#C6FF4D';
const BG = '#0B0D09';
const PANEL = '#12150E';
const PANEL_HEADER = '#171B12';
const BORDER = '#2A2E22';
const INK = '#E8EDDA';
const DIM = '#9BA588';
const FAINT = '#5A6350';
const MONO = "Consolas, 'Courier New', monospace";

const logo = (x, y, s) => `
  <g transform="translate(${x},${y}) scale(${s / 512})">
    <rect width="512" height="512" rx="118" fill="${GREEN}"/>
    <path d="M133,172 h96 v72 h-48 v32 h48 v64 h-96 z" fill="${BG}"/>
    <path d="M283,172 h96 v72 h-48 v32 h48 v64 h-96 z" fill="${BG}"/>
  </g>`;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="topGlow" cx="20%" cy="10%" r="60%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.14"/>
      <stop offset="60%" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cardGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#192411"/>
      <stop offset="100%" stop-color="${PANEL}"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.85"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#topGlow)"/>

  <!-- Subtle High Tech Grid -->
  <g opacity="0.08">
    ${Array.from({ length: 32 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="${H}" stroke="${GREEN}" stroke-width="1"/>`).join('')}
    ${Array.from({ length: 18 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="${W}" y2="${i * 60}" stroke="${GREEN}" stroke-width="1"/>`).join('')}
  </g>

  <!-- Top Accent Bar -->
  <rect x="0" y="0" width="${W}" height="8" fill="${GREEN}"/>

  <!-- Brand Lockup (Top Left) -->
  ${logo(80, 56, 100)}
  <text x="200" y="128" font-family="${MONO}" font-size="52" font-weight="700" fill="${INK}" letter-spacing="2">citeflow<tspan fill="${GREEN}">_ai</tspan></text>

  <!-- Top Badges (Top Right) -->
  <!-- Arc Mainnet Badge -->
  <g transform="translate(1330, 56)">
    <rect width="260" height="66" rx="8" fill="${PANEL}" stroke="${GREEN}" stroke-width="2"/>
    <circle cx="34" cy="33" r="10" fill="${GREEN}"/>
    <text x="60" y="42" font-family="${MONO}" font-size="24" font-weight="700" fill="${GREEN}" letter-spacing="1">ARC MAINNET</text>
  </g>

  <!-- USDC Badge -->
  <g transform="translate(1620, 56)">
    <rect width="220" height="66" rx="8" fill="${PANEL}" stroke="${BORDER}" stroke-width="2"/>
    <circle cx="36" cy="33" r="16" fill="${GREEN}"/>
    <text x="36" y="41" font-family="${MONO}" font-size="20" font-weight="700" fill="${BG}" text-anchor="middle">$</text>
    <text x="68" y="42" font-family="${MONO}" font-size="24" font-weight="700" fill="${INK}">USDC</text>
  </g>

  <!-- Left Side: Hero Title -->
  <g transform="translate(80, 240)">
    <!-- Overline Category -->
    <rect x="0" y="0" width="380" height="42" rx="6" fill="#151A10" stroke="${BORDER}" stroke-width="1"/>
    <text x="16" y="28" font-family="${MONO}" font-size="18" font-weight="700" fill="${GREEN}" letter-spacing="2">AUTONOMOUS RESEARCH AGENT</text>

    <!-- Huge Typography -->
    <g font-family="${MONO}" font-weight="700" fill="${INK}">
      <text x="0" y="170" font-size="118" letter-spacing="-1">AI RESEARCH</text>
      <text x="0" y="295" font-size="118" letter-spacing="-1">THAT <tspan fill="${GREEN}">PAYS</tspan></text>
      <text x="0" y="420" font-size="118" letter-spacing="-1">ITS SOURCES</text>
    </g>

    <!-- Subtitle -->
    <text x="0" y="490" font-family="${MONO}" font-size="30" font-weight="400" fill="${DIM}">Every citation settles on Arc Mainnet in real time.</text>

    <!-- Tech Badges Row -->
    <g transform="translate(0, 550)">
      <!-- Badge 1 -->
      <g transform="translate(0,0)">
        <rect width="210" height="50" rx="6" fill="${PANEL}" stroke="${BORDER}" stroke-width="1.5"/>
        <text x="105" y="32" font-family="${MONO}" font-size="18" font-weight="700" fill="${INK}" text-anchor="middle">Chain ID 5042</text>
      </g>
      <!-- Badge 2 -->
      <g transform="translate(230,0)">
        <rect width="250" height="50" rx="6" fill="${PANEL}" stroke="${BORDER}" stroke-width="1.5"/>
        <text x="125" y="32" font-family="${MONO}" font-size="18" font-weight="700" fill="${INK}" text-anchor="middle">Circle Agent Wallets</text>
      </g>
      <!-- Badge 3 -->
      <g transform="translate(500,0)">
        <rect width="210" height="50" rx="6" fill="${PANEL}" stroke="${BORDER}" stroke-width="1.5"/>
        <text x="105" y="32" font-family="${MONO}" font-size="18" font-weight="700" fill="${INK}" text-anchor="middle">x402 Batching</text>
      </g>
    </g>
  </g>

  <!-- Right Side: Live Terminal Card -->
  <g transform="translate(1000, 220)" filter="url(#shadow)">
    <!-- Terminal Outer Frame -->
    <rect width="840" height="690" rx="16" fill="${PANEL}" stroke="${BORDER}" stroke-width="2"/>

    <!-- Terminal Header Bar -->
    <path d="M0,16 Q0,0 16,0 L824,0 Q840,0 840,16 L840,64 L0,64 Z" fill="${PANEL_HEADER}"/>
    <line x1="0" y1="64" x2="840" y2="64" stroke="${BORDER}" stroke-width="1.5"/>

    <!-- Window Dots -->
    <circle cx="36" cy="32" r="7" fill="${GREEN}"/>
    <circle cx="62" cy="32" r="7" fill="${FAINT}"/>
    <circle cx="88" cy="32" r="7" fill="#202619"/>

    <!-- Terminal Title -->
    <text x="120" y="40" font-family="${MONO}" font-size="20" font-weight="700" fill="${DIM}">terminal: session 91229693 (Arc Mainnet)</text>

    <!-- Terminal Content Lines -->
    <g transform="translate(36, 110)" font-family="${MONO}">
      <!-- Line 1 -->
      <text x="0" y="0" font-size="20" fill="${FAINT}">[001]</text>
      <text x="80" y="0" font-size="20" fill="${DIM}">query: <tspan fill="${INK}">"How CiteFlow AI compensates authors"</tspan></text>

      <!-- Line 2 -->
      <text x="0" y="44" font-size="20" fill="${FAINT}">[002]</text>
      <text x="80" y="44" font-size="20" fill="${DIM}">budget authorized: <tspan fill="${GREEN}">$0.50 USDC</tspan> · evaluating sources…</text>

      <!-- Line 3 -->
      <text x="0" y="88" font-size="20" fill="${FAINT}">[003]</text>
      <text x="80" y="88" font-size="20" fill="${INK}">CiteFlowAI: The Research Agent That Pays Its Sources</text>
      <text x="80" y="116" font-size="17" fill="${GREEN}">relevance 0.94 · ownership verified on-chain</text>

      <!-- Line 4 -->
      <text x="0" y="160" font-size="20" fill="${FAINT}">[004]</text>
      <text x="80" y="160" font-size="20" fill="${DIM}">generating grounded synthesis · x402 batch active…</text>
    </g>

    <!-- Settlement Highlight Box (Inside Terminal) -->
    <g transform="translate(36, 330)">
      <rect width="768" height="200" rx="12" fill="url(#cardGlow)" stroke="${GREEN}" stroke-width="2"/>
      
      <!-- Checkmark + Tag -->
      <circle cx="44" cy="44" r="16" fill="${GREEN}"/>
      <text x="44" y="52" font-family="${MONO}" font-size="22" font-weight="700" fill="${BG}" text-anchor="middle">✓</text>
      <text x="74" y="51" font-family="${MONO}" font-size="22" font-weight="700" fill="${GREEN}" letter-spacing="1">SETTLED ON ARC MAINNET</text>

      <!-- Mini Transaction Hash (Top Right inside box) -->
      <g transform="translate(480, 28)">
        <rect width="250" height="34" rx="6" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
        <text x="125" y="23" font-family="${MONO}" font-size="14" fill="${DIM}" text-anchor="middle">tx: 67c741c4...dac0</text>
      </g>

      <!-- Amount -->
      <text x="44" y="126" font-family="${MONO}" font-size="64" font-weight="700" fill="${INK}">+$0.50 <tspan font-size="36" fill="${GREEN}">USDC</tspan></text>
      <text x="44" y="168" font-family="${MONO}" font-size="20" fill="${DIM}">Paid directly to creator wallet in real time</text>
    </g>

    <!-- Terminal Footer Status -->
    <g transform="translate(36, 580)">
      <rect width="768" height="70" rx="8" fill="#151A10" stroke="${BORDER}" stroke-width="1"/>
      <circle cx="28" cy="35" r="7" fill="${GREEN}"/>
      <text x="48" y="42" font-family="${MONO}" font-size="19" font-weight="700" fill="${INK}">Circle Gateway x402</text>
      <text x="740" y="42" font-family="${MONO}" font-size="18" fill="${DIM}" text-anchor="end">Sub second Finality · Arc Mainnet</text>
    </g>
  </g>

  <!-- Bottom Brand Footer Strip -->
  <g transform="translate(80, 970)">
    <rect width="1760" height="66" rx="8" fill="${PANEL}" stroke="${BORDER}" stroke-width="1.5"/>
    <text x="32" y="42" font-family="${MONO}" font-size="26" font-weight="700" fill="${GREEN}">❯</text>
    <text x="64" y="42" font-family="${MONO}" font-size="24" font-weight="700" fill="${INK}">citeflowai.xyz</text>
    <text x="300" y="42" font-family="${MONO}" font-size="22" fill="${DIM}">· Pay per prompt research for humans and autonomous agents</text>
    <text x="1728" y="42" font-family="${MONO}" font-size="22" font-weight="700" fill="${GREEN}" text-anchor="end">LIVE ON ARC MAINNET</text>
  </g>
</svg>`;

async function run() {
  const buffer = Buffer.from(svg);

  // 1. Full HD 1920x1080 PNG
  await sharp(buffer).png().toFile('public/mainnet-demo-thumbnail.png');
  console.log('✓ Created public/mainnet-demo-thumbnail.png (1920x1080)');

  // 2. High-res JPEG
  await sharp(buffer).jpeg({ quality: 95 }).toFile('public/mainnet-demo-thumbnail.jpg');
  console.log('✓ Created public/mainnet-demo-thumbnail.jpg (1920x1080)');

  // 3. YouTube standard 1280x720 PNG
  await sharp(buffer).resize(1280, 720).png().toFile('public/social/citeflow-youtube-thumbnail.png');
  console.log('✓ Created public/social/citeflow-youtube-thumbnail.png (1280x720)');
}

run().catch(console.error);
