import express from 'express';
import StockController from '../controllers/stock.controller.js';

const stockRouter = express.Router();

// GET /api/stocks - Get paginated stocks with optional filtering and sorting
// Query params: page, limit, sortBy, sortOrder, search, exchange
stockRouter.get('/', StockController.getStocks);

// GET /api/stocks/stats - Get stock statistics
stockRouter.get('/stats', StockController.getStockStats);

// GET /api/stocks/exchanges - Get available exchanges
stockRouter.get('/exchanges', StockController.getExchanges);

// GET /api/stocks/top-performers - Get top gainers/losers
// Query params: limit, type (gainers|losers)
stockRouter.get('/top-performers', StockController.getTopPerformers);

// GET /api/stocks/exchange/:exchange - Get stocks by specific exchange (NASDAQ, NYSE, AMEX)
// Query params: page, limit, sortBy, sortOrder, search
stockRouter.get('/exchange/:exchange', StockController.getStocksByExchange);

// GET /api/stocks/:symbol - Get a specific stock by symbol
stockRouter.get('/:symbol', StockController.getStockBySymbol);

export default stockRouter;