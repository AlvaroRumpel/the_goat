import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { crashed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary caught:', error)
    try {
      localStorage.removeItem('thegoat:v5')
    } catch {
      // storage unavailable — nothing to clear
    }
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 16 }}>
        <div className="headline headline--red" style={{ fontSize: 30 }}>ALGO QUEBROU</div>
        <div className="hint">O save foi limpo. Recomece uma carreira nova.</div>
        <button type="button" className="btn btn--ink" style={{ width: '100%' }} onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
    )
  }
}
