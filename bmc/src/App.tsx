import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

type TableRow = Record<string, unknown>

const isTableRow = (value: unknown): value is TableRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTableRowArray = (value: unknown): value is TableRow[] =>
  Array.isArray(value) && value.every(isTableRow)

function App() {
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
           const errorBody = await response.text();
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

  const renderContent = () => {
    if (!walletData) return null

    // Determine if data is a list or object with list
    let items: TableRow[] = []
    const walletObject = isTableRow(walletData) ? walletData : null
    const walletDataData = walletObject?.data
    const walletDataItems = walletObject?.items
    const walletDataTokens = walletObject?.tokens
    
    // BirdEye response can be: { data: { tokens: [...] } }, { data: { items: [...] } }, { data: [...] }, { items: [...] }, or [...]
    if (isTableRowArray(walletData)) {
      items = walletData
    } else if (isTableRowArray(walletDataData)) {
      items = walletDataData
    } else if (
      isTableRow(walletDataData) &&
      isTableRowArray(walletDataData.tokens)
    ) {
      items = walletDataData.tokens
    } else if (
      isTableRow(walletDataData) &&
      isTableRowArray(walletDataData.items)
    ) {
      items = walletDataData.items
    } else if (isTableRowArray(walletDataItems)) {
      items = walletDataItems
    } else if (isTableRowArray(walletDataTokens)) {
      items = walletDataTokens
    } else {
       // If no array found, just dump JSON
       return (
         <div className="table-wrap">
           <h3>Raw Data</h3>
           <pre>{JSON.stringify(walletData, null, 2)}</pre>
         </div>
       )
    }

    if (items.length === 0) {
       return <p>No items found.</p>
    }

    // Get headers from first item keys
    const headers = Object.keys(items[0] || {})

    return (
      <div className="table-wrap">
        <table className="holdings-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                {headers.map((header) => {
                  const val = item[header]
                  return (
                    <td key={`${index}-${header}`}>
                      {typeof val === 'object' && val !== null
                        ? JSON.stringify(val)
                        : String(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <main className="site">
       <div className="warning-banner" role="alert" aria-live="polite">
        <p>Wallet Data Viewer</p>
      </div>

      <h1 className="site-header">Big Money Crypto - Wallet PnL</h1>

      {loading && <p className="status">Loading wallet data...</p>}
      {error && <p className="status error">{error}</p>}
      
      {!loading && !error && renderContent()}
    </main>
  )
}

export default App
