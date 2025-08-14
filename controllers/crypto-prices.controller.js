import axios from 'axios';
import { CMC_API_KEY } from '../config/env.js';

// Simple in-memory cache to reduce external API calls
let cache = { timestamp: 0, data: null };
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

class CryptoPricesController {
  static async getLatestPrices(req, res) {
    try {
      // Serve from cache if still valid
      if (cache.data && (Date.now() - cache.timestamp) < CACHE_TTL_MS) {
        return res.json({ success: true, cached: true, count: cache.data.length, data: cache.data });
      }

      const apiKey = CMC_API_KEY || 'REPLACE_ME';
      if (!apiKey || apiKey === 'REPLACE_ME') {
        return res.status(500).json({ success: false, message: 'CoinMarketCap API key not configured (set CMC_API_KEY)' });
      }

      const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';
      const response = await axios.get(url, {
        headers: { 'X-CMC_PRO_API_KEY': apiKey },
        params: { convert: 'USD' },
        timeout: 15000
      });

      if (!response.data || !Array.isArray(response.data.data)) {
        return res.status(502).json({ success: false, message: 'Unexpected response format from CoinMarketCap' });
      }

      const mapped = response.data.data.map(asset => ({
        token: asset.symbol,
        price: asset.quote?.USD?.price ?? null
      })).filter(x => x.price !== null);

      cache = { timestamp: Date.now(), data: mapped };

      res.json({ success: true, cached: false, count: mapped.length, data: mapped });
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.status?.error_message || error.message;
      res.status(status && status >= 400 ? status : 500).json({
        success: false,
        message: 'Failed to fetch crypto prices',
        error: message
      });
    }
  }
}

export default CryptoPricesController;
