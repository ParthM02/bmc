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
    const url = new URL('https://public-api.birdeye.so/wallet/v2/pnl/details')
    url.searchParams.append('wallet', walletAddress)

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
        'accept': 'application/json'
      }
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
