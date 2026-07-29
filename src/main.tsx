import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// 有新版本時自動重新載入，避免使用者一直卡在舊的快取版本。
// vite-plugin-pwa（autoUpdate）會讓新的 Service Worker skipWaiting + 接管頁面，
// 接管時觸發 controllerchange；首次安裝（原本沒有 controller）不需重載。
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return
    refreshing = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
