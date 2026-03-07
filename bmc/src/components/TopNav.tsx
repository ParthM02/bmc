import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

type TopNavProps = {
  session: Session | null
  authLoading: boolean
}

type ProfileWalletData = {
  publicWalletKey: string
  privateWalletKey: string
  walletApiKey: string
}

type CopyToast = {
  kind: 'success' | 'error' | 'info'
  message: string
}

export const TopNav = ({ session, authLoading }: TopNavProps) => {
  const navigate = useNavigate()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [pendingSignOut, setPendingSignOut] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [walletData, setWalletData] = useState<ProfileWalletData | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copyToast, setCopyToast] = useState<CopyToast | null>(null)

  useEffect(() => {
    if (!copyToast) {
      return
    }

    const timer = window.setTimeout(() => {
      setCopyToast(null)
    }, 2600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [copyToast])

  useEffect(() => {
    if (!isProfileOpen || !session) {
      return
    }

    let mounted = true

    const fetchWalletData = async () => {
      setWalletLoading(true)
      setWalletError(null)

      const [settingsResult, secretsResult] = await Promise.all([
        supabase
          .from('user_settings')
          .select('public_wallet_key')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('user_secrets')
          .select('private_wallet_key, wallet_api_key')
          .eq('id', session.user.id)
          .maybeSingle(),
      ])

      if (settingsResult.error) {
        if (mounted) {
          setWalletError(settingsResult.error.message)
          setWalletLoading(false)
        }
        return
      }

      if (secretsResult.error) {
        if (mounted) {
          setWalletError(secretsResult.error.message)
          setWalletLoading(false)
        }
        return
      }

      if (mounted) {
        setWalletData({
          publicWalletKey: settingsResult.data?.public_wallet_key ?? '',
          privateWalletKey: secretsResult.data?.private_wallet_key ?? '',
          walletApiKey: secretsResult.data?.wallet_api_key ?? '',
        })
        setWalletLoading(false)
      }
    }

    void fetchWalletData()

    return () => {
      mounted = false
    }
  }, [isProfileOpen, session])

  const closeProfile = () => {
    setIsProfileOpen(false)
    setShowPrivateKey(false)
    setShowApiKey(false)
  }

  const handleCopy = async (value: string, label: string) => {
    const trimmed = value.trim()

    if (!trimmed) {
      setCopyToast({ kind: 'info', message: `${label} is not set.` })
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trimmed)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = trimmed
        textArea.setAttribute('readonly', '')
        textArea.style.position = 'absolute'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      setCopyToast({ kind: 'success', message: `${label} copied.` })
    } catch {
      setCopyToast({ kind: 'error', message: `Failed to copy ${label.toLowerCase()}.` })
    }
  }

  const handleSignOut = async () => {
    setPendingSignOut(true)
    setActionError(null)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setActionError(error.message)
      setPendingSignOut(false)
      return
    }

    setPendingSignOut(false)
    closeProfile()
    navigate('/auth')
  }

  return (
    <>
      {copyToast && (
        <div className={`copy-toast ${copyToast.kind}`} role="status" aria-live="polite">
          {copyToast.message}
        </div>
      )}

      <header className="top-nav" aria-label="Primary navigation">
        <h1 className="site-header">Big Money Crypto</h1>

        <nav className="nav-links" aria-label="Pages">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
          >
            Home
          </NavLink>
          <NavLink
            to="/my-bot"
            className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
          >
            My Bot
          </NavLink>
        </nav>

        <button
          type="button"
          className="profile-btn"
          aria-label="Open profile"
          onClick={() => {
            setActionError(null)
            setWalletError(null)
            setWalletData(null)
            setIsProfileOpen(true)
          }}
        >
          👤
        </button>
      </header>

      {isProfileOpen && (
        <div
          className="profile-modal-backdrop"
          role="presentation"
          onClick={closeProfile}
        >
          <section
            className="profile-modal"
            aria-label="Profile details"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="section-title">Profile</h2>

            {authLoading && <p className="status">Checking account...</p>}

            {!authLoading && session && (
              <>
                <p className="status">Signed in as</p>
                <p className="profile-email">{session.user.email ?? 'Unknown email'}</p>

                {walletLoading && <p className="status">Loading wallet details...</p>}
                {walletError && <p className="status error">{walletError}</p>}

                {!walletLoading && walletData && (
                  <div className="profile-wallet-section" aria-label="Important wallet keys">
                    <div className="profile-key-field">
                      <label className="auth-label" htmlFor="profile-public-wallet-key">
                        Public Address
                      </label>
                      <div className="profile-key-input-row">
                        <input
                          id="profile-public-wallet-key"
                          className="auth-input mono-value profile-key-input"
                          type="text"
                          value={walletData.publicWalletKey || 'Not set'}
                          readOnly
                        />
                        <button
                          type="button"
                          className="nav-btn"
                          disabled={!walletData.publicWalletKey}
                          onClick={() => {
                            void handleCopy(walletData.publicWalletKey, 'Public address')
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="profile-key-field">
                      <label className="auth-label" htmlFor="profile-private-wallet-key">
                        Private Key
                      </label>
                      <div className="profile-key-input-row">
                        <input
                          id="profile-private-wallet-key"
                          className="auth-input mono-value profile-key-input"
                          type={showPrivateKey ? 'text' : 'password'}
                          value={walletData.privateWalletKey || 'Not set'}
                          readOnly
                        />
                        <div className="profile-key-actions">
                          <button
                            type="button"
                            className="nav-btn"
                            disabled={!walletData.privateWalletKey}
                            onClick={() => {
                              setShowPrivateKey((prev) => !prev)
                            }}
                          >
                            {showPrivateKey ? 'Hide' : 'Unhide'}
                          </button>
                          <button
                            type="button"
                            className="nav-btn"
                            disabled={!walletData.privateWalletKey}
                            onClick={() => {
                              void handleCopy(walletData.privateWalletKey, 'Private key')
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="profile-key-field">
                      <label className="auth-label" htmlFor="profile-wallet-api-key">
                        API Key
                      </label>
                      <div className="profile-key-input-row">
                        <input
                          id="profile-wallet-api-key"
                          className="auth-input mono-value profile-key-input"
                          type={showApiKey ? 'text' : 'password'}
                          value={walletData.walletApiKey || 'Not set'}
                          readOnly
                        />
                        <div className="profile-key-actions">
                          <button
                            type="button"
                            className="nav-btn"
                            disabled={!walletData.walletApiKey}
                            onClick={() => {
                              setShowApiKey((prev) => !prev)
                            }}
                          >
                            {showApiKey ? 'Hide' : 'Unhide'}
                          </button>
                          <button
                            type="button"
                            className="nav-btn"
                            disabled={!walletData.walletApiKey}
                            onClick={() => {
                              void handleCopy(walletData.walletApiKey, 'API key')
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="nav-btn"
                  disabled={pendingSignOut}
                  onClick={() => {
                    void handleSignOut()
                  }}
                >
                  {pendingSignOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </>
            )}

            {!authLoading && !session && (
              <>
                <p className="status">You are not logged in.</p>
                <button
                  type="button"
                  className="nav-btn"
                  onClick={() => {
                    closeProfile()
                    navigate('/auth')
                  }}
                >
                  Login / Sign Up
                </button>
              </>
            )}

            {actionError && <p className="status error">{actionError}</p>}
          </section>
        </div>
      )}
    </>
  )
}
