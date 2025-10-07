import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import requestLogger from './middlewares/logger.middleware.js'
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js'
import userRouter from './routes/user.route.js';
import stockRouter from './routes/stock.route.js';
import cryptoOptionRouter from './routes/crypto-option.route.js';
import copyTradingOptionRouter from './routes/copytrading-option.route.js';
import adminEmailRouter from './routes/admin-email.route.js'; 
import userSupportRouter from './routes/user-support.route.js'; // Import user support router
import depositRouter from './routes/deposit.route.js';
import withdrawRouter from './routes/withdraw.route.js';
import copytradePurchaseRouter from './routes/copytrade-purchase.route.js';
import adminAuthRouter from './routes/admin-auth.route.js';
import notificationRouter from './routes/notification.route.js';
import auditLogRouter from './routes/audit-log.route.js';
import { requireAdminAuth } from './middlewares/auth.middleware.js';
import { createAuditLog } from './utils/auditHelper.js';
import { invalidateAuditCache } from './controllers/audit-log.controller.js';

// import StockUpdater from './jobs/stock-updater.jobs.js'; // DISABLED FOR NOW
import cryptoPricesRouter from './routes/crypto-prices.route.js';
import arcjectMiddleware from './middlewares/arcjet.middleware.js';

const app = express();

// NOTE: Scheduler start & DB connection happen in server.js (runtime bootstrap)
// We still create an instance for manual trigger endpoint; scheduler is only started elsewhere.
// const stockUpdater = new StockUpdater();

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://www.copytradingmarkets.com',
    'https://ctm-user-end.vercel.app',
    'https://admin-ctm.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); 
app.use(requestLogger);
app.use(arcjectMiddleware);

app.get('/', (req, res) => {
  res.send('Welcome to the CTM Backend API!');
});


app.use('/api/v1/users', userRouter);
app.use('/api/v1/crypto-prices', cryptoPricesRouter);
app.use('/api/v1/stocks', stockRouter);
app.use('/api/v1/crypto-options', cryptoOptionRouter);
app.use('/api/v1/copytrading-options', copyTradingOptionRouter);
app.use('/api/v1/admin-emails', adminEmailRouter);
app.use('/api/v1/user-support', userSupportRouter);
app.use('/api/v1/deposits', depositRouter);
app.use('/api/v1/withdraws', withdrawRouter);
app.use('/api/v1/copytrade-purchases', copytradePurchaseRouter);
app.use('/api/v1/admin/auth', adminAuthRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/audit-logs', auditLogRouter);

// Manual stock update endpoint (for debugging/admin) - DISABLED FOR NOW
/*
app.post('/api/admin/update-stocks', requireAdminAuth, async (req, res, next) => {
  try {
    // Run update in background
    stockUpdater.triggerUpdate();

    // Create audit log
    await createAuditLog(req, res, {
      action: 'stock_update_trigger',
      resourceType: 'stock',
      description: 'Triggered manual stock update'
    });

    // Invalidate audit cache
    await invalidateAuditCache();

    res.json({
      success: true,
      message: 'Stock update triggered'
    });
  } catch (error) {
    next(error);
  }
});
*/

// 404 for unmatched routes
app.use(notFoundHandler);

// Central error handler
app.use(errorHandler);

export default app;