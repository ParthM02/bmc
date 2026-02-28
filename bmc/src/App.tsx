import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

type TableRow = Record<string, unknown>

const isTableRow = (value: unknown): value is TableRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTableRowArray = (value: unknown): value is TableRow[] =>
  Array.isArray(value) && value.every(isTableRow)

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatCompactNumber = (value: unknown, maxFractionDigits = 2): string => {
  const num = toNumber(value)
  if (num === null) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFractionDigits }).format(num)
}

const formatUsd = (value: unknown): string => {
  const num = toNumber(value)
  if (num === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

const formatPercent = (value: unknown): string => {
  const num = toNumber(value)
  if (num === null) return '—'
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num)}%`
}

const formatTokenPrice = (value: unknown): string => {
  const num = toNumber(value)
  if (num === null) return '—'
  if (Math.abs(num) < 0.0001 && num !== 0) return num.toExponential(2)
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(num)
}

const shortenAddress = (value: unknown): string => {
  if (typeof value !== 'string' || value.length <= 14) return typeof value === 'string' ? value : '—'
  return `${value.slice(0, 6)}...${value.slice(-6)}`
}

const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112'

const isSolToken = (item: TableRow): boolean => {
  const symbol = typeof item.symbol === 'string' ? item.symbol.toUpperCase() : ''
  const address = typeof item.address === 'string' ? item.address : ''
  return symbol === 'SOL' || address === SOL_MINT_ADDRESS
}

const isStableToken = (item: TableRow): boolean => {
  const symbol = typeof item.symbol === 'string' ? item.symbol.toUpperCase() : ''
  return symbol === 'USDC' || symbol === 'USDT'
}

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

    const walletDataObject = isTableRow(walletDataData) ? walletDataData : null
    const summary = walletDataObject && isTableRow(walletDataObject.summary) ? walletDataObject.summary : null
    const summaryCounts = summary && isTableRow(summary.counts) ? summary.counts : null
    const summaryPnl = summary && isTableRow(summary.pnl) ? summary.pnl : null
    const summaryCashflow = summary && isTableRow(summary.cashflow_usd) ? summary.cashflow_usd : null
    const memeCoinsHeld = items.filter((item) => !isSolToken(item) && !isStableToken(item)).length
    const roiValues = items
      .filter((item) => !isSolToken(item) && !isStableToken(item))
      .map((item) => {
        const pnl = isTableRow(item.pnl) ? item.pnl : null
        return toNumber(pnl?.total_percent)
      })
      .filter((value): value is number => value !== null)
    const averageRoi = roiValues.length > 0
      ? roiValues.reduce((sum, value) => sum + value, 0) / roiValues.length
      : null

    return (
      <>
        {summary && (
          <section className="summary-grid" aria-label="Wallet summary">
            <article className="summary-card">
              <span className="summary-label">Meme Coins Held</span>
              <strong className="summary-value">{formatCompactNumber(memeCoinsHeld, 0)}</strong>
            </article>
            <article className="summary-card">
              <span className="summary-label">Average ROI</span>
              <strong className={`summary-value ${averageRoi !== null && averageRoi >= 0 ? 'pl-positive' : 'pl-negative'}`}>
                {formatPercent(averageRoi)}
              </strong>
            </article>
            <article className="summary-card">
              <span className="summary-label">Win Rate</span>
              <strong className="summary-value">{formatPercent(toNumber(summaryCounts?.win_rate) !== null ? Number(summaryCounts?.win_rate) * 100 : null)}</strong>
            </article>
            <article className="summary-card">
              <span className="summary-label">Realized PnL</span>
              <strong className={`summary-value ${toNumber(summaryPnl?.realized_profit_usd) !== null && Number(summaryPnl?.realized_profit_usd) >= 0 ? 'pl-positive' : 'pl-negative'}`}>
                {formatUsd(summaryPnl?.realized_profit_usd)}
              </strong>
            </article>
            <article className="summary-card">
              <span className="summary-label">Current Value</span>
              <strong className="summary-value">{formatUsd(summaryCashflow?.current_value)}</strong>
            </article>
          </section>
        )}

        <div className="table-wrap">
          <table className="holdings-table readable-table">
            <thead>
              <tr>
                <th>Token</th>
                <th className="num">Trades</th>
                <th className="num">Bought</th>
                <th className="num">Sold</th>
                <th className="num">Invested</th>
                <th className="num">Sold (USD)</th>
                <th className="num">Realized PnL</th>
                <th className="num">PnL %</th>
                <th className="num">Holding</th>
                <th className="num">Avg Buy</th>
                <th className="num">Avg Sell</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const counts = isTableRow(item.counts) ? item.counts : null
                const quantity = isTableRow(item.quantity) ? item.quantity : null
                const cashflowUsd = isTableRow(item.cashflow_usd) ? item.cashflow_usd : null
                const pnl = isTableRow(item.pnl) ? item.pnl : null
                const pricing = isTableRow(item.pricing) ? item.pricing : null
                const realizedPnl = toNumber(pnl?.realized_profit_usd)
                const pnlPercent = toNumber(pnl?.total_percent)

                return (
                  <tr key={index}>
                    <td className="token-cell">
                      <span className="token-symbol">{typeof item.symbol === 'string' ? item.symbol : 'Unknown'}</span>
                      <span className="token-address" title={typeof item.address === 'string' ? item.address : ''}>
                        {shortenAddress(item.address)}
                      </span>
                    </td>
                    <td className="num">{formatCompactNumber(counts?.total_trade, 0)}</td>
                    <td className="num">{formatCompactNumber(quantity?.total_bought_amount, 4)}</td>
                    <td className="num">{formatCompactNumber(quantity?.total_sold_amount, 4)}</td>
                    <td className="num">{formatUsd(cashflowUsd?.total_invested)}</td>
                    <td className="num">{formatUsd(cashflowUsd?.total_sold)}</td>
                    <td className={`num ${realizedPnl !== null && realizedPnl >= 0 ? 'pl-positive' : 'pl-negative'}`}>
                      {formatUsd(realizedPnl)}
                    </td>
                    <td className={`num ${pnlPercent !== null && pnlPercent >= 0 ? 'pl-positive' : 'pl-negative'}`}>
                      {formatPercent(pnlPercent)}
                    </td>
                    <td className="num">{formatCompactNumber(quantity?.holding, 6)}</td>
                    <td className="num">{formatTokenPrice(pricing?.avg_buy_cost)}</td>
                    <td className="num">{formatTokenPrice(pricing?.avg_sell_cost)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <section className="legal-disclaimer" aria-label="Legal disclaimer and terms of use">
          <h2>BIG MONEY CRYPTO – LEGAL DISCLAIMER &amp; TERMS OF USE</h2>
          <ol>
            <li>
              <h3>No Financial, Legal, or Tax Advice</h3>
              <p>
                The information provided on the Big Money Crypto website, including but not limited to
                investment strategies, market analysis, portfolio updates, and general content, is for
                informational and educational purposes only. Nothing on this website constitutes professional
                financial, investment, legal, or tax advice. You should consult with a licensed professional
                before making any financial decisions.
              </p>
            </li>
            <li>
              <h3>Extreme Risk and Volatility (The "Meme Coin" Risk)</h3>
              <p>
                Investments in cryptocurrencies—and specifically "meme coins" or micro-cap digital assets—are
                fundamentally speculative, highly unregulated, and incredibly volatile. These assets are
                subject to extreme price fluctuations, illiquidity, "rug pulls," smart contract
                vulnerabilities, and total loss of value. By engaging with Big Money Crypto, you expressly
                acknowledge that you may lose 100% of your invested capital. Do not invest money you cannot
                afford to lose completely.
              </p>
            </li>
            <li>
              <h3>Not an Offer or Solicitation</h3>
              <p>
                This website does not constitute an offer to sell, a solicitation of an offer to buy, or a
                recommendation of any security, investment product, or service. Any potential offer or
                solicitation for investment in Big Money Crypto will be made only through a formal Confidential
                Private Placement Memorandum (PPM), Subscription Agreement, and related fund documents, and
                will be legally restricted to qualified, accredited investors in jurisdictions where such
                offers are lawful.
              </p>
            </li>
            <li>
              <h3>Limitation of Liability</h3>
              <p>
                To the maximum extent permitted by applicable law, Big Money Crypto, its fund managers,
                developers, affiliates, officers, and employees shall not be held liable for any direct,
                indirect, incidental, consequential, or punitive damages arising out of your use of this
                website or reliance on any information provided herein. You agree to assume full
                responsibility for any trading or investment decisions you make.
              </p>
            </li>
            <li>
              <h3>Accuracy of Information</h3>
              <p>
                While Big Money Crypto strives to provide accurate and up-to-date information, the
                cryptocurrency market moves rapidly. We make no representations, warranties, or guarantees,
                express or implied, regarding the accuracy, completeness, or reliability of any data, charts,
                or content provided on this site.
              </p>
            </li>
            <li>
              <h3>Past Performance and Forward-Looking Statements</h3>
              <p>
                Past performance is not indicative of future results. Any forward-looking statements,
                projections, or targets mentioned on this site are based on current market assumptions and are
                subject to significant risks and uncertainties. Actual results may differ materially.
              </p>
            </li>
            <li>
              <h3>"Do Your Own Research" (DYOR)</h3>
              <p>
                All users and prospective investors are solely responsible for conducting their own independent
                research and due diligence. Big Money Crypto assumes no fiduciary duty to website visitors.
              </p>
            </li>
          </ol>
        </section>
      </>
    )
  }

  return (
    <main className="site">
      <h1 className="site-header">Big Money Crypto - Fund PnL</h1>

      {loading && <p className="status">Loading wallet data...</p>}
      {error && <p className="status error">{error}</p>}
      
      {!loading && !error && renderContent()}
    </main>
  )
}

export default App
