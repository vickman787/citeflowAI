// Generates social/brand raster images from the vector logo:
//   src/app/opengraph-image.png  (1200x630 — link previews on X, WhatsApp, Discord, ...)
//   src/app/apple-icon.png       (180x180 — iOS home screen, Safari)
// Usage: node scripts/generate-brand-images.mjs
import sharp from 'sharp'
import { writeFileSync } from 'fs'

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

// ── opengraph-image (1200x630) ──────────────────────────────────
const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${BG}"/>

  <!-- faint scanlines -->
  <g opacity="0.35">
    ${Array.from({ length: 79 }, (_, i) => `<rect x="0" y="${i * 8}" width="1200" height="3" fill="#000000" opacity="0.35"/>`).join('')}
  </g>

  <!-- top signal strip -->
  <rect width="1200" height="8" fill="${GREEN}"/>

  <!-- status line -->
  <circle cx="96" cy="96" r="7" fill="${GREEN}"/>
  <text x="118" y="104" font-family="${MONO}" font-size="22" letter-spacing="4" fill="${DIM}">LIVE ON ARC TESTNET · PAY-PER-CITATION · USDC</text>

  <!-- logo -->
  ${logo(88, 190, 230)}

  <!-- wordmark -->
  <text x="370" y="310" font-family="${MONO}" font-size="96" font-weight="700" fill="${INK}">citeflow<tspan fill="${GREEN}">_ai</tspan></text>

  <!-- tagline -->
  <text x="374" y="382" font-family="${MONO}" font-size="36" fill="${DIM}">Every citation pays its author.</text>

  <!-- terminal footer -->
  <rect x="88" y="484" width="1024" height="66" rx="4" fill="${PANEL}" stroke="rgba(232,237,218,0.14)"/>
  <text x="116" y="526" font-family="${MONO}" font-size="26" fill="${GREEN}">❯</text>
  <text x="148" y="526" font-family="${MONO}" font-size="26" fill="${INK}">ask --grounded --pay-per-citation</text>
  <rect x="640" y="504" width="14" height="30" fill="${GREEN}"/>
  <text x="1084" y="526" font-family="${MONO}" font-size="24" fill="${FAINT}" text-anchor="end">circle w3s</text>
</svg>`

await sharp(Buffer.from(og)).png().toFile('src/app/opengraph-image.png')
console.log('✓ src/app/opengraph-image.png (1200x630)')

writeFileSync('src/app/opengraph-image.alt.txt', 'citeflow_ai — Every citation pays its author. Live on Arc Testnet.')
console.log('✓ src/app/opengraph-image.alt.txt')

// ── apple-icon (180x180) ────────────────────────────────────────
const appleIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
  ${logo(0, 0, 180)}
</svg>`

await sharp(Buffer.from(appleIcon)).png().toFile('src/app/apple-icon.png')
console.log('✓ src/app/apple-icon.png (180x180)')

// ── logo_email.jpg (300x300) ────────────────────────────────────
// Used in third-party email templates (e.g. Circle's OTP/login email —
// see console.circle.com, not something this repo renders). Email clients
// render on a plain white background regardless of app theme, so this
// version sits on white rather than the dark terminal palette.
const INK_DARK = '#141712'
const emailLogo = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
  <rect width="300" height="300" fill="#FFFFFF"/>
  ${logo(78, 40, 144)}
  <text x="150" y="222" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="${INK_DARK}">CiteFlow</text>
  <text x="150" y="248" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="2" text-anchor="middle" fill="#8A8F82">WEB3 AI RESEARCH AGENT</text>
</svg>`

await sharp(Buffer.from(emailLogo)).jpeg({ quality: 92 }).toFile('public/logo_email.jpg')
console.log('✓ public/logo_email.jpg (300x300) — upload this to the Circle Developer Console')
