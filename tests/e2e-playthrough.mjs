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

// Buttons that aren't the fixed chrome (CTA `.btn` variants, the CareerBar's
// "CARREIRA ↗" topbar link) — i.e. the selectable row/card in whatever screen
// is showing: attr-draft rows use a dedicated testid, but OfferCard (nba
// draft / free agency offers) and Game's moment OptionButton render as bare
// `<button>` with no distinguishing class, so this structural selector is the
// stable way to grab "the first selectable option" on those screens.
function firstOptionBtn(page) {
  return page.locator('.screen button:not(.btn):not(.topbar__link)').first()
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

    // Home's CTA is now `.btn--ink` ("Nova carreira") — `.btn--gold` is gone.
    await page.locator('button.btn--ink', { hasText: 'Nova carreira' }).click()

    log('draft: 8 steals')
    for (let i = 0; i < 8; i++) {
      await page.locator('[data-testid="attr-row"]').first().click()
      await page.locator('button.btn--primary').click()
      await page.waitForTimeout(50)
    }
    await page.screenshot({ path: `${SHOTS_DIR}/02-draft.png` })

    log('build confirm')
    await page.locator('button.btn--primary').click()
    await page.screenshot({ path: `${SHOTS_DIR}/03-build.png` })

    log('nba draft: select first offer, confirm')
    await firstOptionBtn(page).click()
    await page.locator('button.btn--ink').click()

    // Phase markers (all offer/option rows across nbaDraft/freeAgency/moments
    // are bare `<button>` with no shared class now that `.card` is gone), so
    // phases are told apart by unique PT text/markers instead:
    //   keyGame/playoffGame (moment open): button "Simular jogo" (game.simulate)
    //   playoffGame (finals series screen): button /Simular o jogo/ (series.sim)
    //   preseason:      text "NO QUE VOCÊ VAI TRABALHAR" (preseason.work)
    //   freeAgency:     text "O CONTRATO ACABOU" (fa.over) — checked BEFORE the
    //                   generic retire-button branch, since freeAgency can also
    //                   show its own `.btn--outline-red` "hang it up" button
    //   tradeDecision/eventDecision: .modal-veil present
    //   retireDecision: button.btn--outline-red present (pure retire screen)
    //   seasonResult:   text "A TEMPORADA EM CINCO LINHAS" (result.lines)
    //   verdict:        <canvas> present
    let seasons = 0
    let sawSeasonResultShot = false
    let hubCheckedInModal = false
    // Season 1 plays exactly one key game by deciding all 3 moments (option clicks);
    // every other key/playoff game (rest of season 1, every later season, every
    // playoff round, finals) is skipped via "Simular jogo" / "Simular o jogo {n}".
    let decisionClicksLeft = 3
    const MAX_SEASONS = 40 // hard safety cap against infinite loop
    let iterations = 0
    const MAX_ITERATIONS = 1000 // hard safety cap against a stuck sub-loop within one season
    while (seasons < MAX_SEASONS) {
      if (++iterations > MAX_ITERATIONS) {
        console.log(`[error] exceeded ${MAX_ITERATIONS} loop iterations without reaching verdict — stuck phase?`)
        exitCode = 1
        break
      }
      await page.waitForSelector('.screen', { timeout: 10000 })

      if (await page.locator('.modal-veil').count() > 0) {
        if (!hubCheckedInModal) {
          hubCheckedInModal = true
          log('modal decision: hub still reachable above the veil — open via CareerBar, check, close')
          await page.locator('.topbar__link', { hasText: 'CARREIRA' }).click()
          await page.waitForSelector('.hub', { timeout: 5000 })
          const hubVisible = await page.locator('.hub').isVisible()
          console.log(`[assert] hub visible over modal veil: ${hubVisible}`)
          if (!hubVisible) exitCode = 1
          await page.locator('.hub .topbar__link', { hasText: 'FECHAR' }).click()
          await page.waitForTimeout(50)
        }
        log('modal decision (trade/event): choose safe option')
        // reject/stay = the `.btn--outline` inside the crossroads card
        await page.locator('.modal-veil button.btn--outline').click()
        continue
      }

      // Verdict also has a lone `.btn--primary` (the share button), which would
      // otherwise collide with other primary-CTA branches below. Its <canvas>
      // share card is the one marker unique to it — bail out of the loop,
      // verdict is handled explicitly after.
      if (await page.locator('canvas').count() > 0) break

      const simulateGameBtn = page.locator('button', { hasText: 'Simular jogo' })
      if (await simulateGameBtn.count() > 0) {
        if (decisionClicksLeft > 0) {
          log(`keyGame moment: decide (${decisionClicksLeft} left)`)
          await firstOptionBtn(page).click()
          decisionClicksLeft--
        } else {
          log('keyGame/playoffGame: simulate')
          await simulateGameBtn.click()
        }
        continue
      }

      const simulateSeriesBtn = page.locator('button', { hasText: /Simular o jogo/ })
      if (await simulateSeriesBtn.count() > 0) {
        log('finals series screen: simulate rest of series')
        await simulateSeriesBtn.click()
        continue
      }

      if (await page.locator('text=NO QUE VOCÊ VAI TRABALHAR').count() > 0) {
        if (seasons === 1) {
          // Preseason for year 2: first offseason with league history behind it —
          // trades happen 2-4x/year so headlines are guaranteed present here.
          log('preseason (season 2): check league headlines present')
          const newsVisible = await page.locator('.mono-label', { hasText: 'A LIGA HOJE' }).count() > 0
          console.log(`[assert] year 2 headlines visible: ${newsVisible}`)
          if (!newsVisible) exitCode = 1
        }
        log(`preseason (season ${seasons + 1}): default focus, start season`)
        await page.locator('button.btn--primary', { hasText: 'Começar a temporada' }).click()
        seasons++
        continue
      }

      if (await page.locator('text=O CONTRATO ACABOU').count() > 0) {
        log('freeAgency: choose first offer, sign')
        await firstOptionBtn(page).click()
        await page.locator('button.btn--ink').click()
        continue
      }

      if (await page.locator('button.btn--outline-red').count() > 0) {
        log('retireDecision: retire now')
        await page.locator('button.btn--outline-red').click()
        break
      }

      if (await page.locator('text=A TEMPORADA EM CINCO LINHAS').count() > 0) {
        log(`seasonResult (season ${seasons}): advance`)
        if (!sawSeasonResultShot) {
          await page.screenshot({ path: `${SHOTS_DIR}/04-season-result.png` })
          sawSeasonResultShot = true

          log('seasonResult: check balanço-único asserts')
          const livedVisible = await page.locator('text=JOGOS QUE VOCÊ VIVEU').count() > 0
          console.log(`[assert] "jogos que você viveu" visible: ${livedVisible}`)
          if (!livedVisible) exitCode = 1

          const trajectoryVisible = await page.locator('text=LIGA E TRAJETÓRIA').isVisible()
          console.log(`[assert] "liga e trajetória" visible: ${trajectoryVisible}`)
          if (!trajectoryVisible) exitCode = 1

          log('seasonResult: open hub via CareerBar "CARREIRA ↗", check 30 standings rows, close')
          await page.locator('.topbar__link', { hasText: 'CARREIRA' }).click()
          await page.waitForSelector('.hub', { timeout: 5000 })
          const standingsRows = await page.locator('.hub span', { hasText: /^\d+-\d+$/ }).count()
          console.log(`[assert] hub standings rows: ${standingsRows} (expect 30)`)
          if (standingsRows !== 30) exitCode = 1
          await page.locator('.hub .topbar__link', { hasText: 'FECHAR' }).click()
          await page.waitForTimeout(50)
        }
        await page.locator('button.btn--ink', { hasText: 'Avançar' }).click()
        continue
      }

      // verdict screen reached (no matching controls above)
      break
    }

    log('verdict')
    await page.waitForSelector('text=/./', { timeout: 10000 })
    await page.waitForTimeout(300) // let canvas draw
    await page.screenshot({ path: `${SHOTS_DIR}/05-verdict.png` })

    const tierVisible = await page.locator('.headline.headline--red').first().isVisible()
    const shareBtn = page.locator('button.btn--primary')
    const shareVisible = await shareBtn.isVisible()
    console.log(`[assert] tier text visible: ${tierVisible}`)
    console.log(`[assert] share button visible: ${shareVisible}`)
    if (!tierVisible || !shareVisible) exitCode = 1

    // verdict.moments ("Momentos") only renders when the career landed at least one
    // iconic moment — the safe policy played here rarely triggers one (sweep is the
    // one exception), so absence alone isn't a failure; only assert it's visible when
    // ground truth (the save in localStorage) says the career actually has one.
    const momentsTitleVisible = await page.locator('.mono-label.mono-label--red', { hasText: 'Momentos' }).count() > 0
    const hasIconicMoments = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('thegoat:v4')
        const s = raw ? JSON.parse(raw) : null
        return Boolean(s?.career?.seasons?.some(se => (se.iconicMoments ?? []).length > 0))
      } catch {
        return false
      }
    })
    console.log(`[assert] career has iconic moments: ${hasIconicMoments}, Momentos title visible: ${momentsTitleVisible}`)
    if (hasIconicMoments && !momentsTitleVisible) exitCode = 1

    await shareBtn.click().catch(e => console.log(`[info] share click threw (tolerated, likely clipboard): ${e.message}`))
    await page.waitForTimeout(300)

    log('play again')
    await page.locator('button', { hasText: 'Jogar de novo' }).click()
    await page.waitForTimeout(300)
    const backAtHome = await page.locator('button.btn--ink', { hasText: 'Nova carreira' }).first().isVisible()
    console.log(`[assert] back at home after play-again: ${backAtHome}`)
    if (!backAtHome) exitCode = 1

    log('resume flow: start a career, steal once, reload, resume')
    await page.locator('button.btn--ink', { hasText: 'Nova carreira' }).click()
    await page.locator('[data-testid="attr-row"]').first().click()
    await page.locator('button.btn--primary').click()
    await page.reload()
    await page.waitForTimeout(200)
    const inProgressVisible = await page.locator('text=CARREIRA EM ANDAMENTO').isVisible()
    const resumeVisible = await page.locator('text=RETOMAR').isVisible()
    console.log(`[assert] "carreira em andamento" visible after reload: ${inProgressVisible}`)
    console.log(`[assert] "retomar" visible after reload: ${resumeVisible}`)
    if (!inProgressVisible || !resumeVisible) exitCode = 1
    await page.locator('text=RETOMAR').click()
    await page.waitForTimeout(200)
    const backAtDraft = await page.locator('[data-testid="attr-row"]').first().isVisible()
    console.log(`[assert] resumed back into draft: ${backAtDraft}`)
    if (!backAtDraft) exitCode = 1

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
