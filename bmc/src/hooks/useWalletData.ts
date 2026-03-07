import { useEffect, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export const useWalletData = (walletAddress?: string | null, requireWalletAddress = false) => {
  const [walletData, setWalletData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const normalizedWalletAddress = walletAddress?.trim() ?? ''

    if (requireWalletAddress && !normalizedWalletAddress) {
      setWalletData(null)
      setError(null)
      setLoading(false)
      return
    }

    const fetchWalletData = async () => {
      setLoading(true)
      setError(null)
      try {
        const query = normalizedWalletAddress
          ? `?wallet=${encodeURIComponent(normalizedWalletAddress)}`
          : ''

        const response = await fetch(`${API_BASE_URL}/api/wallet${query}`)
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
  }, [walletAddress, requireWalletAddress])

  return { walletData, loading, error }
}
