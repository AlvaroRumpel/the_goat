// scripts/gen-og.mjs — one-off: node scripts/gen-og.mjs
import { chromium } from 'playwright'
import { resolve } from 'node:path'

const html = `<!doctype html>
<html>
<head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=Archivo+Black&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #EDE6D6; color: #1C1A16; font-family: 'Archivo', sans-serif; padding: 56px 64px 0; display: flex; flex-direction: column; }
  .label { font-family: 'IBM Plex Mono', monospace; font-size: 22px; letter-spacing: 4px; color: #6B6455; }
  .rule { height: 3px; background: #A8231C; margin-top: 10px; }
  .rule + .rule { margin-top: 5px; }
  h1 { font-family: 'Archivo Black', sans-serif; font-size: 176px; line-height: 0.86; letter-spacing: -0.035em; color: #A8231C; margin-top: 44px; }
  .tagline { font-size: 34px; font-weight: 500; margin-top: 30px; max-width: 720px; }
  .foot { margin-top: auto; background: #A8231C; margin-left: -64px; margin-right: -64px; padding: 26px 64px; display: flex; justify-content: space-between; align-items: center; }
  .foot .site { font-family: 'Archivo Black', sans-serif; font-size: 30px; color: #F6F0E4; }
  .foot .hook { font-family: 'IBM Plex Mono', monospace; font-size: 22px; letter-spacing: 4px; color: #F0C4C0; }
</style>
</head>
<body>
  <div class="label">CARREIRA NBA · GRÁTIS · SEM CADASTRO · PT/EN</div>
  <div class="rule"></div><div class="rule"></div>
  <h1>THE<br>GOAT</h1>
  <div class="tagline">Roube atributos das lendas, viva uma carreira inteira e persiga o veredito final.</div>
  <div class="foot"><span class="site">THEGOATGAME.APP</span><span class="hook">CONSEGUE SER O GOAT?</span></div>
</body>
</html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.screenshot({ path: resolve('public/og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } })
console.log('public/og-image.png')
await browser.close()
