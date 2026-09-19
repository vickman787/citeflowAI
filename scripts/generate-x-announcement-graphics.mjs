import sharp from 'sharp';
import { writeFileSync } from 'fs';

const GREEN = '#C6FF4D';
const BG = '#0C0E0A';
const PANEL = '#12150E';
const PANEL_BORDER = 'rgba(232, 237, 218, 0.12)';
const INK = '#E8EDDA';
const DIM = '#9BA588';
const FAINT = '#5A6350';
const ACCENT = '#FFB454';
const MONO = "'Segoe UI', 'Cascadia Mono', Consolas, monospace";

const logo = (x, y, s) => `
  <g transform="translate(${x},${y}) scale(${s / 512})">
    <rect width="512" height="512" rx="118" fill="${GREEN}"/>
    <path d="M133,172 h96 v72 h-48 v32 h48 v64 h-96 z" fill="${BG}"/>
    <path d="M283,172 h96 v72 h-48 v32 h48 v64 h-96 z" fill="${BG}"/>
  </g>`;

// ─────────────────────────────────────────────────────────────────────────────
// Graphic 1: Main Announcement Banner (1200x675 - 16:9 X Post Optimal)
// ─────────────────────────────────────────────────────────────────────────────
const W = 1200;
const H = 675;

const svg1 = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="cornerGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.16"/>
      <stop offset="50%" stop-color="${GREEN}" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#cornerGlow)"/>

  <!-- Terminal scanlines -->
  <g opacity="0.22">
    ${Array.from({ length: 85 }, (_, i) => `<rect x="0" y="${i * 8}" width="${W}" height="2" fill="#000000" />`).join('')}
  </g>

  <!-- Top signal green bar -->
  <rect width="${W}" height="7" fill="${GREEN}"/>

  <!-- Top Header Navigation / Brand Lockup -->
  <g transform="translate(60, 48)">
    ${logo(0, 0, 46)}
    <text x="62" y="32" font-family="${MONO}" font-size="28" font-weight="700" fill="${INK}" letter-spacing="1">citeflow<tspan fill="${GREEN}">ai</tspan></text>
  </g>

  <!-- Live Mainnet Tag (Top Right) -->
  <g transform="translate(860, 48)">
    <rect width="280" height="46" rx="6" fill="${PANEL}" stroke="${GREEN}" stroke-width="1.5"/>
    <circle cx="26" cy="23" r="6" fill="${GREEN}" filter="url(#glow)"/>
    <text x="44" y="29" font-family="${MONO}" font-size="16" font-weight="700" fill="${GREEN}" letter-spacing="2">ARC MAINNET, LIVE</text>
  </g>

  <!-- Command prompt indicator -->
  <g transform="translate(60, 142)">
    <text font-family="${MONO}" font-size="17" fill="${GREEN}" font-weight="700">~/citeflowai <tspan fill="${FAINT}">$</tspan> <tspan fill="${DIM}">launch arc_mainnet, chain_id 5042</tspan></text>
  </g>

  <!-- Main Headline -->
  <g transform="translate(60, 222)" font-family="${MONO}">
    <text font-size="56" font-weight="800" fill="${INK}" letter-spacing="-1">Every citation <tspan fill="${GREEN}">pays its author</tspan>,</text>
    <text y="68" font-size="56" font-weight="800" fill="${INK}" letter-spacing="-1">now live on Arc Mainnet.</text>
  </g>

  <!-- Subheadline -->
  <text x="60" y="352" font-family="${MONO}" font-size="20" fill="${DIM}">
    Autonomous AI research terminal with real-time USDC micropayments settled on-chain.
  </text>

  <!-- 3 Key Highlights Grid -->
  <g transform="translate(60, 395)">
    <!-- Box 1: Arc Mainnet -->
    <g transform="translate(0, 0)">
      <rect width="345" height="152" rx="6" fill="${PANEL}" stroke="${PANEL_BORDER}"/>
      <rect width="345" height="4" rx="2" fill="${GREEN}"/>
      <text x="24" y="38" font-family="${MONO}" font-size="13" font-weight="700" fill="${GREEN}" letter-spacing="2">01 / ARC MAINNET</text>
      <text x="24" y="74" font-family="${MONO}" font-size="22" font-weight="700" fill="${INK}">Chain ID 5042</text>
      <text x="24" y="106" font-family="${MONO}" font-size="15" fill="${DIM}">Subsecond finality with</text>
      <text x="24" y="128" font-family="${MONO}" font-size="15" fill="${DIM}">real USDC settlement receipts.</text>
    </g>

    <!-- Box 2: Circle W3S -->
    <g transform="translate(366, 0)">
      <rect width="345" height="152" rx="6" fill="${PANEL}" stroke="${PANEL_BORDER}"/>
      <rect width="345" height="4" rx="2" fill="${ACCENT}"/>
      <text x="24" y="38" font-family="${MONO}" font-size="13" font-weight="700" fill="${ACCENT}" letter-spacing="2">02 / CIRCLE W3S</text>
      <text x="24" y="74" font-family="${MONO}" font-size="22" font-weight="700" fill="${INK}">Agent &amp; User Wallets</text>
      <text x="24" y="106" font-family="${MONO}" font-size="15" fill="${DIM}">Embedded non-custodial</text>
      <text x="24" y="128" font-family="${MONO}" font-size="15" fill="${DIM}">Circle Programmable Wallets.</text>
    </g>

    <!-- Box 3: x402 Micropayments -->
    <g transform="translate(732, 0)">
      <rect width="348" height="152" rx="6" fill="${PANEL}" stroke="${PANEL_BORDER}"/>
      <rect width="348" height="4" rx="2" fill="${GREEN}"/>
      <text x="24" y="38" font-family="${MONO}" font-size="13" font-weight="700" fill="${GREEN}" letter-spacing="2">03 / X402 PROTOCOL</text>
      <text x="24" y="74" font-family="${MONO}" font-size="22" font-weight="700" fill="${INK}">Pay Per Prompt</text>
      <text x="24" y="106" font-family="${MONO}" font-size="15" fill="${DIM}">HTTP 402 nanopayments,</text>
      <text x="24" y="128" font-family="${MONO}" font-size="15" fill="${DIM}">no recurring subscriptions.</text>
    </g>
  </g>

  <!-- Bottom Footer Line -->
  <g transform="translate(60, 608)">
    <line x1="0" y1="0" x2="1080" y2="0" stroke="${PANEL_BORDER}" stroke-width="1"/>
    <text x="0" y="34" font-family="${MONO}" font-size="16" font-weight="700" fill="${GREEN}">citeflowai.xyz<tspan fill="${FAINT}">,</tspan></text>
    <text x="135" y="34" font-family="${MONO}" font-size="15" fill="${DIM}">Autonomous Web3 Research Terminal</text>

    <!-- Right-aligned badges -->
    <g transform="translate(740, 16)">
      <rect width="90" height="26" rx="4" fill="${PANEL}" stroke="${PANEL_BORDER}"/>
      <text x="45" y="17" font-family="${MONO}" font-size="11" fill="${DIM}" text-anchor="middle">ARC 5042</text>

      <rect x="100" width="86" height="26" rx="4" fill="${PANEL}" stroke="${PANEL_BORDER}"/>
      <text x="143" y="17" font-family="${MONO}" font-size="11" fill="${DIM}" text-anchor="middle">USDC W3S</text>

      <rect x="196" width="60" height="26" rx="4" fill="${PANEL}" stroke="${PANEL_BORDER}"/>
      <text x="226" y="17" font-family="${MONO}" font-size="11" fill="${GREEN}" text-anchor="middle">X402</text>
    </g>
  </g>
</svg>
`;

// ─────────────────────────────────────────────────────────────────────────────
// Graphic 2: Transaction Flow & Architecture Card (1200x675)
// ─────────────────────────────────────────────────────────────────────────────
const svg2 = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="glow2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.12"/>
      <stop offset="70%" stop-color="${GREEN}" stop-opacity="0"/>
    </linearGradient>
    <filter id="glowF" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <!-- Scanlines -->
  <g opacity="0.2">
    ${Array.from({ length: 85 }, (_, i) => `<rect x="0" y="${i * 8}" width="${W}" height="2" fill="#000000" />`).join('')}
  </g>

  <!-- Top accent bar -->
  <rect width="${W}" height="7" fill="${GREEN}"/>

  <!-- Header -->
  <g transform="translate(60, 48)">
    ${logo(0, 0, 42)}
    <text x="56" y="30" font-family="${MONO}" font-size="24" font-weight="700" fill="${INK}">citeflow<tspan fill="${GREEN}">ai</tspan> <tspan fill="${DIM}" font-size="16">/ ARCHITECTURE, FLOW</tspan></text>
  </g>

  <g transform="translate(860, 48)">
    <rect width="280" height="42" rx="5" fill="${PANEL}" stroke="${GREEN}" stroke-width="1.5"/>
    <circle cx="24" cy="21" r="5" fill="${GREEN}" filter="url(#glowF)"/>
    <text x="40" y="26" font-family="${MONO}" font-size="15" font-weight="700" fill="${GREEN}" letter-spacing="2">ARC MAINNET VERIFIED</text>
  </g>

  <!-- Headline -->
  <g transform="translate(60, 136)" font-family="${MONO}">
    <text font-size="38" font-weight="700" fill="${INK}">The Research Engine That <tspan fill="${GREEN}">Settles Receipts</tspan></text>
    <text y="42" font-size="18" fill="${DIM}">How x402 nanopayments and Circle Wallets pay creators on Arc Mainnet in real time.</text>
  </g>

  <!-- 4-Step Pipeline Flow Diagram -->
  <g transform="translate(60, 235)">
    <!-- Step 1 -->
    <g transform="translate(0, 0)">
      <rect width="245" height="230" rx="8" fill="${PANEL}" stroke="${PANEL_BORDER}" stroke-width="1.5"/>
      <rect width="245" height="5" rx="2" fill="${GREEN}"/>
      <text x="20" y="38" font-family="${MONO}" font-size="13" font-weight="700" fill="${GREEN}">STEP 01</text>
      <text x="20" y="72" font-family="${MONO}" font-size="20" font-weight="700" fill="${INK}">Query, Budget</text>
      <text x="20" y="106" font-family="${MONO}" font-size="14" fill="${DIM}">User defines question,</text>
      <text x="20" y="128" font-family="${MONO}" font-size="14" fill="${DIM}">locks a USDC budget in</text>
      <text x="20" y="150" font-family="${MONO}" font-size="14" fill="${DIM}">Circle Agent Wallet.</text>
      <rect x="20" y="180" width="105" height="24" rx="3" fill="#0C0E0A" stroke="${PANEL_BORDER}"/>
      <text x="72" y="196" font-family="${MONO}" font-size="11" fill="${GREEN}" text-anchor="middle">W3S CLIENT</text>
    </g>

    <!-- Arrow 1 -> 2 -->
    <path d="M255 115 H275" stroke="${GREEN}" stroke-width="3"/>
    <polygon points="275,110 285,115 275,120" fill="${GREEN}"/>

    <!-- Step 2 -->
    <g transform="translate(295, 0)">
      <rect width="245" height="230" rx="8" fill="${PANEL}" stroke="${PANEL_BORDER}" stroke-width="1.5"/>
      <rect width="245" height="5" rx="2" fill="${ACCENT}"/>
      <text x="20" y="38" font-family="${MONO}" font-size="13" font-weight="700" fill="${ACCENT}">STEP 02</text>
      <text x="20" y="72" font-family="${MONO}" font-size="20" font-weight="700" fill="${INK}">Deep Research</text>
      <text x="20" y="106" font-family="${MONO}" font-size="14" fill="${DIM}">Agent reads registered</text>
      <text x="20" y="128" font-family="${MONO}" font-size="14" fill="${DIM}">knowledge corpus via</text>
      <text x="20" y="150" font-family="${MONO}" font-size="14" fill="${DIM}">vector similarity search.</text>
      <rect x="20" y="180" width="115" height="24" rx="3" fill="#0C0E0A" stroke="${PANEL_BORDER}"/>
      <text x="77" y="196" font-family="${MONO}" font-size="11" fill="${ACCENT}" text-anchor="middle">pgvector, RAG</text>
    </g>

    <!-- Arrow 2 -> 3 -->
    <path d="M550 115 H570" stroke="${ACCENT}" stroke-width="3"/>
    <polygon points="570,110 580,115 570,120" fill="${ACCENT}"/>

    <!-- Step 3 -->
    <g transform="translate(590, 0)">
      <rect width="245" height="230" rx="8" fill="${PANEL}" stroke="${PANEL_BORDER}" stroke-width="1.5"/>
      <rect width="245" height="5" rx="2" fill="${GREEN}"/>
      <text x="20" y="38" font-family="${MONO}" font-size="13" font-weight="700" fill="${GREEN}">STEP 03</text>
      <text x="20" y="72" font-family="${MONO}" font-size="20" font-weight="700" fill="${INK}">Citation Settlement</text>
      <text x="20" y="106" font-family="${MONO}" font-size="14" fill="${DIM}">Cited authors get paid</text>
      <text x="20" y="128" font-family="${MONO}" font-size="14" fill="${DIM}">in real USDC instantly</text>
      <text x="20" y="150" font-family="${MONO}" font-size="14" fill="${DIM}">via Circle Gateway.</text>
      <rect x="20" y="180" width="110" height="24" rx="3" fill="#0C0E0A" stroke="${PANEL_BORDER}"/>
      <text x="75" y="196" font-family="${MONO}" font-size="11" fill="${GREEN}" text-anchor="middle">x402 Protocol</text>
    </g>

    <!-- Arrow 3 -> 4 -->
    <path d="M845 115 H865" stroke="${GREEN}" stroke-width="3"/>
    <polygon points="865,110 875,115 865,120" fill="${GREEN}"/>

    <!-- Step 4 -->
    <g transform="translate(885, 0)">
      <rect width="195" height="230" rx="8" fill="${PANEL}" stroke="${PANEL_BORDER}" stroke-width="1.5"/>
      <rect width="195" height="5" rx="2" fill="${GREEN}"/>
      <text x="18" y="38" font-family="${MONO}" font-size="13" font-weight="700" fill="${GREEN}">STEP 04</text>
      <text x="18" y="72" font-family="${MONO}" font-size="20" font-weight="700" fill="${INK}">Arc Ledger</text>
      <text x="18" y="106" font-family="${MONO}" font-size="14" fill="${DIM}">Verifiable proof,</text>
      <text x="18" y="128" font-family="${MONO}" font-size="14" fill="${DIM}">immutable receipt</text>
      <text x="18" y="150" font-family="${MONO}" font-size="14" fill="${DIM}">on Arc Mainnet.</text>
      <rect x="18" y="180" width="110" height="24" rx="3" fill="#0C0E0A" stroke="${PANEL_BORDER}"/>
      <text x="73" y="196" font-family="${MONO}" font-size="11" fill="${GREEN}" text-anchor="middle">CHAIN ID 5042</text>
    </g>
  </g>

  <!-- Bottom Details Strip -->
  <g transform="translate(60, 535)">
    <rect width="1080" height="72" rx="6" fill="${PANEL}" stroke="${PANEL_BORDER}"/>
    <circle cx="36" cy="36" r="16" fill="${GREEN}"/>
    <text x="36" y="42" font-family="${MONO}" font-size="18" font-weight="800" fill="${BG}" text-anchor="middle">$</text>
    <text x="68" y="32" font-family="${MONO}" font-size="15" font-weight="700" fill="${INK}">80% DIRECT CREATOR SHARE</text>
    <text x="68" y="52" font-family="${MONO}" font-size="13" fill="${DIM}">Authors monetize every prompt their work inspires, built for Arc Mainnet Microgrant</text>
    <text x="1050" y="42" font-family="${MONO}" font-size="16" font-weight="700" fill="${GREEN}" text-anchor="end">citeflowai.xyz</text>
  </g>
</svg>
`;

async function run() {
  console.log('Rendering high-res announcement graphics with sharp...');
  
  await sharp(Buffer.from(svg1))
    .png({ quality: 100 })
    .toFile('public/social/citeflow-mainnet-launch-banner.png');
  console.log('✓ public/social/citeflow-mainnet-launch-banner.png (1200x675)');

  await sharp(Buffer.from(svg2))
    .png({ quality: 100 })
    .toFile('public/social/citeflow-mainnet-architecture.png');
  console.log('✓ public/social/citeflow-mainnet-architecture.png (1200x675)');
}

run().catch(console.error);
