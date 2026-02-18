import { createClient } from 'jsr:@supabase/supabase-js@2'

console.info('Edge Function started')

// Helper to fetch prices from Jupiter V3 API
async function fetchJupiterPrices(mintAddresses: string[]) {
  if (mintAddresses.length === 0) return {}
  
  try {
    // Jupiter allows up to 100 mints per request
    const ids = mintAddresses.slice(0, 100).join(',')
    const url = `https://lite-api.jup.ag/price/v3?ids=${ids}`
    
    const response = await fetch(url)
    if (!response.ok) throw new Error('Jupiter API failed')
    
    const data = await response.json()
    return data // Returns object like { "mint1": { usdPrice: ... }, ... }
  } catch (error) {
    console.error('Error fetching prices:', error)
    return {}
  }
}

Deno.serve(async (req: Request) => {
  try {
    // 1. Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // --- Random Delay (1s to 30s) ---
    const waitTime = Math.floor(Math.random() * 29000) + 1000
    console.log(`Delaying request by ${waitTime}ms...`)
    await new Promise((resolve) => setTimeout(resolve, waitTime))

    // ==========================================================
    // LOGIC PART A: FIND NEW MEMES & "BUY"
    // ==========================================================
    
    // 2. Fetch data from Frenzy API
    const apiUrl = 'https://frenzy-next-rest-api.preview.frenzy.fun/v1/token/latest?count=20&includeWithoutTopics=false&skipTradeData=false'
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })
    
    const jsonData = await response.json()
    if (!jsonData.data || !jsonData.data.data) throw new Error('Invalid API response')
    const tokens = jsonData.data.data

    // 3. Check for duplicates in 'Meme List'
    const { data: existingRows, error: selectError } = await supabase
      .from('Meme List')
      .select('symbol')
    
    if (selectError) throw selectError
    const existingSymbols = new Set(existingRows?.map(row => row.symbol) || [])

    // 4. Identify NEW tokens
    const newTokens = tokens.filter((token: any) => !existingSymbols.has(token.symbol))
    
    let boughtCount = 0

    if (newTokens.length > 0) {
      console.log(`Found ${newTokens.length} new tokens. Processing buys...`)

      // A. Insert into 'Meme List'
      const memeRecords = newTokens.map((token: any) => ({
        symbol: token.symbol,
        found_at: new Date().toISOString(),
        mint_address: token.tokenMint
      }))
      
      await supabase.from('Meme List').insert(memeRecords)

      // B. Fetch Prices for 'Buy' Simulation
      const newMints = newTokens.map((t: any) => t.tokenMint)
      const prices = await fetchJupiterPrices(newMints)

      // C. Insert into 'Holdings'
      const holdingsRecords = newTokens.map((token: any) => {
        const priceData = prices[token.tokenMint]
        return {
          symbol: token.symbol,
          mint_address: token.tokenMint,
          bought_at: new Date().toISOString(),
          buy_price: priceData ? priceData.usdPrice : 0, // Default to 0 if price fetch fails
          sell_price: null // Not sold yet
        }
      })

      const { error: holdingsError } = await supabase.from('Holdings').insert(holdingsRecords)
      if (holdingsError) console.error('Error inserting holdings:', holdingsError)
      else boughtCount = holdingsRecords.length
    }

    // ==========================================================
    // LOGIC PART B: CHECK HOLDINGS & "SELL" (> 50% PROFIT OR > 16 HOURS)
    // ==========================================================

    // 5. Fetch active holdings (not sold yet)
    const { data: activeHoldings, error: activeError } = await supabase
      .from('Holdings')
      .select('*')
      .is('sell_price', null) // Filter where sell_price is null

    let soldCount = 0
    
    if (!activeError && activeHoldings && activeHoldings.length > 0) {
      const now = Date.now()
      const sixteenHours = 16 * 60 * 60 * 1000

      // Fetch current prices for all active holdings
      const activeMints = activeHoldings.map((h: any) => h.mint_address)
      const currentPrices = await fetchJupiterPrices(activeMints)

      // Sell if either:
      // 1) current price is > 50% above buy price, OR
      // 2) holding has been open for more than 16 hours
      const coinsToSell = activeHoldings.filter((h: any) => {
        const buyPrice = Number(h.buy_price) || 0
        const boughtTime = new Date(h.bought_at).getTime()
        const heldOver16Hours = Number.isFinite(boughtTime) && (now - boughtTime) > sixteenHours

        if (heldOver16Hours) return true
        if (buyPrice <= 0) return false

        const currentPrice = Number(currentPrices[h.mint_address]?.usdPrice) || 0
        return currentPrice > buyPrice * 1.5
      })

      if (coinsToSell.length > 0) {
        console.log(`Found ${coinsToSell.length} coins ready to sell (50% profit or 16h timeout). Selling...`)

        // Update each record individually (or use upsert if you have a PK)
        // Using Promise.all for parallel updates
        await Promise.all(coinsToSell.map(async (holding: any) => {
          const currentPrice = currentPrices[holding.mint_address]?.usdPrice || 0
          
          await supabase
            .from('Holdings')
            .update({ sell_price: currentPrice })
            .eq('mint_address', holding.mint_address) // Assumes mint_address is unique per active holding
            .is('sell_price', null) // Safety check
        }))
        
        soldCount = coinsToSell.length
      }
    }

    // 6. Return Summary
    return new Response(
      JSON.stringify({ 
        message: 'Sync & Trade Simulation complete', 
        waited_ms: waitTime,
        new_memes_added: boughtCount,
        trades_closed: soldCount
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})