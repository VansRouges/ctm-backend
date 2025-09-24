import { PORT } from './config/env.js';
import connectToDatabase from './database/mongodb.js';
import app from './app.js';
import StockUpdater from './jobs/stock-updater.jobs.js';
import redisClient from './config/redis.js';

const port = PORT || process.env.PORT || 5000;

(async () => {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Connect to Redis
    const redisConnected = await redisClient.connect();
    if (redisConnected) {
      console.log('✅ Redis connected successfully');
    } else {
      console.warn('⚠️ Redis connection failed - token blacklisting will be disabled');
    }
    
    // Start stock updater
    const stockUpdater = new StockUpdater();
    // Start scheduler every 6 hours (360 minutes) unless overridden by env UPDATE_INTERVAL_MINUTES
    const interval = Number(process.env.UPDATE_INTERVAL_MINUTES) || 360;
    stockUpdater.startScheduler(interval);
    
    // Start server
    app.listen(port, () => console.log(`CTM API running on http://0.0.0.0:${port}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await redisClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await redisClient.disconnect();
  process.exit(0);
});
