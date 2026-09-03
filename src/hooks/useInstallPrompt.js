import { useState, useEffect } from 'react'

// Hook that captures the browser's native "Add to Home Screen" prompt.
//
// Modern mobile browsers (iOS Safari, Chrome Android) expose a
// `beforeinstallprompt` event. We stash that event and expose a `prompt()`
// method. Calling it shows the OS install sheet. We also expose `installed`
// so the UI can hide the button once the app is already on the home screen.
//
// iOS Safari does NOT fire `beforeinstallprompt`. On iOS the install flow is
// manual (Share → Add to Home Screen), so we surface a small hint instead.
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Was the app already added to the home screen?
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }

    const onBeforeInstall = (e) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    const onInstalled = () => setInstalled(true)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const prompt = () => {
    if (!promptEvent) return false
    promptEvent.prompt()
    return promptEvent.waitUntil?.(promptEvent.userChoice) ?? true
  }

  return { prompt, installed, canPrompt: !!promptEvent }
}
