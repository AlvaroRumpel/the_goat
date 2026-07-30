import { Component, type ReactNode } from 'react'
import { STORAGE_KEY } from '../state'
import { t, type Lang } from '../i18n'

interface Props { children: ReactNode }
interface State { crashed: boolean }

const lang: Lang = typeof navigator !== 'undefined' && navigator.language.startsWith('pt') ? 'pt' : 'en'

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary caught:', error)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // storage unavailable — nothing to clear
    }
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 16 }}>
        <div className="headline headline--red" style={{ fontSize: 30 }}>{t(lang, 'error.crashed')}</div>
        <div className="hint">{t(lang, 'error.desc')}</div>
        <button type="button" className="btn btn--ink" style={{ width: '100%' }} onClick={() => window.location.reload()}>
          {t(lang, 'error.reload')}
        </button>
      </div>
    )
  }
}
