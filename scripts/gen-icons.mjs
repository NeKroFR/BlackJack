// Renders maskable PWA PNG icons from an inline SVG using headless chromium.
// Run: node scripts/gen-icons.mjs  — writes public/pwa-192.png and public/pwa-512.png.
// No audio/image assets are committed; icons are generated deterministically here.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')

// Maskable-safe: full-bleed felt background (no rounded corners — the platform
// mask supplies the shape) with the spade emblem centered inside the safe zone.
const FELT = '#0b3d2e'
const INK = '#f5f5f0'
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${FELT}"/>
  <g transform="translate(32,39) scale(7)">
    <path d="M32 12c-6 8-14 12-14 20a8 8 0 0 0 12 6.9c-.4 3-1.6 5-3 6.1h10c-1.4-1.1-2.6-3.1-3-6.1A8 8 0 0 0 46 32c0-8-8-12-14-20z" fill="${INK}"/>
  </g>
</svg>`

const targets = [
  { size: 192, file: 'pwa-192.png' },
  { size: 512, file: 'pwa-512.png' },
]

const browser = await chromium.launch()
try {
  for (const { size, file } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    const html = `<!doctype html><html><head><style>*{margin:0;padding:0}</style></head><body>${svg(size)}</body></html>`
    await page.setContent(html, { waitUntil: 'networkidle' })
    const el = await page.$('svg')
    await el.screenshot({ path: resolve(publicDir, file), omitBackground: false })
    await page.close()
    console.log(`wrote public/${file} (${size}x${size})`)
  }
} finally {
  await browser.close()
}
