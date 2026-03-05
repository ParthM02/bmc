import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

type LoginPageProps = {
  session: Session | null
  authLoading: boolean
}

type LocationState = {
  from?: {
    pathname?: string
  }
}

export const LoginPage = ({ session, authLoading }: LoginPageProps) => {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const state = location.state as LocationState | null
  const targetPath = state?.from?.pathname && state.from.pathname !== '/auth' ? state.from.pathname : '/my-bot'

  if (authLoading) {
    return (
      <section className="placeholder-card auth-card" aria-label="Loading authentication state">
        <h2 className="page-title">Account Access</h2>
        <p className="status">Checking your account session...</p>
      </section>
    )
  }

  if (session) {
    return <Navigate to={targetPath} replace />
  }

  const handleAuth = async (mode: 'login' | 'signup') => {
    setPending(true)
    setError(null)
    setStatus(null)

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setError('Email and password are required.')
      setPending(false)
      return
    }

    if (mode === 'login') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (signInError) {
        setError(signInError.message)
      }
    } else {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
      } else {
        if (signUpData.session) {
          setStatus('Account created and signed in. Email confirmation is currently optional in your Supabase settings.')
        } else {
          setStatus('Account created. Check your inbox and open the verification link to finish setup.')
        }
      }
    }

    setPending(false)
  }

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleAuth('login')
  }

  return (
    <section className="placeholder-card auth-card" aria-label="Login or sign up">
      <h2 className="page-title">Login / Sign Up</h2>
      <p className="status">Create an account or sign in to access your bot dashboard.</p>

      <form className="auth-form" onSubmit={handleLoginSubmit}>
        <label className="auth-label" htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          className="auth-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />

        <label className="auth-label" htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          className="auth-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
        />

        <div className="auth-actions">
          <button type="submit" className="nav-btn" disabled={pending}>
            {pending ? 'Working...' : 'Login'}
          </button>
          <button
            type="button"
            className="nav-btn"
            disabled={pending}
            onClick={() => {
              void handleAuth('signup')
            }}
          >
            {pending ? 'Working...' : 'Sign Up'}
          </button>
        </div>
      </form>

      {status && <p className="status">{status}</p>}
      {error && <p className="status error">{error}</p>}
    </section>
  )
}
