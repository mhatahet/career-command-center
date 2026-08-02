/* ============================================================================
   Router
   ----------------------------------------------------------------------------
   Hash routing, so the built app works from `file://` or any static host with no
   server rewrite rules. ~60 lines instead of a dependency.
   ========================================================================= */

import { useCallback, useEffect, useState } from 'react'

export interface Route {
  path: string
  /** Fragment after a second `#`, used to deep-link to a row. */
  anchor?: string
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, anchor] = raw.split('#')
  return { path: path || '/', anchor: anchor || undefined }
}

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const target = to.startsWith('#') ? to : `#${to}`
  if (window.location.hash === target) {
    // Same route — still notify so an anchor-only change scrolls into view.
    notify()
    return
  }
  if (options.replace) {
    window.history.replaceState(null, '', target)
    notify()
  } else {
    window.location.hash = target
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const update = () => setRoute(parseHash())
    window.addEventListener('hashchange', update)
    listeners.add(update)
    return () => {
      window.removeEventListener('hashchange', update)
      listeners.delete(update)
    }
  }, [])

  return route
}

export function useNavigate() {
  return useCallback((to: string, options?: { replace?: boolean }) => navigate(to, options), [])
}

/** Scroll an anchored element into view once the page has rendered. */
export function useScrollToAnchor(anchor: string | undefined, deps: unknown[] = []) {
  useEffect(() => {
    if (!anchor) return
    // Two frames: one for the route render, one for any lazy content beneath it.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const element = document.getElementById(anchor)
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element?.classList.add('flash-target')
        window.setTimeout(() => element?.classList.remove('flash-target'), 1600)
      })
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, ...deps])
}
