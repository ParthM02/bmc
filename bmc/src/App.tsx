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

type Candle = {
  timestamp: number
  high: number
}

type BestSellInfo = {
  bestSellAt: string | null
  bestSellPrice: number | null
  bestPlPercent: number | null
}

const GECKO_BASE_URL = 'https://api.geckoterminal.com/api/v2'

const fetchTopSolanaPoolAddress = async (tokenAddress: string) => {
  const poolsResponse = await fetch(
    `${GECKO_BASE_URL}/networks/solana/tokens/${tokenAddress}/pools?page=1`,
  )

  if (!poolsResponse.ok) {
    throw new Error(`Failed to load pools for ${tokenAddress}`)
  }

  const poolsJson = (await poolsResponse.json()) as {
    data?: Array<{ attributes?: { address?: string } }>
  }

  const topPoolAddress = poolsJson.data?.[0]?.attributes?.address
  if (!topPoolAddress) {
    throw new Error(`No pool found for ${tokenAddress}`)
  }

  return topPoolAddress
}

const fetchAllMinuteCandles = async (poolAddress: string) => {
  const candles: Candle[] = []
  let beforeTimestamp: number | null = null
  let pageCount = 0
  const maxPages = 100

  while (pageCount < maxPages) {
    const beforeQuery = beforeTimestamp === null ? '' : `&before_timestamp=${beforeTimestamp}`
    const ohlcvResponse = await fetch(
      `${GECKO_BASE_URL}/networks/solana/pools/${poolAddress}/ohlcv/minute?aggregate=1&limit=1000${beforeQuery}`,
    )

    if (!ohlcvResponse.ok) {
      throw new Error(`Failed to load candles for pool ${poolAddress}`)
    }

    const ohlcvJson = (await ohlcvResponse.json()) as {
      data?: {
        attributes?: {
          ohlcv_list?: Array<[number, string, string, string, string, string]>
        }
      }
    }

    const ohlcvList = ohlcvJson.data?.attributes?.ohlcv_list ?? []
    if (ohlcvList.length === 0) break

    const pageCandles = ohlcvList
      .map((row) => ({
        timestamp: row[0],
        high: Number(row[2]),
      }))
      .filter((row) => Number.isFinite(row.high) && row.high > 0)

    candles.push(...pageCandles)

    const oldestTimestamp = Math.min(...pageCandles.map((row) => row.timestamp))
    beforeTimestamp = oldestTimestamp - 60

    pageCount += 1
    if (ohlcvList.length < 1000) break
  }

  const uniqueByTimestamp = new Map<number, Candle>()
  for (const candle of candles) {
    uniqueByTimestamp.set(candle.timestamp, candle)
  }

  return Array.from(uniqueByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp)
}

const computeBestSellInfo = (holding: Holding, candles: Candle[]): BestSellInfo => {
  if (holding.buy_price <= 0) {
    return { bestSellAt: null, bestSellPrice: null, bestPlPercent: null }
  }

  const boughtAtUnixSeconds = Math.floor(new Date(holding.bought_at).getTime() / 1000)
  const afterBuyCandles = candles.filter((candle) => candle.timestamp >= boughtAtUnixSeconds)

  if (afterBuyCandles.length === 0) {
    return { bestSellAt: null, bestSellPrice: null, bestPlPercent: null }
  }

  const bestCandle = afterBuyCandles.reduce((best, current) =>
    current.high > best.high ? current : best,
  )

  const bestPlPercent = ((bestCandle.high - holding.buy_price) / holding.buy_price) * 100

  return {
    bestSellAt: new Date(bestCandle.timestamp * 1000).toLocaleString(),
    bestSellPrice: bestCandle.high,
    bestPlPercent,
  }
}

const formatTokenPrice = (value: number | null) => {
  if (value === null) return '-'
  if (value === 0) return '0'
  if (value >= 1) return value.toFixed(4)
  if (value >= 0.01) return value.toFixed(6)
  return value.toFixed(12).replace(/0+$/, '').replace(/\.$/, '')
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
      setBestSellByHolding({})
      return
    }

    let cancelled = false

    const loadBestSellTimes = async () => {
      setBestSellLoading(true)
      const nextBestSellByHolding: Record<string, BestSellInfo> = {}

      for (const holding of holdings) {
        const key = `${holding.symbol}-${holding.bought_at}`

        try {
          const poolAddress = await fetchTopSolanaPoolAddress(holding.mint_address)
          const minuteCandles = await fetchAllMinuteCandles(poolAddress)
          nextBestSellByHolding[key] = computeBestSellInfo(holding, minuteCandles)
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
          <div className="table-wrap">
            <table className="holdings-table performance-table">
              <thead>
                <tr>
                  <th>Starting Capital</th>
                  <th>Investment / Coin</th>
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
                      <td>{bestSellInfo?.bestSellAt ?? '-'}</td>
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
        </>
      )}
    </main>
  )
}

export default App
