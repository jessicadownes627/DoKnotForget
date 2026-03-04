import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RouterProvider } from './router'

declare global {
  interface Window {
    __dkfLaunchStart?: number
  }
}

const root = createRoot(document.getElementById('root')!)

const removeLaunch = () => {
  document.documentElement.classList.remove('dkf-launch-active')
  document.body.classList.remove('dkf-launch-active')
  document.getElementById('dkf-launch')?.remove()
}

const LAUNCH_MIN_MS = 1800
const launchStart = window.__dkfLaunchStart
const elapsed = typeof launchStart === 'number' ? performance.now() - launchStart : 0
const remaining = Math.max(0, LAUNCH_MIN_MS - elapsed)

const mountApp = () => {
  root.render(
    <StrictMode>
      <RouterProvider>
        <App />
      </RouterProvider>
    </StrictMode>,
  )
}

window.setTimeout(() => {
  removeLaunch()
  mountApp()
}, remaining)
