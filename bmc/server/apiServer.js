import express from 'express'

const app = express()
const port = Number(process.env.API_PORT ?? 8787)

const GECKO_BASE_URL = 'https://api.geckoterminal.com/api/v2'

const nullBestSell = {
  bestSellAt: null,
  bestSellPrice: null,
  bestPlPercent: null,
}

const fetchTopSolanaPoolAddress = async (tokenAddress) => {
  const poolsResponse = await fetch(
    `${GECKO_BASE_URL}/networks/solana/tokens/${tokenAddress}/pools?page=1`,
  )

  if (!poolsResponse.ok) {
    throw new Error(`Failed to load pools for ${tokenAddress}`)
  }

  const poolsJson = await poolsResponse.json()
  const topPoolAddress = poolsJson?.data?.[0]?.attributes?.address

  if (!topPoolAddress) {
    throw new Error(`No pool found for ${tokenAddress}`)
  }

  return topPoolAddress
}

const fetchAllMinuteCandles = async (poolAddress) => {
  const candles = []
  let beforeTimestamp = null
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

    const ohlcvJson = await ohlcvResponse.json()
    const ohlcvList = ohlcvJson?.data?.attributes?.ohlcv_list ?? []

    if (ohlcvList.length === 0) break

    const pageCandles = ohlcvList
      .map((row) => ({
        timestamp: Number(row[0]),
        high: Number(row[2]),
      }))
      .filter((row) => Number.isFinite(row.timestamp) && Number.isFinite(row.high) && row.high > 0)

    candles.push(...pageCandles)

    if (pageCandles.length === 0) break

    const oldestTimestamp = Math.min(...pageCandles.map((row) => row.timestamp))
    beforeTimestamp = oldestTimestamp - 60

    pageCount += 1
    if (ohlcvList.length < 1000) break
  }

  const uniqueByTimestamp = new Map()
  for (const candle of candles) {
    uniqueByTimestamp.set(candle.timestamp, candle)
  }

  return Array.from(uniqueByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp)
}

const computeBestSell = ({ buyPrice, boughtAt }, candles) => {
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
    return nullBestSell
  }

  const boughtAtUnixSeconds = Math.floor(new Date(boughtAt).getTime() / 1000)
  if (!Number.isFinite(boughtAtUnixSeconds) || boughtAtUnixSeconds <= 0) {
    return nullBestSell
  }

  const afterBuyCandles = candles.filter((candle) => candle.timestamp >= boughtAtUnixSeconds)
  if (afterBuyCandles.length === 0) {
    return nullBestSell
  }

  const bestCandle = afterBuyCandles.reduce((best, current) =>
    current.high > best.high ? current : best,
  )

  const bestPlPercent = ((bestCandle.high - buyPrice) / buyPrice) * 100

  return {
    bestSellAt: new Date(bestCandle.timestamp * 1000).toISOString(),
    bestSellPrice: bestCandle.high,
    bestPlPercent,
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/best-sell', async (req, res) => {
  const mintAddress = String(req.query.mintAddress ?? '')
  const boughtAt = String(req.query.boughtAt ?? '')
  const buyPrice = Number(req.query.buyPrice)

  if (!mintAddress || !boughtAt || !Number.isFinite(buyPrice)) {
    res.status(400).json({ error: 'mintAddress, boughtAt, and buyPrice are required' })
    return
  }

  try {
    const poolAddress = await fetchTopSolanaPoolAddress(mintAddress)
    const minuteCandles = await fetchAllMinuteCandles(poolAddress)
    const result = computeBestSell({ buyPrice, boughtAt }, minuteCandles)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown API error'
    res.status(502).json({ error: message })
  }
})

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
