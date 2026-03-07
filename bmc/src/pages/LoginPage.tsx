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

type PumpPortalCreateWalletResponse = {
  apiKey: string
  walletPublicKey: string
  privateKey: string
}

const createCustodialWallet = async (): Promise<PumpPortalCreateWalletResponse> => {
  const response = await fetch('https://pumpportal.fun/api/create-wallet', {
    method: 'GET',
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Wallet creation failed: ${response.status} - ${errorBody}`)
  }

  const data: unknown = await response.json()

  if (
    typeof data !== 'object' ||
    data === null ||
    !('apiKey' in data) ||
    !('walletPublicKey' in data) ||
    !('privateKey' in data) ||
    typeof data.apiKey !== 'string' ||
    typeof data.walletPublicKey !== 'string' ||
    typeof data.privateKey !== 'string'
  ) {
    throw new Error('Wallet creation failed: invalid response payload.')
  }

  return {
    apiKey: data.apiKey,
    walletPublicKey: data.walletPublicKey,
    privateKey: data.privateKey,
  }
}

const ensureCustodialWalletForUser = async (userId: string) => {
  const [settingsResult, secretsResult] = await Promise.all([
    supabase
      .from('user_settings')
      .select('public_wallet_key')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_secrets')
      .select('private_wallet_key, wallet_api_key')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (settingsResult.error) {
    throw settingsResult.error
  }

  if (secretsResult.error) {
    throw secretsResult.error
  }

  const hasPublicWalletKey = Boolean(settingsResult.data?.public_wallet_key)
  const hasPrivateWalletKey = Boolean(secretsResult.data?.private_wallet_key)
  const hasWalletApiKey = Boolean(secretsResult.data?.wallet_api_key)

  if (hasPublicWalletKey && hasPrivateWalletKey && hasWalletApiKey) {
    return
  }

  const wallet = await createCustodialWallet()

  const { error: secretsUpsertError } = await supabase.from('user_secrets').upsert(
    {
      id: userId,
      private_wallet_key: wallet.privateKey,
      wallet_api_key: wallet.apiKey,
    },
    { onConflict: 'id' }
  )

  if (secretsUpsertError) {
    throw secretsUpsertError
  }

  const { error: settingsUpsertError } = await supabase.from('user_settings').upsert(
    {
      id: userId,
      public_wallet_key: wallet.walletPublicKey,
    },
    { onConflict: 'id' }
  )

  if (settingsUpsertError) {
    throw settingsUpsertError
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

  if (session && pending) {
    return (
      <section className="placeholder-card auth-card" aria-label="Finalizing account setup">
        <h2 className="page-title">Account Access</h2>
        <p className="status">Finalizing wallet setup...</p>
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
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (signInError) {
        setError(signInError.message)
      } else if (signInData.user) {
        try {
          await ensureCustodialWalletForUser(signInData.user.id)
        } catch (walletError) {
          setError(
            walletError instanceof Error
              ? `Login succeeded, but wallet provisioning failed: ${walletError.message}`
              : 'Login succeeded, but wallet provisioning failed.'
          )
        }
      }
    } else {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
      } else {
        if (signUpData.user) {
          try {
            await ensureCustodialWalletForUser(signUpData.user.id)
          } catch (walletError) {
            setError(
              walletError instanceof Error
                ? `Account created, but wallet provisioning failed: ${walletError.message}`
                : 'Account created, but wallet provisioning failed.'
            )
          }
        }

        if (signUpData.session) {
          setStatus('Account created, wallet saved, and signed in successfully.')
        } else {
          setStatus('Account created successfully. If wallet setup is blocked, it will retry after login.')
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
