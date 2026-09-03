import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register the service worker for offline PWA support.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW registration failed — app still works */
    })
    // Register the push service worker for real background notifications.
    navigator.serviceWorker.register('/sw-push.js').catch(() => {
      /* push SW registration failed — app still works */
    })
  })
}
