// Generates a YouTube thumbnail (1280x720) for the CiteFlowAI demo video,
// matching the brand system used by generate-brand-images.mjs.
// Usage: node scripts/generate-youtube-thumbnail.mjs
import sharp from 'sharp'

const GREEN = '#C6FF4D'
const BG = '#0C0E0A'
const PANEL = '#12150E'
const INK = '#E8EDDA'
const DIM = '#9BA588'
const FAINT = '#5A6350'
const MONO = "Consolas, 'Courier New', monospace"

const logo = (x, y, s) => `
  <g transform="translate(${x},${y}) scale(${s / 512})">
    <rect width="512" height="512" rx="118" fill="${GREEN}"/>
    <path d="M133,172 h96 v72 h-48 v32 h48 v64 h-96 z" fill="${BG}"/>
    <path d="M283,172 h96 v72 h-48 v32 h48 v64 h-96 z" fill="${BG}"/>
  </g>`

const W = 1280
const H = 720

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.14"/>
      <stop offset="60%" stop-color="${GREEN}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- corner glow -->
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- faint scanlines -->
  <g opacity="0.30">
    ${Array.from({ length: 90 }, (_, i) => `<rect x="0" y="${i * 8}" width="${W}" height="3" fill="#000000" opacity="0.40"/>`).join('')}
  </g>

  <!-- top signal strip -->
  <rect width="${W}" height="10" fill="${GREEN}"/>

  <!-- brand lockup -->
  ${logo(64, 58, 130)}
  <text x="220" y="150" font-family="${MONO}" font-size="62" font-weight="700" fill="${INK}">citeflow<tspan fill="${GREEN}">_ai</tspan></text>

  <!-- USDC badge top right -->
  <g transform="translate(1000,58)">
    <rect width="216" height="76" rx="8" fill="${PANEL}" stroke="${GREEN}" stroke-width="2"/>
    <circle cx="44" cy="38" r="22" fill="${GREEN}"/>
    <text x="44" y="47" font-family="${MONO}" font-size="26" font-weight="700" fill="${BG}" text-anchor="middle">$</text>
    <text x="80" y="48" font-family="${MONO}" font-size="32" font-weight="700" fill="${INK}">USDC</text>
  </g>

  <!-- headline -->
  <g font-family="${MONO}" font-weight="700" fill="${INK}">
    <text x="64" y="330" font-size="112">AI RESEARCH</text>
    <text x="64" y="448" font-size="112">THAT <tspan fill="${GREEN}">PAYS</tspan></text>
    <text x="64" y="566" font-size="112">ITS SOURCES</text>
  </g>

  <!-- terminal footer -->
  <rect x="64" y="612" width="1152" height="66" rx="6" fill="${PANEL}" stroke="rgba(232,237,218,0.14)" stroke-width="1.5"/>
  <text x="92" y="654" font-family="${MONO}" font-size="30" fill="${GREEN}">&#10095;</text>
  <text x="126" y="654" font-family="${MONO}" font-size="30" fill="${INK}">every citation pays its author</text>
  <text x="1184" y="654" font-family="${MONO}" font-size="26" fill="${DIM}" text-anchor="end">live on Arc Testnet</text>
</svg>`

await sharp(Buffer.from(svg)).png().toFile('public/social/citeflow-youtube-thumbnail.png')
console.log('✓ public/social/citeflow-youtube-thumbnail.png (1280x720)')
