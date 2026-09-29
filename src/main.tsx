import './bootstrap/studioDraftFix'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes'
import './index.css'
import { applyDocumentLanguage, getCurrentLanguage } from './lib/i18n'

const CHUNK_RELOAD_SESSION_KEY = 'noti-vite-chunk-reload-v1'

const PUBLIC_RUNTIME_STYLES = [
  'studio-mode-tabs.css',
  'studio-preview-fix.css?v=20260707-1',
  'elevenlabs-dubbing.css',
  'studio-lipsync.css',
]

const PUBLIC_RUNTIME_SCRIPTS = [
  'studio-mode-tabs.js',
  'elevenlabs-dubbing.js',
  'studio-lipsync.js',
]

function recoverFromChunkLoadError() {
  try {
    const url = new URL(window.location.href)
    const nextMarker = `${url.pathname}${url.search}${url.hash}`
    const previousMarker = sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)
    if (previousMarker === nextMarker) return
    sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, nextMarker)
    url.searchParams.set('__reload', String(Date.now()))
    window.location.replace(url.toString())
  } catch {
    window.location.reload()
  }
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  recoverFromChunkLoadError()
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = typeof reason === 'string'
    ? reason
    : reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : ''
  if (
    message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
    || message.includes('Unable to preload CSS')
  ) {
    event.preventDefault()
    recoverFromChunkLoadError()
  }
})

function ensurePublicRuntimeAssets() {
  const baseUrl = import.meta.env.BASE_URL || '/'

  for (const hrefPart of PUBLIC_RUNTIME_STYLES) {
    const href = `${baseUrl}${hrefPart}`
    if (document.querySelector(`link[data-public-runtime-asset="${href}"]`)) continue
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.publicRuntimeAsset = href
    document.head.appendChild(link)
  }

  for (const srcPart of PUBLIC_RUNTIME_SCRIPTS) {
    const src = `${baseUrl}${srcPart}`
    if (document.querySelector(`script[data-public-runtime-asset="${src}"]`)) continue
    const script = document.createElement('script')
    script.src = src
    script.defer = true
    script.dataset.publicRuntimeAsset = src
    document.body.appendChild(script)
  }
}

ensurePublicRuntimeAssets()
applyDocumentLanguage(getCurrentLanguage())

window.addEventListener('noti-app-settings-changed', () => {
  applyDocumentLanguage(getCurrentLanguage())
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY)
    navigator.serviceWorker.register('/app/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/app">
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>,
)
