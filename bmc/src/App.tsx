import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { ConstructionBanner } from './components/ConstructionBanner'
import { TopNav } from './components/TopNav'
import { useWalletData } from './hooks/useWalletData'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage.tsx'
import { MyBotPage } from './pages/MyBotPage'
import { supabase } from './supabaseClient'

const ProtectedMyBotRoute = ({ session }: { session: Session | null }) => {
  const location = useLocation()

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location }} />
  }

  return <MyBotPage />
}

function App() {
  const { walletData, loading, error } = useWalletData()
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const hydrateSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (mounted) {
        setSession(currentSession)
        setAuthLoading(false)
      }
    }

    void hydrateSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <main className="site">
      <ConstructionBanner />
      <TopNav session={session} authLoading={authLoading} />

      <Routes>
        <Route path="/" element={<HomePage loading={loading} error={error} walletData={walletData} />} />
        <Route path="/auth" element={<LoginPage session={session} authLoading={authLoading} />} />
        <Route path="/auth/*" element={<LoginPage session={session} authLoading={authLoading} />} />
        <Route path="/my-bot" element={<ProtectedMyBotRoute session={session} />} />
        <Route path="/my-bot/*" element={<ProtectedMyBotRoute session={session} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}

export default App
