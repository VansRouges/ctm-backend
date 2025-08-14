import axios from 'axios';

// Simple cache to minimize external API calls
const CACHE_TTL_MS = 60 * 1000; // 1 minute
let cache = { timestamp: 0, data: [] };

async function refreshCache() {
  const apiKey = process.env.CMC_API_KEY || process.env.COINMARKETCAP_API_KEY || process.env.CMC_PRO_API_KEY;
  if (!apiKey) throw new Error('CoinMarketCap API key not configured');
  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';
  const { data } = await axios.get(url, {
    headers: { 'X-CMC_PRO_API_KEY': apiKey },
    params: { convert: 'USD' },
    timeout: 15000
  });
  if (!data || !Array.isArray(data.data)) throw new Error('Unexpected API response format');
  cache = {
    timestamp: Date.now(),
    data: data.data.map(a => ({
      name: a.name,
      symbol: a.symbol,
      price: a.quote?.USD?.price ?? null
    })).filter(x => x.price !== null)
  };
}

export async function getTokenPrice(tokenNameOrSymbol) {
  const now = Date.now();
  if (!cache.data.length || (now - cache.timestamp) > CACHE_TTL_MS) {
    await refreshCache();
  }
  const needle = tokenNameOrSymbol.toLowerCase();
  const found = cache.data.find(a => a.name.toLowerCase() === needle || a.symbol.toLowerCase() === needle);
  if (!found) throw new Error(`Token price not found for ${tokenNameOrSymbol}`);
  return found.price;
}
