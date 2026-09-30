import { useEffect, useRef, useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import type { Award } from '../../engine/types'
import { teamById } from '../../data/teams'
import { drawShareCard, shareText, type CardData } from '../share'
import { CareerBar } from '../components/CareerBar'
import { Icon } from '../components/Icon'
import { AdSlot } from '../components/AdSlot'
import { useSpin } from '../hooks/useMotion'
import { CountUp } from '../components/CountUp'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

const AWARDS: Award[] = ['allstar', 'mvp', 'dpoy', 'scoring', 'fmvp', 'ring']
const TIERS = ['peladeiro', 'rolePlayer', 'starter', 'allstar', 'superstar', 'legend', 'goat'] as const

export function Verdict({ state, dispatch }: Props) {
  const lang = state.lang
  const verdict = state.verdict!
  const { totals, counts, tier, score } = verdict
  const iconicMoments = state.career.seasons.flatMap(s => s.iconicMoments ?? [])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blobRef = useRef<Blob | null>(null)
  const [copied, setCopied] = useState(false)
  // A7: roleta do tier — cicla os 7 tiers por 1.4s antes de cravar o veredito real
  const spin = useSpin('tier', t(lang, 'tier.' + tier), TIERS.map(x => t(lang, 'tier.' + x)), 1400, 95)

  const finalTeamId = state.career.seasons.at(-1)?.finalTeamId
  const finalTeam = finalTeamId ? teamById(finalTeamId) : null
  const teamLabel = finalTeam ? `${finalTeam.id.toUpperCase()} ${finalTeam.name.toUpperCase()}` : ''
  const memories = state.career.seasons
    .flatMap((s, i) => s.iconicMoments.map(id => ({ year: 2026 + i, text: t(lang, 'iconic.' + id) })))
    .slice(0, 2)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const data: CardData = {
      verdict, name: state.career.name, number: state.career.number ?? 0, mode: state.career.mode ?? 'normal',
      teamLabel, seasons: state.career.seasons.length,
      yearFrom: 2026, yearTo: 2026 + Math.max(0, state.career.seasons.length - 1),
      memories, lang,
    }
    document.fonts.ready.then(() => {
      drawShareCard(canvas, data)
      // blob pronto ANTES do toque: navigator.share precisa da ativação do usuário (iOS)
      canvas.toBlob(b => { blobRef.current = b })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, verdict, state.career, state.leagueHistory, teamLabel])

  async function handleShare() {
    const text = shareText(lang, verdict)
    const blob = blobRef.current
    const file = blob ? new File([blob], 'the-goat.png', { type: 'image/png' }) : null
    // 1) share nativo com a imagem (mobile) — sem await antes, pra não perder a ativação
    if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({ text, files: [file] })
        return
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return   // usuário cancelou
        // sem suporte a arquivos → fallback abaixo
      }
    }
    // 2) desktop/Firefox: copia o texto e baixa o PNG
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'the-goat.png'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  return (
    <div className="screen verdict-screen">
      <CareerBar state={state} dispatch={dispatch} heavy />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center' }}>
        <div className="verdict-layer verdict-layer--1" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
          <Icon name="verdict" size={32} tone="inherit" />
          <div className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.title')}</div>
          <div className="headline" style={{ fontSize: 64, opacity: spin.settled ? 1 : 0.6 }} onClick={spin.skip}>{spin.text}</div>
          <div className="mono" style={{ color: 'var(--on-red-dim)' }}>{spin.settled ? t(lang, 'verdict.score', { n: score }) : t(lang, 'verdict.rolling')}</div>
          <hr className="rule--double" style={{ width: '100%' }} />
        </div>

        <div className="verdict-layer verdict-layer--2 verdict-totals">
          <div className="verdict-total">
            <span className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.points')}</span>
            <span className="headline" style={{ fontSize: 26 }}><CountUp value={totals.points} ms={1200} /></span>
          </div>
          <div className="verdict-total">
            <span className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.seasons2')}</span>
            <span className="headline" style={{ fontSize: 26 }}><CountUp value={totals.seasons} ms={900} /></span>
          </div>
          <div className="verdict-total">
            <span className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.rings')}</span>
            <span className="headline" style={{ fontSize: 26 }}><CountUp value={counts.ring} ms={900} /></span>
          </div>
          <div className="verdict-total">
            <span className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.mvps')}</span>
            <span className="headline" style={{ fontSize: 26 }}><CountUp value={counts.mvp} ms={900} /></span>
          </div>
        </div>

        <div className="verdict-layer verdict-layer--2" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {AWARDS.filter(a => counts[a] > 0).map(a => (
            <span key={a} className="chip" style={{ borderColor: 'var(--on-red-dim)', color: 'var(--on-red)' }}>
              {counts[a]}× {t(lang, 'award.' + a)}
            </span>
          ))}
        </div>

        <div className="verdict-layer verdict-layer--3" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {iconicMoments.length > 0 && (
            <>
              <div className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.moments')} · +{verdict.iconicPoints}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {iconicMoments.map((id, i) => (
                  <span key={i} className="chip" style={{ borderColor: 'var(--on-red-dim)', color: 'var(--on-red)' }}>{t(lang, 'iconic.' + id)}</span>
                ))}
              </div>
            </>
          )}
          {verdict.chokes > 0 && (
            <span className="chip" style={{ borderColor: 'var(--on-red-dim)', color: 'var(--on-red-dim)', opacity: 0.72 }}>
              {t(lang, 'verdict.chokes', { n: verdict.chokes })}
            </span>
          )}

          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />

          <AdSlot slot="pause" />
          <button type="button" className="btn btn--primary" style={{ width: '100%' }} onClick={handleShare}>
            {t(lang, copied ? 'share.copied' : 'share.button')}
          </button>
          <button type="button" className="btn btn--outline" style={{ width: '100%' }} onClick={() => dispatch({ type: 'RESET' })}>
            {t(lang, 'share.again')}
          </button>
        </div>
      </div>
    </div>
  )
}
