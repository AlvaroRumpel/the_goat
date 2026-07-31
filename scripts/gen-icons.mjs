// scripts/gen-icons.mjs — one-off: node scripts/gen-icons.mjs
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const jobs = [
  { src: 'public/icon-master.svg', out: 'public/icon-512.png', size: 512 },
  { src: 'public/icon-master.svg', out: 'public/icon-192.png', size: 192 },
  { src: 'public/favicon.svg', out: 'public/favicon-32.png', size: 32 },
  { src: 'public/favicon.svg', out: 'public/favicon-16.png', size: 16 },
]
const browser = await chromium.launch()
for (const { src, out, size } of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const svg = readFileSync(resolve(src), 'utf8')
  await page.setContent(`<!doctype html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
  await page.screenshot({ path: resolve(out), clip: { x: 0, y: 0, width: size, height: size } })
  console.log(out)
  await page.close()
}
await browser.close()
