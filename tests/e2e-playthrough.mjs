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

async function waitForServer(url, timeoutMs = 60000) {
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
// is showing: attr-draft rows use a dedicated testid, and OfferCard (nba
// draft / free agency offers) renders as a bare `<button>` with no
// distinguishing class, so this structural selector is the stable way to
// grab "the first selectable option" on those screens. (Game's moment
// decisions use the dedicated `.game-option` class instead — see below.)
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
    // reducedMotion: 'reduce' makes the play-log reveal instant (usePlayReveal jumps
    // `shown` straight to `target`) instead of typing character-by-character — without
    // it, timing-dependent asserts below would race the animation. It still pauses at
    // each decision moment; it does not reveal the whole game log at once.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
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

    // Phase markers (all offer rows across nbaDraft/freeAgency are bare
    // `<button>` with no shared class now that `.card` is gone), so phases
    // are told apart by unique PT text/markers instead:
    //   seasonAdvance (6b): text "A TEMPORADA CORRE" (advance.title)
    //   gameResult (6a):    text "PLACAR FINAL" (result.final)
    //   keyGame/playoffGame (moment open): button "SIMULAR O RESTO DO JOGO" (game.simulate)
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
    let sawSeasonAdvanceShot = false
    let sawGameResultShot = false
    let sawKeyGameShot = false
    let hubCheckedInModal = false
    // Season 1 plays exactly one key game by deciding every moment (2-5, count varies
    // by game — see engine/moments.ts momentCount); every other key/playoff game (rest
    // of season 1, every later season, every playoff round, finals) is skipped via
    // "Simular jogo" / "Simular o jogo {n}".
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

      // seasonAdvance (6b): primeira temporada assume os jogos; depois corre até os playoffs
      if (await page.locator('text=A TEMPORADA CORRE').count() > 0) {
        if (!sawSeasonAdvanceShot) {
          sawSeasonAdvanceShot = true
          await page.screenshot({ path: `${SHOTS_DIR}/08-season-advance.png` })
          const tickerVisible = await page.locator('text=PLACARES ENTRANDO').count() > 0
          console.log(`[assert] seasonAdvance "placares entrando" visible: ${tickerVisible}`)
          if (!tickerVisible) exitCode = 1
        }
        if (seasons <= 1) {
          log('seasonAdvance: take next key game')
          await page.locator('button.btn--ink', { hasText: 'Assumir' }).click()
        } else {
          log('seasonAdvance: run to playoffs')
          await page.locator('button.btn--outline', { hasText: 'Correr' }).click()
        }
        continue
      }

      // gameResult (6a): sempre presente após jogo assistido/skipado
      if (await page.locator('text=PLACAR FINAL').count() > 0) {
        if (!sawGameResultShot) {
          sawGameResultShot = true
          await page.screenshot({ path: `${SHOTS_DIR}/07-game-result.png` })
          const decidedVisible = await page.locator('text=O QUE VOCÊ DECIDIU').count() > 0
          console.log(`[assert] first gameResult "o que você decidiu" visible: ${decidedVisible}`)
          if (!decidedVisible) exitCode = 1
        }
        log('gameResult: continue')
        await page.locator('button.btn--ink').click()
        continue
      }

      // keyGame/playoffGame moment screen — the simulate-rest button lives inside
      // `.game-decision`; there's also a desktop-only `.game-desktop-hint` button
      // with the same text (hidden <900px but still in the DOM), so the locator
      // must be scoped or it hits Playwright's strict-mode "multiple elements" error.
      const simulateGameBtn = page.locator('.game-decision button', { hasText: 'SIMULAR O RESTO DO JOGO' })
      if (await simulateGameBtn.count() > 0) {
        const isFirstKeyGame = !sawKeyGameShot
        if (!sawKeyGameShot) {
          sawKeyGameShot = true
          await page.screenshot({ path: `${SHOTS_DIR}/06-keygame.png` })
          const playCount = await page.locator('.game-play').count()
          const momentCardCount = await page.locator('.moment-card').count()
          // Invariant, not a magic number: usePlayReveal only reveals log lines whose
          // `at` is strictly before the first pending moment's `at`. The first moment
          // is always at minute FIRST_AT=10 (engine/moments.ts), and the log's only
          // two ambient lines placed before minute 10 are fixed at minute 3 and minute
          // FIRST_AT-4=6 — true for every game regardless of its moment count (2-5).
          // So exactly 2 lines are revealed here, always, before the decision panel
          // opens. (With reducedMotion the reveal already jumped straight to target.)
          console.log(`[assert] first keyGame play-log lines revealed pre-decision: ${playCount} (expect exactly 2)`)
          console.log(`[assert] first keyGame moment cards: ${momentCardCount} (expect 2..5)`)
          if (playCount !== 2) exitCode = 1
          if (momentCardCount < 2 || momentCardCount > 5) exitCode = 1
        }
        if (isFirstKeyGame) {
          log('keyGame: decide every moment of the first game — except clutch, which is left to expire (I-3)')
          while (await page.locator('.game-option').first().isVisible().catch(() => false)) {
            // clutch is always the last moment (engine/moments.ts slotsFor); its label
            // ("0:21 · CLUTCH") is present on `.moment-card--now` regardless of
            // timePressure. timePressure defaults to true and is never toggled in this
            // run, so ClutchTimer is mounted here — this is the spec §8 promise ("o
            // estouro do cronômetro no clutch") that had zero coverage before this fix.
            const atClutch = await page.locator('.moment-card--now', { hasText: 'CLUTCH' }).count() > 0
            if (atClutch) {
              const timerVisible = await page.locator('.clutch-timer').isVisible()
              console.log(`[assert] clutch timer visible at the clutch moment: ${timerVisible}`)
              if (!timerVisible) exitCode = 1

              const clutchInfo = await page.evaluate(() => {
                const raw = localStorage.getItem('thegoat:v6')
                const s = raw ? JSON.parse(raw) : null
                const pending = s?.pendingGame
                const moment = pending?.moments?.[pending.momentIndex]
                return {
                  safeOptionId: moment?.options?.find(o => o.risk === 'safe')?.id ?? null,
                  momentsCount: pending?.moments?.length ?? null,
                }
              })

              log('keyGame: NOT clicking the clutch options — waiting out the 8s timer instead')
              await page.waitForTimeout(8600)

              const autoAdvanced = await page.locator('text=PLACAR FINAL').count() > 0
              console.log(`[assert] clutch expiry auto-advanced past the decision without a click: ${autoAdvanced}`)
              if (!autoAdvanced) exitCode = 1

              const after = await page.evaluate(() => {
                const raw = localStorage.getItem('thegoat:v6')
                const s = raw ? JSON.parse(raw) : null
                const outcomes = s?.lastGame?.result?.outcomes ?? []
                return { count: outcomes.length, lastOptionId: outcomes.at(-1)?.optionId ?? null }
              })
              // Pins: expiry resolves the clutch moment as the moment's `safe` option
              // (defaultOption in engine/moments.ts), and exactly one outcome was
              // appended for it (a duplicate dispatch from a double-fired onExpire would
              // either add a second outcome here or be silently absorbed by the
              // reducer's phase/pendingGame guard in state.ts — this assertion catches
              // the first case but NOT the second; ClutchTimer's `fired` ref itself has
              // no direct unit coverage, see final-fix-report.md).
              console.log(`[assert] clutch expiry played the safe option: got ${after.lastOptionId}, expected ${clutchInfo.safeOptionId}`)
              if (after.lastOptionId !== clutchInfo.safeOptionId) exitCode = 1
              console.log(`[assert] clutch expiry recorded exactly one outcome per moment: ${after.count} outcomes for ${clutchInfo.momentsCount} moments`)
              if (after.count !== clutchInfo.momentsCount) exitCode = 1
              break
            }
            await page.locator('.game-option').first().click()
            await page.waitForTimeout(120)
          }
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

      if (await page.locator('text=Ver o balanço').count() > 0) {
        log('seasonResult: cerimônia → balanço')
        await page.locator('button.btn--ink', { hasText: 'Ver o balanço' }).click()
        continue
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

    const tierVisible = await page.locator('.verdict-layer--1 .headline').first().isVisible()
    const shareBtn = page.locator('button.btn--primary')
    const shareVisible = await shareBtn.isVisible()
    console.log(`[assert] tier text visible: ${tierVisible}`)
    console.log(`[assert] share button visible: ${shareVisible}`)
    if (!tierVisible || !shareVisible) exitCode = 1

    // verdict.moments ("Momentos") only renders when the career landed at least one
    // iconic moment — the safe policy played here rarely triggers one (sweep is the
    // one exception), so absence alone isn't a failure; only assert it's visible when
    // ground truth (the save in localStorage) says the career actually has one.
    const momentsTitleVisible = await page.locator('.mono-label', { hasText: 'Momentos' }).count() > 0
    const hasIconicMoments = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('thegoat:v5')
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
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
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

    log('desktop: quick draft to first keyGame, assert .game-side (9c grid) visible')
    await desktopPage.locator('button.btn--ink', { hasText: 'Nova carreira' }).click()
    for (let i = 0; i < 8; i++) {
      await desktopPage.locator('[data-testid="attr-row"]').first().click()
      await desktopPage.locator('button.btn--primary').click()
      await desktopPage.waitForTimeout(50)
    }
    await desktopPage.locator('button.btn--primary').click() // build confirm
    await firstOptionBtn(desktopPage).click() // nba draft: pick first offer
    await desktopPage.locator('button.btn--ink').click() // nba draft: confirm
    await desktopPage.locator('button.btn--primary', { hasText: 'Começar a temporada' }).click() // preseason -> start
    // season 1 may pause at an interactive eventDecision (modal, rng-dependent) before
    // reaching seasonAdvance — dismiss it (safe option) if it shows up, then take the game.
    for (let guard = 0; guard < 5; guard++) {
      await desktopPage.waitForSelector('.screen', { timeout: 10000 })
      if (await desktopPage.locator('.modal-veil').count() > 0) {
        await desktopPage.locator('.modal-veil button.btn--outline').click()
        continue
      }
      if (await desktopPage.locator('button.btn--ink', { hasText: 'Assumir' }).count() > 0) {
        await desktopPage.locator('button.btn--ink', { hasText: 'Assumir' }).click()
        break
      }
    }
    await desktopPage.waitForSelector('.game-side', { timeout: 5000 })
    const gameSideVisible = await desktopPage.locator('.game-side').isVisible()
    console.log(`[assert] desktop .game-side visible at first keyGame: ${gameSideVisible}`)
    if (!gameSideVisible) exitCode = 1

    await desktopContext.close()

    // ---- Clutch timer off: I-3, must NOT fire when timePressure is off ----
    const noTimerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    const noTimerPage = await noTimerContext.newPage()
    noTimerPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[timePressureOff] ${msg.text()}`)
    })
    noTimerPage.on('pageerror', err => consoleErrors.push(`[timePressureOff pageerror] ${err.message}`))
    await noTimerPage.goto(BASE_URL)
    await noTimerPage.evaluate(() => localStorage.clear())
    await noTimerPage.reload()

    log('timePressure off: toggle the Home chip, draft to first keyGame, reach the clutch moment')
    await noTimerPage.locator('button.chip', { hasText: 'LIGADO' }).click()
    await noTimerPage.locator('button.btn--ink', { hasText: 'Nova carreira' }).click()
    for (let i = 0; i < 8; i++) {
      await noTimerPage.locator('[data-testid="attr-row"]').first().click()
      await noTimerPage.locator('button.btn--primary').click()
      await noTimerPage.waitForTimeout(50)
    }
    await noTimerPage.locator('button.btn--primary').click() // build confirm
    await firstOptionBtn(noTimerPage).click() // nba draft: pick first offer
    await noTimerPage.locator('button.btn--ink').click() // nba draft: confirm
    await noTimerPage.locator('button.btn--primary', { hasText: 'Começar a temporada' }).click() // preseason -> start
    for (let guard = 0; guard < 5; guard++) {
      await noTimerPage.waitForSelector('.screen', { timeout: 10000 })
      if (await noTimerPage.locator('.modal-veil').count() > 0) {
        await noTimerPage.locator('.modal-veil button.btn--outline').click()
        continue
      }
      if (await noTimerPage.locator('button.btn--ink', { hasText: 'Assumir' }).count() > 0) {
        await noTimerPage.locator('button.btn--ink', { hasText: 'Assumir' }).click()
        break
      }
    }
    await noTimerPage.waitForSelector('.game-option', { timeout: 10000 })
    while (await noTimerPage.locator('.moment-card--now', { hasText: 'CLUTCH' }).count() === 0) {
      await noTimerPage.locator('.game-option').first().click()
      await noTimerPage.waitForTimeout(120)
    }

    const timerAbsent = await noTimerPage.locator('.clutch-timer').count() === 0
    console.log(`[assert] clutch timer NOT rendered at the clutch moment when timePressure is off: ${timerAbsent}`)
    if (!timerAbsent) exitCode = 1

    await noTimerPage.waitForTimeout(8600) // longer than the 8s the timer would run if it were mounted
    const stillWaitingForClick = await noTimerPage.locator('.game-option').first().isVisible().catch(() => false)
    console.log(`[assert] clutch moment still awaiting a manual click after 8.6s with timePressure off: ${stillWaitingForClick}`)
    if (!stillWaitingForClick) exitCode = 1

    await noTimerContext.close()

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
