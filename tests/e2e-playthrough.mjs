// Manual E2E playthrough check — NOT wired into vitest.
// Boots the dev server, plays one full career end-to-end with Playwright/Chromium,
// checks for console errors, and screenshots key phases.
//
// Usage: npm run dev (in another terminal) is NOT required — this script
// spawns its own dev server on an ephemeral flow. Run with:
//   node tests/e2e-playthrough.mjs
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

function killServerTree(server) {
  if (!server || server.pid == null) return
  // On Windows, spawn(..., { shell: true }) makes server.pid the cmd.exe
  // wrapper's pid, not vite's — plain .kill() leaves vite running and holding
  // the port. taskkill /T kills the whole process tree.
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' })
    } catch {
      // already dead
    }
  } else {
    server.kill()
  }
}

const PORT = 5183
const BASE_URL = `http://localhost:${PORT}`
const SHOTS_DIR = '.superpowers/sdd/2026-07-28-the-goat-v1/shots'

mkdirSync(SHOTS_DIR, { recursive: true })

function log(phase) {
  console.log(`[phase] ${phase}`)
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await delay(300)
  }
  throw new Error(`dev server did not come up at ${url} within ${timeoutMs}ms`)
}

async function main() {
  const consoleErrors = []
  let server
  let exitCode = 0

  try {
    server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
      cwd: process.cwd(),
      shell: true,
      stdio: 'pipe',
    })
    server.stdout.on('data', () => {})
    server.stderr.on('data', d => process.stderr.write(`[vite] ${d}`))

    await waitForServer(BASE_URL)
    log('server up')

    const browser = await chromium.launch()

    // ---- Mobile playthrough: 390x844 ----
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[mobile] ${msg.text()}`)
    })
    page.on('pageerror', err => consoleErrors.push(`[mobile pageerror] ${err.message}`))

    await page.goto(BASE_URL)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    log('home')
    await page.screenshot({ path: `${SHOTS_DIR}/01-home.png` })

    // Home has exactly one gold CTA button ("Começar carreira" / "Start career")
    await page.locator('button.btn--gold').click()

    log('draft: 8 steals')
    for (let i = 0; i < 8; i++) {
      await page.locator('button.attr-cell:not(.attr-cell--off)').first().click()
      await page.locator('button.btn--gold').click()
      await page.waitForTimeout(50)
    }
    await page.screenshot({ path: `${SHOTS_DIR}/02-draft.png` })

    log('build confirm')
    await page.locator('button.btn--gold').click()
    await page.screenshot({ path: `${SHOTS_DIR}/03-build.png` })

    log('nba draft: choose first offer')
    await page.locator('.card').first().click()

    // Phase markers (both preseason focus buttons AND OfferCard offers render as
    // a bare `<button class="card">`, so phases are told apart by button.card COUNT,
    // not by text — this stays language-agnostic across pt/en):
    //   preseason:      4x button.card (focus choices)
    //   freeAgency:     N offers as button.card (N < 4, from makeOffers)
    //   tradeDecision/eventDecision: .modal-veil present
    //   retireDecision: button.btn--danger present
    //   seasonResult:   single button.btn--gold, no button.card
    //   verdict:        none of the above
    let seasons = 0
    let sawSeasonResultShot = false
    const MAX_SEASONS = 40 // hard safety cap against infinite loop
    while (seasons < MAX_SEASONS) {
      await page.waitForSelector('.card, .modal-veil, button.btn--gold, button.btn--danger', { timeout: 10000 })

      if (await page.locator('.modal-veil').count() > 0) {
        log('modal decision (trade/event): choose safe option')
        // reject = plain "btn" (not btn--gold) inside the modal
        await page.locator('.modal-veil button.btn:not(.btn--gold)').click()
        continue
      }

      // Verdict also has a lone button.btn--gold (the share button), which would
      // otherwise collide with the seasonResult branch below. Its <canvas> share
      // card is the one marker unique to it — bail out of the loop, verdict is
      // handled explicitly after.
      if (await page.locator('canvas').count() > 0) break

      const cardBtnCount = await page.locator('button.card').count()
      if (cardBtnCount === 4) {
        if (seasons === 1) {
          // Preseason for year 2: first offseason with league history behind it —
          // trades happen 2-4x/year so headlines are guaranteed present here.
          log('preseason (season 2): check league headlines present')
          const newsVisible = await page.locator('.kicker', { hasText: 'Notícias da liga' }).count() > 0
          console.log(`[assert] year 2 headlines visible: ${newsVisible}`)
          if (!newsVisible) exitCode = 1
        }
        log(`preseason (season ${seasons + 1}): choose focus scoring`)
        await page.locator('button.card').first().click()
        seasons++
        continue
      }
      if (cardBtnCount > 0) {
        log('freeAgency: choose first offer')
        await page.locator('button.card').first().click()
        continue
      }

      if (await page.locator('button.btn--danger').count() > 0) {
        log('retireDecision: retire now')
        await page.locator('button.btn--danger').click()
        break
      }

      if (await page.locator('button.btn--gold').count() > 0) {
        log(`seasonResult (season ${seasons}): advance`)
        if (!sawSeasonResultShot) {
          await page.screenshot({ path: `${SHOTS_DIR}/04-season-result.png` })
          sawSeasonResultShot = true

          log('seasonResult: check Tabela/Corridas/Você tabs')
          await page.locator('.chip', { hasText: 'Tabela' }).click()
          await page.waitForTimeout(50)
          const standingsRows = await page.locator('span', { hasText: /^\d+-\d+$/ }).count()
          console.log(`[assert] standings rows: ${standingsRows} (expect 30)`)
          if (standingsRows !== 30) exitCode = 1

          await page.locator('.chip', { hasText: 'Corridas' }).click()
          await page.waitForTimeout(50)
          const raceBlocks = await page.locator('.card').count()
          console.log(`[assert] race blocks: ${raceBlocks} (expect 4)`)
          if (raceBlocks !== 4) exitCode = 1

          await page.locator('.chip', { hasText: 'Você' }).click()
          await page.waitForTimeout(50)
          const ovrVisible = await page.locator('text=OVR atual').first().isVisible()
          console.log(`[assert] OVR visible on Você tab: ${ovrVisible}`)
          if (!ovrVisible) exitCode = 1

          await page.locator('.chip', { hasText: 'Resultado' }).click()
          await page.waitForTimeout(50)
        }
        await page.locator('button.btn--gold').click()
        continue
      }

      // verdict screen reached (no matching controls above)
      break
    }

    log('verdict')
    await page.waitForSelector('text=/./', { timeout: 10000 })
    await page.waitForTimeout(300) // let canvas draw
    await page.screenshot({ path: `${SHOTS_DIR}/05-verdict.png` })

    const tierVisible = await page.locator('.display.goldtext').first().isVisible()
    const shareBtn = page.locator('button.btn--gold', { hasText: /./ }).last()
    const shareVisible = await shareBtn.isVisible()
    console.log(`[assert] tier text visible: ${tierVisible}`)
    console.log(`[assert] share button visible: ${shareVisible}`)
    if (!tierVisible || !shareVisible) exitCode = 1

    await shareBtn.click().catch(e => console.log(`[info] share click threw (tolerated, likely clipboard): ${e.message}`))
    await page.waitForTimeout(300)

    log('play again')
    await page.locator('button.btn:not(.btn--gold)').last().click()
    await page.waitForTimeout(300)
    const backAtHome = await page.locator('button.btn--gold').first().isVisible()
    console.log(`[assert] back at home after play-again: ${backAtHome}`)
    if (!backAtHome) exitCode = 1

    await context.close()

    // ---- Desktop viewport check ----
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const desktopPage = await desktopContext.newPage()
    desktopPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[desktop] ${msg.text()}`)
    })
    desktopPage.on('pageerror', err => consoleErrors.push(`[desktop pageerror] ${err.message}`))
    await desktopPage.goto(BASE_URL)
    await desktopPage.evaluate(() => localStorage.clear())
    await desktopPage.reload()
    await desktopPage.waitForTimeout(300)
    const noHScroll = await desktopPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
    console.log(`[assert] desktop no horizontal scroll: ${noHScroll}`)
    if (!noHScroll) exitCode = 1
    await desktopContext.close()

    await browser.close()

    if (consoleErrors.length > 0) {
      console.log(`\n[console errors] ${consoleErrors.length} found:`)
      for (const e of consoleErrors) console.log(`  - ${e}`)
      exitCode = 1
    } else {
      console.log('\n[console errors] none')
    }
  } finally {
    killServerTree(server)
  }

  console.log(exitCode === 0 ? '\nPLAYTHROUGH OK' : '\nPLAYTHROUGH FAILED')
  process.exit(exitCode)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
