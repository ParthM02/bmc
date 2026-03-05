import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

type TopNavProps = {
  session: Session | null
  authLoading: boolean
}

export const TopNav = ({ session, authLoading }: TopNavProps) => {
  const navigate = useNavigate()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [pendingSignOut, setPendingSignOut] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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
    setIsProfileOpen(false)
    navigate('/auth')
  }

  return (
    <>
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
          onClick={() => setIsProfileOpen(false)}
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
                    setIsProfileOpen(false)
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
