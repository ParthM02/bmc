export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.BIRDEYE_API_KEY
  const apiKeyTwo = process.env.BIRDEYE_API_KEY_2
  const walletAddress = process.env.WALLET_ADDRESS

  if ((!apiKey && !apiKeyTwo) || !walletAddress) {
    console.error('Missing BirdEye API key(s) or WALLET_ADDRESS')
    res.status(500).json({ error: 'Server configuration error' })
    return
  }

  try {
    const fetchWalletData = async (key) => {
      const response = await fetch('https://public-api.birdeye.so/wallet/v2/pnl/details', {
        method: 'POST',
        headers: {
          'x-chain': 'solana',
          accept: 'application/json',
          'content-type': 'application/json',
          'X-API-KEY': key
        },
        body: JSON.stringify({
          duration: 'all',
          sort_type: 'desc',
          sort_by: 'last_trade',
          limit: 50,
          offset: 0,
          wallet: walletAddress
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`BirdEye API error (${response.status}): ${errorText}`)
      }

      return response.json()
    }

    let data

    try {
      if (!apiKey) {
        throw new Error('Primary BirdEye API key is missing')
      }

      data = await fetchWalletData(apiKey)
    } catch (primaryError) {
      console.error('Primary BirdEye key failed:', primaryError)

      if (!apiKeyTwo) {
        throw primaryError
      }

      data = await fetchWalletData(apiKeyTwo)
    }

    res.status(200).json(data)
  } catch (error) {
    console.error('Wallet API handler failed:', error)
    res.status(500).json({ error: 'Failed to fetch wallet data' })
  }
}
