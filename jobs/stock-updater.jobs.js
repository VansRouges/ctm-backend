import axios from 'axios';
import Stock from '../model/stock.model.js';
import { FMP_API_KEY, UPDATE_INTERVAL_MINUTES } from '../config/env.js';

class StockUpdater {
  constructor() {
  this.apiKey = FMP_API_KEY || process.env.FMP_API_KEY || 'pQ6aapP6wgylhRNu2dmmjYWms4pNrIKy';
    this.baseUrl = 'https://financialmodelingprep.com/api/v3';
    this.exchanges = ['NASDAQ', 'NYSE', 'AMEX']; // Add more as needed
    this.isUpdating = false;
    this.lastUpdateTime = null;
    this.updateInterval = null;
  }

  // Fetch stock data from FMP API
  async fetchStockData(exchange) {
    try {
      console.log(`Fetching ${exchange} stock data...`);
      const url = `${this.baseUrl}/symbol/${exchange}?apikey=${this.apiKey}`;
      
      const response = await axios.get(url, {
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'Stock-App/1.0'
        }
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error(`Invalid response format for ${exchange}`);
      }

      console.log(`✓ Fetched ${response.data.length} stocks from ${exchange}`);
      return response.data;
      
    } catch (error) {
      console.error(`Error fetching ${exchange} data:`, error.message);
      throw error;
    }
  }

  // Process and clean stock data
  processStockData(rawData, exchange) {
    return rawData
      .filter(stock => stock.symbol && stock.name && stock.price !== null)
      .map(stock => ({
        symbol: stock.symbol,
        name: stock.name,
        price: Number(stock.price) || 0,
        change: Number(stock.change) || 0,
        changesPercentage: Number(stock.changesPercentage) || 0,
        volume: Number(stock.volume) || 0,
        dayLow: Number(stock.dayLow) || null,
        dayHigh: Number(stock.dayHigh) || null,
        yearHigh: Number(stock.yearHigh) || null,
        yearLow: Number(stock.yearLow) || null,
        marketCap: Number(stock.marketCap) || null,
        priceAvg50: Number(stock.priceAvg50) || null,
        priceAvg200: Number(stock.priceAvg200) || null,
        exchange: exchange,
        avgVolume: Number(stock.avgVolume) || null,
        open: Number(stock.open) || null,
        previousClose: Number(stock.previousClose) || null,
        eps: Number(stock.eps) || null,
        pe: Number(stock.pe) || null,
        earningsAnnouncement: stock.earningsAnnouncement ? new Date(stock.earningsAnnouncement) : null,
        sharesOutstanding: Number(stock.sharesOutstanding) || null,
        timestamp: Number(stock.timestamp) || Date.now(),
        lastUpdated: new Date()
      }));
  }

  // Update stocks in database using upsert
  async updateStocksInDB(processedData, exchange) {
    try {
      console.log(`Updating ${processedData.length} stocks for ${exchange} in database...`);
      
      // Use bulkWrite for better performance
      const bulkOps = processedData.map(stock => ({
        updateOne: {
          filter: { symbol: stock.symbol, exchange: stock.exchange },
          update: { $set: stock },
          upsert: true
        }
      }));

      const result = await Stock.bulkWrite(bulkOps);
      
      console.log(`✓ Database update complete for ${exchange}:`, {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      });
      
      return result;
      
    } catch (error) {
      console.error(`Database update error for ${exchange}:`, error.message);
      throw error;
    }
  }

  // Update all exchanges
  async updateAllStocks() {
    if (this.isUpdating) {
      console.log('Update already in progress, skipping...');
      return;
    }

    this.isUpdating = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🚀 Starting stock data update at ${new Date().toISOString()}`);
      
      let totalStocks = 0;
      const results = {};

      // Process each exchange sequentially to avoid rate limits
      for (const exchange of this.exchanges) {
        try {
          // Add delay between exchanges to respect rate limits
          if (totalStocks > 0) {
            console.log('Waiting 2 seconds before next exchange...');
            await this.delay(2000);
          }

          const rawData = await this.fetchStockData(exchange);
          const processedData = this.processStockData(rawData, exchange);
          const dbResult = await this.updateStocksInDB(processedData, exchange);
          
          results[exchange] = {
            fetched: rawData.length,
            processed: processedData.length,
            updated: dbResult.modifiedCount,
            created: dbResult.upsertedCount
          };
          
          totalStocks += processedData.length;
          
        } catch (error) {
          console.error(`Failed to update ${exchange}:`, error.message);
          results[exchange] = { error: error.message };
        }
      }

      this.lastUpdateTime = new Date();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`\n✅ Stock update completed in ${duration}s`);
      console.log('Summary:', results);
      console.log(`Total stocks processed: ${totalStocks}`);
      
    } catch (error) {
      console.error('❌ Stock update failed:', error.message);
    } finally {
      this.isUpdating = false;
    }
  }

  // Utility method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Start automatic updates
  startScheduler(intervalMinutes = UPDATE_INTERVAL_MINUTES) {
    console.log(`📅 Starting stock updater scheduler (every ${intervalMinutes} minutes)`);
    
    // Run initial update
    this.updateAllStocks();
    
    // Schedule periodic updates
    this.updateInterval = setInterval(() => {
      this.updateAllStocks();
    }, intervalMinutes * 60 * 1000);
  }

  // Stop automatic updates
  stopScheduler() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('📅 Stock updater scheduler stopped');
    }
  }

  // Get update status
  getStatus() {
    return {
      isUpdating: this.isUpdating,
      lastUpdateTime: this.lastUpdateTime,
      exchanges: this.exchanges
    };
  }

  // Manual trigger for updates
  async triggerUpdate() {
    console.log('🔄 Manual stock update triggered');
    await this.updateAllStocks();
  }
}

export default StockUpdater;