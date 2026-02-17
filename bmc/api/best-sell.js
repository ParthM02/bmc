const GECKO_BASE_URL = 'https://api.geckoterminal.com/api/v2'

const nullBestSell = {
  bestSellAt: null,
  bestSellPrice: null,
  bestPlPercent: null,
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchJsonWithRetry(url, attempts = 3) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      })

      if (response.ok) {
        return await response.json()
      }

      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === attempts) {
        throw new Error(`Upstream ${response.status} for ${url}`)
      }

      await sleep(250 * attempt)
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await sleep(250 * attempt)
      }
    }
  }

  throw lastError ?? new Error('Unknown upstream error')
}

async function fetchTopSolanaPoolAddress(tokenAddress) {
  const poolsJson = await fetchJsonWithRetry(
    `${GECKO_BASE_URL}/networks/solana/tokens/${tokenAddress}/pools?page=1`,
  )
  const topPoolAddress = poolsJson?.data?.[0]?.attributes?.address

  if (!topPoolAddress) {
    throw new Error(`No pool found for ${tokenAddress}`)
  }

  return topPoolAddress
}

async function fetchAllMinuteCandles(poolAddress, stopBeforeTimestamp) {
  const candles = []
  let beforeTimestamp = null
  let pageCount = 0
  const maxPages = 100

  while (pageCount < maxPages) {
    const beforeQuery = beforeTimestamp === null ? '' : `&before_timestamp=${beforeTimestamp}`
    const ohlcvJson = await fetchJsonWithRetry(
      `${GECKO_BASE_URL}/networks/solana/pools/${poolAddress}/ohlcv/minute?aggregate=1&limit=1000${beforeQuery}`,
    )
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

    if (Number.isFinite(stopBeforeTimestamp) && oldestTimestamp <= stopBeforeTimestamp) {
      break
    }

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

function computeBestSell({ buyPrice, boughtAt }, candles) {
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const mintAddress = String(req.query.mintAddress ?? '')
  const boughtAt = String(req.query.boughtAt ?? '')
  const buyPrice = Number(req.query.buyPrice)

  if (!mintAddress || !boughtAt || !Number.isFinite(buyPrice)) {
    res.status(400).json({ error: 'mintAddress, boughtAt, and buyPrice are required' })
    return
  }

  try {
    const boughtAtUnixSeconds = Math.floor(new Date(boughtAt).getTime() / 1000)
    const poolAddress = await fetchTopSolanaPoolAddress(mintAddress)
    const minuteCandles = await fetchAllMinuteCandles(poolAddress, boughtAtUnixSeconds)
    const result = computeBestSell({ buyPrice, boughtAt }, minuteCandles)
    res.status(200).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown API error'
    console.error(`best-sell failed for ${mintAddress}:`, message)
    res.status(200).json({
      ...nullBestSell,
      warning: message,
    })
  }
}
