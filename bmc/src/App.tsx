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

type BestSellInfo = {
  bestSellAt: string | null
  bestSellPrice: number | null
  bestPlPercent: number | null
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

const fetchBestSellInfoFromApi = async (holding: Holding): Promise<BestSellInfo> => {
  const query = new URLSearchParams({
    mintAddress: holding.mint_address,
    boughtAt: holding.bought_at,
    buyPrice: String(holding.buy_price),
  })

  const response = await fetch(`${API_BASE_URL}/api/best-sell?${query.toString()}`)

  if (!response.ok) {
    throw new Error(`Best sell API failed for ${holding.mint_address}`)
  }

  const data = (await response.json()) as BestSellInfo

  return {
    bestSellAt: data.bestSellAt ?? null,
    bestSellPrice: data.bestSellPrice ?? null,
    bestPlPercent: data.bestPlPercent ?? null,
  }
}

const formatTokenPrice = (value: number | null) => {
  if (value === null) return '-'
  if (value === 0) return '0'
  if (value >= 1) return value.toFixed(4)
  if (value >= 0.01) return value.toFixed(6)
  return value.toFixed(12).replace(/0+$/, '').replace(/\.$/, '')
}

const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function App() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bestSellByHolding, setBestSellByHolding] = useState<Record<string, BestSellInfo>>({})
  const [bestSellLoading, setBestSellLoading] = useState(false)

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

  useEffect(() => {
    if (holdings.length === 0) {
      return
    }

    let cancelled = false

    const loadBestSellTimes = async () => {
      setBestSellLoading(true)
      const nextBestSellByHolding: Record<string, BestSellInfo> = {}

      for (const holding of holdings) {
        const key = `${holding.symbol}-${holding.bought_at}`

        try {
          nextBestSellByHolding[key] = await fetchBestSellInfoFromApi(holding)
        } catch {
          nextBestSellByHolding[key] = {
            bestSellAt: null,
            bestSellPrice: null,
            bestPlPercent: null,
          }
        }
      }

      if (!cancelled) {
        setBestSellByHolding(nextBestSellByHolding)
        setBestSellLoading(false)
      }
    }

    loadBestSellTimes()

    return () => {
      cancelled = true
    }
  }, [holdings])

  const investmentPerCoin = 0.5
  const validInvestments = holdings.filter((holding) => holding.buy_price > 0)
  const startingCapital: number = 5
  const maxAffordableCoins = Math.floor(startingCapital / investmentPerCoin)
  const simulatedInvestments = validInvestments.slice(0, maxAffordableCoins)
  const investedCapital = simulatedInvestments.length * investmentPerCoin
  const uninvestedCash = startingCapital - investedCapital

  const investmentValue = simulatedInvestments.reduce((total, holding) => {
    if (holding.sell_price === null) {
      return total + investmentPerCoin
    }

    return total + investmentPerCoin * (holding.sell_price / holding.buy_price)
  }, 0)

  const endingCapital = uninvestedCash + investmentValue

  const totalGainLossAbsolute = endingCapital - startingCapital
  const totalGainLossPercent =
    startingCapital === 0 ? 0 : (totalGainLossAbsolute / startingCapital) * 100

  const closedInvestments = simulatedInvestments.filter((holding) => holding.sell_price !== null)
  const winningInvestments = closedInvestments.filter(
    (holding) => (holding.sell_price as number) > holding.buy_price,
  ).length
  const winRatePercent =
    closedInvestments.length === 0 ? null : (winningInvestments / closedInvestments.length) * 100
  const averageRoiPercent =
    closedInvestments.length === 0
      ? null
      : closedInvestments.reduce((total, holding) => {
          const sellPrice = holding.sell_price as number
          return total + ((sellPrice - holding.buy_price) / holding.buy_price) * 100
        }, 0) / closedInvestments.length

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
      {!loading && !error && bestSellLoading && (
        <p className="status">Loading best sell times from GeckoTerminal...</p>
      )}

      {!loading && !error && (
        <>
          <h2 className="section-title">Performance</h2>
          <div className="table-wrap">
            <table className="holdings-table performance-table">
              <thead>
                <tr>
                  <th>Starting Capital</th>
                  <th>Investment / Coin</th>
                  <th>Ending Capital</th>
                  <th>Total G/L</th>
                  <th>Total G/L %</th>
                  <th>Average ROI</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{currencyFormatter.format(startingCapital)}</td>
                  <td>{currencyFormatter.format(investmentPerCoin)}</td>
                  <td>{currencyFormatter.format(endingCapital)}</td>
                  <td className={totalGainLossAbsolute >= 0 ? 'pl-positive' : 'pl-negative'}>
                    {currencyFormatter.format(totalGainLossAbsolute)}
                  </td>
                  <td className={totalGainLossPercent >= 0 ? 'pl-positive' : 'pl-negative'}>
                    {totalGainLossPercent.toFixed(2)}%
                  </td>
                  <td className={averageRoiPercent === null ? '' : averageRoiPercent >= 0 ? 'pl-positive' : 'pl-negative'}>
                    {averageRoiPercent === null ? '-' : `${averageRoiPercent.toFixed(2)}%`}
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

          <h2 className="section-title">Trades</h2>
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
                  <th>Best Sell At</th>
                  <th>Best Sell Price</th>
                  <th>Best P/L %</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((row) => {
                  const profitLossPercent = getProfitLossPercent(row.buy_price, row.sell_price)
                  const key = `${row.symbol}-${row.bought_at}`
                  const bestSellInfo = bestSellByHolding[key]
                  const bestPlPercent = bestSellInfo?.bestPlPercent ?? null

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
                      <td>{formatDateTime(bestSellInfo?.bestSellAt ?? null)}</td>
                      <td>{formatTokenPrice(bestSellInfo?.bestSellPrice ?? null)}</td>
                      <td
                        className={
                          bestPlPercent === null
                            ? ''
                            : bestPlPercent >= 0
                              ? 'pl-positive'
                              : 'pl-negative'
                        }
                      >
                        {bestPlPercent === null ? '-' : `${bestPlPercent.toFixed(2)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <section className="algo-transparency">
            <h2>Algo Transparency</h2>
            <ul>
              <li>Feb 18 - Algo V2.5, no test reset</li>
              <li>Feb 17 - Algo V2, test reset</li>
              <li>Feb 16 - Algo V1 released</li>
            </ul>
          </section>
        </>
      )}
    </main>
  )
}

export default App
