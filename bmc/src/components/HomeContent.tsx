import { LegalDisclaimer } from './LegalDisclaimer'
import {
  extractWalletItems,
  extractWalletSummary,
  formatCompactNumber,
  formatPercent,
  formatTokenPrice,
  formatUsd,
  isSolToken,
  isStableToken,
  isTableRow,
  shortenAddress,
  toNumber
} from '../utils/wallet'

type HomeContentProps = {
  walletData: unknown
}

export const HomeContent = ({ walletData }: HomeContentProps) => {
  const items = extractWalletItems(walletData)
  const summary = extractWalletSummary(walletData)

  if (!items && !summary) {
    return (
      <section className="table-wrap raw-data-panel" aria-label="Wallet raw data">
        <h3 className="section-title">Raw Data</h3>
        <pre className="raw-data-pre">{JSON.stringify(walletData, null, 2)}</pre>
      </section>
    )
  }

  const safeItems = items ?? []
  const summaryCounts = summary && isTableRow(summary.counts) ? summary.counts : null
  const summaryPnl = summary && isTableRow(summary.pnl) ? summary.pnl : null
  const summaryCashflow = summary && isTableRow(summary.cashflow_usd) ? summary.cashflow_usd : null
  const memeCoinsHeld = safeItems.filter((item) => !isSolToken(item) && !isStableToken(item)).length
  const roiValues = safeItems
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
            {safeItems.length === 0 && (
              <tr>
                <td className="empty-state-cell" colSpan={11}>
                  No token holdings found for this wallet yet.
                </td>
              </tr>
            )}

            {safeItems.map((item, index) => {
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

      <LegalDisclaimer />
    </>
  )
}
