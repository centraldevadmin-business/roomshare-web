import { Component } from 'react'
import { WarningIcon } from './Icons'

// Last line of defense: if any screen throws while rendering, the user gets a
// readable card with a reload button instead of a blank white screen. Nothing
// is lost — the session, the ledger queue, and local edits all live in
// localStorage and survive a reload.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the details for the console; the UI shows a plain message.
    console.error('House Ledger crashed:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-100 text-red-500 mb-4">
            <WarningIcon size={24} />
          </div>
          <h1 className="text-lg font-extrabold text-slate-800">Something went wrong</h1>
          <p className="text-sm text-slate-500 mt-2">
            The app hit an unexpected error. Your data is safe — everything is
            stored on this device and on GitHub. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl transition-colors"
          >
            Reload the app
          </button>
        </div>
      </div>
    )
  }
}