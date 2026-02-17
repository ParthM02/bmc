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

  const getProfitLossPercent = (buyPrice: number, sellPrice: number | null) => {
    if (sellPrice === null || buyPrice === 0) return null
    return ((sellPrice - buyPrice) / buyPrice) * 100
  }

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

  const investmentPerCoin = 0.5
  const validInvestments = holdings.filter((holding) => holding.buy_price > 0)
  const startingCapital: number = 5

  const endingCapital = validInvestments.reduce((total, holding) => {
    if (holding.sell_price === null) {
      return total + investmentPerCoin
    }

    return total + investmentPerCoin * (holding.sell_price / holding.buy_price)
  }, 0)

  const totalGainLossAbsolute = endingCapital - startingCapital
  const totalGainLossPercent =
    startingCapital === 0 ? 0 : (totalGainLossAbsolute / startingCapital) * 100

  const closedInvestments = validInvestments.filter((holding) => holding.sell_price !== null)
  const winningInvestments = closedInvestments.filter(
    (holding) => (holding.sell_price as number) > holding.buy_price,
  ).length
  const winRatePercent =
    closedInvestments.length === 0 ? null : (winningInvestments / closedInvestments.length) * 100

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <main className="site">
      <h1 className="site-header">Big Money Crypto</h1>

      {loading && <p className="status">Loading holdings...</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="table-wrap">
            <table className="holdings-table performance-table">
              <thead>
                <tr>
                  <th>Starting Capital</th>
                  <th>Investment / Coin</th>
                  <th>Coins</th>
                  <th>Ending Capital</th>
                  <th>Total G/L</th>
                  <th>Total G/L %</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{currencyFormatter.format(startingCapital)}</td>
                  <td>{currencyFormatter.format(investmentPerCoin)}</td>
                  <td>{validInvestments.length}</td>
                  <td>{currencyFormatter.format(endingCapital)}</td>
                  <td className={totalGainLossAbsolute >= 0 ? 'pl-positive' : 'pl-negative'}>
                    {currencyFormatter.format(totalGainLossAbsolute)}
                  </td>
                  <td className={totalGainLossPercent >= 0 ? 'pl-positive' : 'pl-negative'}>
                    {totalGainLossPercent.toFixed(2)}%
                  </td>
                  <td>
                    {winRatePercent === null
                      ? '-'
                      : `${winRatePercent.toFixed(2)}% (${winningInvestments}/${closedInvestments.length})`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="table-wrap">
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Mint Address</th>
                  <th>Bought At</th>
                  <th>Buy Price</th>
                  <th>Sell Price</th>
                  <th>P/L %</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((row) => {
                  const profitLossPercent = getProfitLossPercent(row.buy_price, row.sell_price)

                  return (
                    <tr key={`${row.symbol}-${row.bought_at}`}>
                      <td>{row.symbol}</td>
                      <td className="mint-cell">{row.mint_address}</td>
                      <td>{new Date(row.bought_at).toLocaleString()}</td>
                      <td>{row.buy_price}</td>
                      <td>{row.sell_price ?? '-'}</td>
                      <td
                        className={
                          profitLossPercent === null
                            ? ''
                            : profitLossPercent >= 0
                              ? 'pl-positive'
                              : 'pl-negative'
                        }
                      >
                        {profitLossPercent === null ? '-' : `${profitLossPercent.toFixed(2)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}

export default App
