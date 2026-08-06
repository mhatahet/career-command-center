/* ============================================================================
   Auth gate
   ----------------------------------------------------------------------------
   This app has no public sign-up — it is a single-user personal dashboard.
   Create the one account from the Supabase dashboard (Authentication → Users
   → Add user) and sign in with it here. See DEPLOY.md.

   When Supabase is not configured (no `VITE_SUPABASE_URL` / `VITE_SUPABASE_
   ANON_KEY`), `<AuthGate>` is a no-op — it renders its children immediately.
   That keeps local dev (the file bridge, no login) working exactly as before.

   When Supabase *is* configured, this component is what makes the app safe to
   put behind a public URL: it blocks rendering the store — and therefore any
   read or write of the `data_files` table — until a session exists. The
   table's Row-Level Security policies would reject unauthenticated requests
   anyway; this is what turns that rejection into a login screen instead of a
   wall of failed-fetch toasts.
   ========================================================================= */

import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import { Button, Input } from '../components/ui'
import { isSupabaseConfigured, supabase } from './supabaseClient'

/* ------------------------------------------------------------- session hook */

function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/* --------------------------------------------------------------- boot look */

function AuthBoot({ body }: { body: string }) {
  return (
    <div className="boot">
      <div className="boot__logo">CC</div>
      <div className="boot__spinner" />
      <div className="boot__body">{body}</div>
    </div>
  )
}

/* -------------------------------------------------------------- login form */

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (signInError) setError(signInError.message)
  }

  return (
    <div className="boot">
      <div className="boot__logo">CC</div>
      <div className="boot__title">Career Command Center</div>
      <p className="boot__body">Sign in to reach your data.</p>
      <form
        onSubmit={handleSubmit}
        className="col"
        style={{ gap: 'var(--space-3)', width: 'min(320px, 100%)', marginTop: 'var(--space-2)' }}
      >
        <Input
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoFocus
        />
        <Input type="password" value={password} onChange={setPassword} placeholder="Password" />
        {error ? (
          <span className="text-xs" style={{ color: 'var(--danger-text)' }}>
            {error}
          </span>
        ) : null}
        <Button type="submit" variant="primary" disabled={submitting || !email || !password} fullWidth>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="boot__body text-tertiary" style={{ marginTop: 'var(--space-3)' }}>
        No account yet? Create one from the Supabase dashboard — Authentication → Users → Add user.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------- gate */

export function AuthGate({ children }: { children: ReactNode }) {
  // Called unconditionally (`isSupabaseConfigured()` is invariant for the life
  // of the app — it reads a build-time env var) so this never violates the
  // rules of hooks; when unconfigured the hook resolves `loading: false`,
  // `session: null` immediately and the branch below never reaches it.
  const { session, loading } = useSupabaseSession()

  if (!isSupabaseConfigured()) return <>{children}</>
  if (loading) return <AuthBoot body="Checking your session…" />
  if (!session) return <LoginScreen />

  return <>{children}</>
}
