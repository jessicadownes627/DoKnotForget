import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

declare global {
  interface Window {
    __dkfLaunchStart?: number
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const removeLaunch = () => {
  document.documentElement.classList.remove('dkf-launch-active')
  document.body.classList.remove('dkf-launch-active')
  document.getElementById('dkf-launch')?.remove()
}

const LAUNCH_MIN_MS = 1800
const launchStart = window.__dkfLaunchStart
const elapsed = typeof launchStart === 'number' ? performance.now() - launchStart : 0
const remaining = Math.max(0, LAUNCH_MIN_MS - elapsed)

window.setTimeout(removeLaunch, remaining)
