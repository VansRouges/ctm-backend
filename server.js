import { PORT } from './config/env.js';
import connectToDatabase from './database/mongodb.js';
import app from './app.js';
import StockUpdater from './jobs/stock-updater.jobs.js';

const port = PORT || process.env.PORT || 5000;

(async () => {
  try {
    await connectToDatabase();
    const stockUpdater = new StockUpdater();
    // Start scheduler every 6 hours (360 minutes) unless overridden by env UPDATE_INTERVAL_MINUTES
    const interval = Number(process.env.UPDATE_INTERVAL_MINUTES) || 360;
    stockUpdater.startScheduler(interval);
    app.listen(port, () => console.log(`CTM API running on http://0.0.0.0:${port}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
