export type TableRow = Record<string, unknown>

export const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112'

export const isTableRow = (value: unknown): value is TableRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isTableRowArray = (value: unknown): value is TableRow[] =>
  Array.isArray(value) && value.every(isTableRow)

export const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const formatCompactNumber = (value: unknown, maxFractionDigits = 2): string => {
  const num = toNumber(value)
  if (num === null) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFractionDigits }).format(num)
}

export const formatUsd = (value: unknown): string => {
  const num = toNumber(value)
  if (num === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

export const formatPercent = (value: unknown): string => {
  const num = toNumber(value)
  if (num === null) return '—'
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num)}%`
}

export const formatTokenPrice = (value: unknown): string => {
  const num = toNumber(value)
  if (num === null) return '—'
  if (Math.abs(num) < 0.0001 && num !== 0) return num.toExponential(2)
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(num)
}

export const shortenAddress = (value: unknown): string => {
  if (typeof value !== 'string' || value.length <= 14) return typeof value === 'string' ? value : '—'
  return `${value.slice(0, 6)}...${value.slice(-6)}`
}

export const isSolToken = (item: TableRow): boolean => {
  const symbol = typeof item.symbol === 'string' ? item.symbol.toUpperCase() : ''
  const address = typeof item.address === 'string' ? item.address : ''
  return symbol === 'SOL' || address === SOL_MINT_ADDRESS
}

export const isStableToken = (item: TableRow): boolean => {
  const symbol = typeof item.symbol === 'string' ? item.symbol.toUpperCase() : ''
  return symbol === 'USDC' || symbol === 'USDT'
}

export const extractWalletItems = (walletData: unknown): TableRow[] | null => {
  const walletObject = isTableRow(walletData) ? walletData : null
  const walletDataData = walletObject?.data
  const walletDataItems = walletObject?.items
  const walletDataTokens = walletObject?.tokens

  if (isTableRowArray(walletData)) {
    return walletData
  }
  if (isTableRowArray(walletDataData)) {
    return walletDataData
  }
  if (isTableRow(walletDataData) && isTableRowArray(walletDataData.tokens)) {
    return walletDataData.tokens
  }
  if (isTableRow(walletDataData) && isTableRowArray(walletDataData.items)) {
    return walletDataData.items
  }
  if (isTableRowArray(walletDataItems)) {
    return walletDataItems
  }
  if (isTableRowArray(walletDataTokens)) {
    return walletDataTokens
  }

  // Some API responses include summary/meta but no token rows yet.
  // Treat these as a valid empty dataset so UI can still render the styled table shell.
  if (
    isTableRow(walletDataData) &&
    (Object.prototype.hasOwnProperty.call(walletDataData, 'summary') ||
      Object.prototype.hasOwnProperty.call(walletDataData, 'meta'))
  ) {
    return []
  }

  return null
}

export const extractWalletSummary = (walletData: unknown): TableRow | null => {
  const walletObject = isTableRow(walletData) ? walletData : null
  const walletDataData = walletObject?.data
  const walletDataObject = isTableRow(walletDataData) ? walletDataData : null
  return walletDataObject && isTableRow(walletDataObject.summary) ? walletDataObject.summary : null
}
