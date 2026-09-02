import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/minigames.css'
import './styles/mg-playbook.css'
import './styles/mg-shot.css'
import './styles/mg-defense.css'
import App from './App.tsx'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
