import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabaseClient'

type Holding = {
  symbol: string
  bought_at: string
  buy_price: number
  sell_price: number | null
  mint_address: string
}

function App() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadHoldings = async () => {
      setLoading(true)
      setError(null)

      const selectColumns = 'symbol, bought_at, buy_price, sell_price, mint_address'

      const firstTry = await supabase
        .from('Holdings')
        .select(selectColumns)
        .order('bought_at', { ascending: false })

      if (!firstTry.error) {
        setHoldings((firstTry.data ?? []) as Holding[])
        setLoading(false)
        return
      }

      const secondTry = await supabase
        .from('holdings')
        .select(selectColumns)
        .order('bought_at', { ascending: false })

      if (secondTry.error) {
        setError(secondTry.error.message)
      } else {
        setHoldings((secondTry.data ?? []) as Holding[])
      }

      setLoading(false)
    }

    loadHoldings()
  }, [])

  return (
    <main className="site">
      <h1 className="site-header">Big Money Crypto</h1>

      {loading && <p className="status">Loading holdings...</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && (
        <div className="table-wrap">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Bought At</th>
                <th>Buy Price</th>
                <th>Sell Price</th>
                <th>Mint Address</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((row) => (
                <tr key={`${row.symbol}-${row.bought_at}`}>
                  <td>{row.symbol}</td>
                  <td>{new Date(row.bought_at).toLocaleString()}</td>
                  <td>{row.buy_price}</td>
                  <td>{row.sell_price ?? '-'}</td>
                  <td className="mint-cell">{row.mint_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

export default App
