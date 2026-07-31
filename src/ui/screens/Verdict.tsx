import { useEffect, useRef, useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import type { Award } from '../../engine/types'
import { drawShareCard, shareText } from '../share'
import { CareerBar } from '../components/CareerBar'
import { Icon } from '../components/Icon'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

const AWARDS: Award[] = ['allstar', 'mvp', 'dpoy', 'scoring', 'fmvp', 'ring']

export function Verdict({ state, dispatch }: Props) {
  const lang = state.lang
  const verdict = state.verdict!
  const { totals, counts, tier, score } = verdict
  const iconicMoments = state.career.seasons.flatMap(s => s.iconicMoments ?? [])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const build = state.build
    if (!canvas || !build) return
    document.fonts.ready.then(() => drawShareCard(canvas, verdict, build, lang))
  }, [lang, state.build, verdict])

  async function handleShare() {
    const text = shareText(lang, verdict)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — native share below is the fallback
    }
    if (navigator.share) {
      try {
        const canvas = canvasRef.current
        const blob = canvas && await new Promise<Blob | null>(resolve => canvas.toBlob(resolve))
        if (blob) {
          const file = new File([blob], 'the-goat.png', { type: 'image/png' })
          await navigator.share({ text, files: [file] })
        }
      } catch {
        // user cancelled or share unsupported for files — clipboard already covers it
      }
    }
  }

  return (
    <div className="screen verdict-screen">
      <CareerBar state={state} dispatch={dispatch} heavy />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center' }}>
        <div className="verdict-layer verdict-layer--1" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
          <Icon name="verdict" size={32} tone="inherit" />
          <div className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.title')}</div>
          <div className="headline" style={{ fontSize: 64 }}>{t(lang, 'tier.' + tier)}</div>
          <div className="mono" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.score', { n: score })}</div>
          <hr className="rule--double" style={{ width: '100%' }} />
        </div>

        <div className="verdict-layer verdict-layer--2 verdict-totals">
          <div className="verdict-total">
            <span className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.points')}</span>
            <span className="headline" style={{ fontSize: 26 }}>{totals.points}</span>
          </div>
          <div className="verdict-total">
            <span className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.seasons2')}</span>
            <span className="headline" style={{ fontSize: 26 }}>{totals.seasons}</span>
          </div>
          <div className="verdict-total">
            <span className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.rings')}</span>
            <span className="headline" style={{ fontSize: 26 }}>{counts.ring}</span>
          </div>
          <div className="verdict-total">
            <span className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'verdict.mvps')}</span>
            <span className="headline" style={{ fontSize: 26 }}>{counts.mvp}</span>
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
            style={{ width: '100%', maxWidth: 280, aspectRatio: '1080 / 1350', border: '1px solid var(--on-red-dim)', borderRadius: 8, margin: '0 auto' }}
          />

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
