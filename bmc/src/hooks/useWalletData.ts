import { useEffect, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export const useWalletData = () => {
  const [walletData, setWalletData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWalletData = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE_URL}/api/wallet`)
        if (!response.ok) {
          const errorBody = await response.text()
          throw new Error(`API error: ${response.status} - ${errorBody}`)
        }
        const jsonData = await response.json()
        setWalletData(jsonData)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch wallet data')
      } finally {
        setLoading(false)
      }
    }

    fetchWalletData()
  }, [])

  return { walletData, loading, error }
}
