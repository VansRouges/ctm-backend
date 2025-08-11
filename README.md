# Stock API Backend

A Node.js/Express API that fetches stock data from Financial Modeling Prep API, caches it in MongoDB, and provides paginated endpoints with filtering and sorting capabilities.

## Features

- ✅ **Paginated Stock Data** - Efficient pagination with configurable page sizes
- ✅ **Real-time Caching** - Background job updates stock data every 15 minutes
- ✅ **Multiple Exchanges** - Supports NASDAQ, NYSE, AMEX (easily extensible)
- ✅ **Advanced Filtering** - Search by name/symbol, filter by exchange
- ✅ **Flexible Sorting** - Sort by any field (price, volume, change, etc.)
- ✅ **Stock Statistics** - Market overview and analytics
- ✅ **Performance Optimized** - Database indexes and lean queries
- ✅ **Error Handling** - Comprehensive error handling and logging
- ✅ **Health Monitoring** - Health check and update status endpoints

## Project Structure

```
├── models/
│   └── Stock.js              # MongoDB stock model
├── controllers/
│   └── stockController.js    # Stock API controllers
├── routes/
│   └── stocks.js             # API routes
├── jobs/
│   └── stockUpdater.js       # Background stock data updater
├── server.js                 # Main server file
├── package.json              # Dependencies
└── .env.example              # Environment variables template
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stock-api-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or start your local MongoDB service
   sudo systemctl start mongod
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### 📊 Stock Data

**GET /api/stocks**
- **Description**: Get paginated stocks with filtering and sorting
- **Query Parameters**:
  - `page` (number, default: 1) - Page number
  - `limit` (number, default: 50) - Items per page
  - `sortBy` (string, default: 'symbol') - Sort field
  - `sortOrder` (string, default: 'asc') - Sort order (asc/desc)
  - `search` (string) - Search by name or symbol
  - `exchange` (string) - Filter by exchange
- **Example**: `/api/stocks?page=2&limit=25&sortBy=price&sortOrder=desc&search=apple`

**GET /api/stocks/:symbol**
- **Description**: Get specific stock by symbol
- **Example**: `/api/stocks/AAPL`

**GET /api/stocks/stats**
- **Description**: Get market statistics
- **Response**: Total stocks, average price, volume stats, etc.

**GET /api/stocks/exchanges**
- **Description**: Get list of available exchanges

**GET /api/stocks/top-performers**
- **Description**: Get top gainers or losers
- **Query Parameters**:
  - `limit` (number, default: 10) - Number of results
  - `type` (string, default: 'gainers') - 'gainers' or 'losers'
- **Example**: `/api/stocks/top-performers?type=losers&limit=20`

### 🛠 Admin & Monitoring

**GET /health**
- **Description**: Health check and system status

**POST /api/admin/update-stocks**
- **Description**: Manually trigger stock data update

## Sample API Responses

### Paginated Stocks Response
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "price": 175.84,
      "change": 2.11,
      "changesPercentage": 1.21,
      "volume": 45234567,
      "exchange": "NASDAQ",
      // ... more fields
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 120,
    "totalItems": 6000,
    "itemsPerPage": 50,
    "hasNext": true,
    "hasPrev": false,
    "nextPage": 2,
    "prevPage": null
  },
  "filters": {
    "search": "",
    "exchange": "",
    "sortBy": "symbol",
    "sortOrder": "asc"
  }
}
```

### Stock Statistics Response
```json
{
  "success": true,
  "data": {
    "totalStocks": 6000,
    "avgPrice": 45.67,
    "maxPrice": 1250.00,
    "minPrice": 0.50,
    "totalVolume": 2500000000,
    "avgVolume": 416667,
    "positiveChanges": 2400,
    "negativeChanges": 3600,
    "positivePercentage": 40.00
  }
}
```

## Configuration

### Environment Variables

- **PORT** - Server port (default: 3000)
- **NODE_ENV** - Environment mode (development/production)
- **MONGODB_URI** - MongoDB connection string
- **FMP_API_KEY** - Your Financial Modeling Prep API key
- **UPDATE_INTERVAL_MINUTES** - Background update frequency (default: 15)

### Stock Updater Configuration

The background job can be configured in `jobs/stockUpdater.js`:

```javascript
// Add more exchanges
this.exchanges = ['NASDAQ', 'NYSE', 'AMEX', 'TSX', 'LSE'];

// Change update frequency (in server.js)
stockUpdater.startScheduler(30); // 30 minutes
```

## Usage Examples

### Frontend Integration

```javascript
// Fetch paginated stocks
const fetchStocks = async (page = 1, limit = 50) => {
  const response = await fetch(
    `http://localhost:3000/api/stocks?page=${page}&limit=${limit}`
  );
  return response.json();
};

// Search stocks
const searchStocks = async (query) => {
  const response = await fetch(
    `http://localhost:3000/api/stocks?search=${encodeURIComponent(query)}`
  );
  return response.json();
};

// Get top gainers
const getTopGainers = async (limit = 10) => {
  const response = await fetch(
    `http://localhost:3000/api/stocks/top-performers?type=gainers&limit=${limit}`
  );
  return response.json();
};
```

### CURL Examples

```bash
# Get first page of stocks
curl "http://localhost:3000/api/stocks"

# Get stocks with search and sorting
curl "http://localhost:3000/api/stocks?search=apple&sortBy=price&sortOrder=desc"

# Get specific stock
curl "http://localhost:3000/api/stocks/AAPL"

# Get market statistics
curl "http://localhost:3000/api/stocks/stats"

# Trigger manual update
curl -X POST "http://localhost:3000/api/admin/update-stocks"
```

## Performance Considerations

### Database Optimization

The Stock model includes several indexes for optimal query performance:

- **symbol + exchange**: Compound index for unique lookups
- **Text search**: Full-text search on name and symbol
- **Sorting indexes**: Pre-built indexes for common sort fields

### API Rate Limiting

The background updater includes built-in rate limiting:

- 2-second delay between exchanges
- 30-second timeout per request
- Error handling with retry logic (can be extended)

### Memory Usage

- Uses MongoDB's `lean()` queries for reduced memory footprint
- Bulk operations for efficient database writes
- Streaming support can be added for very large datasets

## Monitoring & Debugging

### Health Check

Visit `/health` to see:
- Server uptime
- Database connection status
- Stock updater status
- Last update time

### Logs

The application logs:
- API requests with timestamps
- Stock update progress
- Database operations
- Error details

### Manual Updates

Trigger manual updates for testing:

```bash
# Via API
curl -X POST "http://localhost:3000/api/admin/update-stocks"

# Via npm script
npm run update-stocks
```

## Deployment

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

USER node

CMD ["npm", "start"]
```

### Production Considerations

1. **Environment Variables**: Use proper secrets management
2. **Process Management**: Use PM2 or similar for process management
3. **Monitoring**: Add APM tools like New Relic or Datadog
4. **Load Balancing**: Use nginx or similar for load balancing
5. **Database**: Use MongoDB Atlas or managed MongoDB service
6. **Caching**: Add Redis for additional caching layer if needed

## API Rate Limits

Financial Modeling Prep API limits:
- **Free Tier**: 250 requests/day
- **Starter**: 10,000 requests/day
- **Professional**: 100,000 requests/day

The background updater is designed to work within these limits by:
- Caching data locally
- Batching requests efficiently
- Adding delays between requests

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   ```bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Start MongoDB
   sudo systemctl start mongod
   ```

2. **API Key Issues**
   - Verify your FMP API key in `.env`
   - Check API quota at financialmodelingprep.com

3. **Memory Issues**
   - Increase Node.js memory limit: `--max-old-space-size=4096`
   - Consider processing exchanges separately

4. **Slow Queries**
   - Check database indexes: `db.stocks.getIndexes()`
   - Monitor query performance with MongoDB Compass

### Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ using Node.js, Express, MongoDB, and Financial Modeling Prep API**