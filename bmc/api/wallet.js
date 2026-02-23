export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.BIRDEYE_API_KEY
  const walletAddress = process.env.WALLET_ADDRESS

  if (!apiKey || !walletAddress) {
    console.error('Missing BIRDEYE_API_KEY or WALLET_ADDRESS')
    res.status(500).json({ error: 'Server configuration error' })
    return
  }

  try {
    const response = await fetch('https://public-api.birdeye.so/wallet/v2/pnl/details', {
      method: 'POST',
      headers: {
        'x-chain': 'solana',
        accept: 'application/json',
        'content-type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify({
        duration: 'all',
        sort_type: 'desc',
        sort_by: 'last_trade',
        limit: 100,
        offset: 0,
        wallet: walletAddress
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`BirdEye API error (${response.status}): ${errorText}`)
      throw new Error(`Upstream API error: ${response.status}`)
    }

    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    console.error('Wallet API handler failed:', error)
    res.status(500).json({ error: 'Failed to fetch wallet data' })
  }
}
