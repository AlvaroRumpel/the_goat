import { Component, type ReactNode } from 'react'
import { STORAGE_KEY } from '../state'
import { t, type Lang } from '../i18n'

interface Props { children: ReactNode }
interface State { crashed: boolean; wiped: boolean }

const CRASH_KEY = 'thegoat:crashes'
const lang: Lang = typeof navigator !== 'undefined' && navigator.language.startsWith('pt') ? 'pt' : 'en'

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false, wiped: false }

  static getDerivedStateFromError(): Partial<State> {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary caught:', error)
    // Primeiro crash da sessão: o save fica (pode ser bug transitório de tela). Só no
    // segundo crash seguido o save é movido pra ':crashed' e limpo, pra sair do loop.
    try {
      const n = Number(sessionStorage.getItem(CRASH_KEY) ?? '0') + 1
      sessionStorage.setItem(CRASH_KEY, String(n))
      if (n >= 2) {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) localStorage.setItem(STORAGE_KEY + ':crashed', raw)
        localStorage.removeItem(STORAGE_KEY)
        sessionStorage.removeItem(CRASH_KEY)
        this.setState({ wiped: true })
      }
    } catch {
      // storage unavailable — nothing to clear
    }
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 16 }}>
        <div className="headline headline--red" style={{ fontSize: 30 }}>{t(lang, 'error.crashed')}</div>
        <div className="hint">{t(lang, this.state.wiped ? 'error.desc' : 'error.descKept')}</div>
        <button type="button" className="btn btn--ink" style={{ width: '100%' }} onClick={() => window.location.reload()}>
          {t(lang, 'error.reload')}
        </button>
      </div>
    )
  }
}
