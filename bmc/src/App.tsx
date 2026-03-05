import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { ConstructionBanner } from './components/ConstructionBanner'
import { TopNav } from './components/TopNav'
import { useWalletData } from './hooks/useWalletData'
import { HomePage } from './pages/HomePage'
import { MyBotPage } from './pages/MyBotPage'

function App() {
  const { walletData, loading, error } = useWalletData()

  return (
    <main className="site">
      <ConstructionBanner />
      <TopNav />

      <Routes>
        <Route path="/" element={<HomePage loading={loading} error={error} walletData={walletData} />} />
        <Route path="/my-bot" element={<MyBotPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}

export default App
