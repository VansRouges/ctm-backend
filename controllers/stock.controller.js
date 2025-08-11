import Stock from '../model/stock.model.js';

class StockController {
  // Get paginated stocks with filtering and sorting
  static async getStocks(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const sortBy = req.query.sortBy || 'symbol';
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      const search = req.query.search || '';
      const exchange = req.query.exchange || '';
      
      // Build query filter
      let filter = {};
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { symbol: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (exchange) {
        filter.exchange = exchange.toUpperCase();
      }
      
      // Calculate skip value
      const skip = (page - 1) * limit;
      
      // Build sort object
      const sort = { [sortBy]: sortOrder };
      
      // Execute queries in parallel
      const [stocks, total] = await Promise.all([
        Stock.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(), // Use lean() for better performance
        Stock.countDocuments(filter)
      ]);
      
      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      res.json({
        success: true,
        data: stocks,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext,
          hasPrev,
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null
        },
        filters: {
          search,
          exchange,
          sortBy,
          sortOrder: sortOrder === 1 ? 'asc' : 'desc'
        }
      });
      
    } catch (error) {
      console.error('Error fetching stocks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stocks',
        error: error.message
      });
    }
  }
  
  // Get a single stock by symbol
  static async getStockBySymbol(req, res) {
    try {
      const { symbol } = req.params;
      
      const stock = await Stock.findOne({ 
        symbol: symbol.toUpperCase() 
      }).lean();
      
      if (!stock) {
        return res.status(404).json({
          success: false,
          message: 'Stock not found'
        });
      }
      
      res.json({
        success: true,
        data: stock
      });
      
    } catch (error) {
      console.error('Error fetching stock:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stock',
        error: error.message
      });
    }
  }
  
  // Get stock statistics
  static async getStockStats(req, res) {
    try {
      const [stats] = await Stock.aggregate([
        {
          $group: {
            _id: null,
            totalStocks: { $sum: 1 },
            avgPrice: { $avg: '$price' },
            maxPrice: { $max: '$price' },
            minPrice: { $min: '$price' },
            totalVolume: { $sum: '$volume' },
            avgVolume: { $avg: '$volume' },
            positiveChanges: {
              $sum: { $cond: [{ $gt: ['$change', 0] }, 1, 0] }
            },
            negativeChanges: {
              $sum: { $cond: [{ $lt: ['$change', 0] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalStocks: 1,
            avgPrice: { $round: ['$avgPrice', 2] },
            maxPrice: { $round: ['$maxPrice', 2] },
            minPrice: { $round: ['$minPrice', 2] },
            totalVolume: 1,
            avgVolume: { $round: ['$avgVolume', 0] },
            positiveChanges: 1,
            negativeChanges: 1,
            positivePercentage: {
              $round: [
                { $multiply: [{ $divide: ['$positiveChanges', '$totalStocks'] }, 100] },
                2
              ]
            }
          }
        }
      ]);
      
      res.json({
        success: true,
        data: stats || {
          totalStocks: 0,
          avgPrice: 0,
          maxPrice: 0,
          minPrice: 0,
          totalVolume: 0,
          avgVolume: 0,
          positiveChanges: 0,
          negativeChanges: 0,
          positivePercentage: 0
        }
      });
      
    } catch (error) {
      console.error('Error fetching stock stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stock statistics',
        error: error.message
      });
    }
  }
  
  // Get available exchanges
  static async getExchanges(req, res) {
    try {
      const exchanges = await Stock.distinct('exchange');
      
      res.json({
        success: true,
        data: exchanges.sort()
      });
      
    } catch (error) {
      console.error('Error fetching exchanges:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch exchanges',
        error: error.message
      });
    }
  }
  
  // Get top performers (by change percentage)
  static async getTopPerformers(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const type = req.query.type || 'gainers'; // 'gainers' or 'losers'
      
      const sortOrder = type === 'gainers' ? -1 : 1;
      
      const stocks = await Stock.find()
        .sort({ changesPercentage: sortOrder })
        .limit(limit)
        .lean();
      
      res.json({
        success: true,
        data: stocks,
        type
      });
      
    } catch (error) {
      console.error('Error fetching top performers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch top performers',
        error: error.message
      });
    }
  }
}

export default StockController;