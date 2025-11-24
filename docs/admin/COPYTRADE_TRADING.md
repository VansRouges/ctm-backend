# Copytrade Trading System - Admin End

## Overview

This document explains the backend trading system for copytrade purchases. The system automatically manages active copytrade purchases, updating their values hourly and completing them when they reach their end date.

---

## System Architecture

### Components

1. **CopytradeTradingService** (`services/copytrade-trading.service.js`)
   - Handles hourly updates for active trades
   - Completes expired trades
   - Calculates final ROI based on risk level

2. **CopytradeTradingJob** (`jobs/copytrade-trading.job.js`)
   - Cron job that runs every hour
   - Triggers the trading service to process all active trades

3. **Model Updates** (`model/copytrade-purchase.model.js`)
   - Added `trade_start_date` (Date): When trading began
   - Updated `trade_end_date` (Date): When trading will complete

---

## How Trading Works

### 1. Purchase Approval

When an admin approves a copytrade purchase:
- Status changes from `pending` to `active`
- Balance is deducted from user's portfolio
- `trade_start_date` is set to current date/time
- `trade_end_date` is calculated: `trade_start_date + trade_duration` (days)

### 2. Hourly Updates (Cron Job)

**Schedule:** Every hour at minute 0 (e.g., 1:00, 2:00, 3:00)

**Process:**
1. Find all active trades where `trade_end_date > now`
2. For each trade:
   - Calculate hourly change percentage based on:
     - Risk level (low/medium/high)
     - Progress through trade duration
     - Target ROI
   - Update `trade_current_value` by applying the change
   - Pre-save hook automatically recalculates `trade_profit_loss` and `isProfit`

**Hourly Change Calculation:**
- Base volatility: Low (0.3%), Medium (0.6%), High (1.0%)
- Random fluctuation: ±volatility%
- Trend component: Gradually trends towards final ROI as trade progresses
- Final range: -1% to +1% per hour

### 3. Trade Completion

**Trigger:** When `trade_end_date <= now`

**Process:**
1. Calculate final ROI based on risk level:
   - **Low Risk**: Uses `trade_roi_min`
   - **Medium Risk**: Uses `trade_roi_max`
   - **High Risk**: Uses `trade_roi_min`

2. Calculate final value:
   ```
   finalValue = initial_investment × (1 + ROI% / 100)
   ```

3. Update purchase:
   - Set `trade_current_value` to final value
   - Set `trade_status` to `completed`
   - Recalculate `trade_profit_loss` and `isProfit`

4. Add funds to user:
   - Add final value to user's `accountBalance` as USDT
   - Add USDT to user's portfolio
   - Recalculate `accountBalance` from portfolio

5. Transaction is committed atomically

---

## Database Schema

### CopytradePurchase Model

```javascript
{
  trade_start_date: Date,        // When trading began
  trade_end_date: Date,          // When trading completes
  trade_status: String,          // 'pending', 'active', 'completed', 'cancelled'
  trade_current_value: Number,   // Updates hourly
  trade_profit_loss: Number,     // Auto-calculated
  isProfit: Boolean,             // Auto-calculated
  // ... other fields
}
```

**Indexes:**
- `{ trade_status: 1, trade_end_date: 1 }` - For efficient querying of active/expired trades

---

## Cron Job Configuration

**File:** `jobs/copytrade-trading.job.js`

**Schedule:** `'0 * * * *'` (Every hour at minute 0)

**Timezone:** UTC

**Startup:** Automatically started in `server.js`

**Manual Trigger:** Available via `runNow()` method for testing

---

## Service Methods

### `CopytradeTradingService.processTrades()`

Main entry point called by cron job:
1. Completes expired trades
2. Updates active trades
3. Returns statistics

### `CopytradeTradingService.updateActiveTrades()`

Updates all active trades with hourly profit/loss changes.

**Returns:**
```javascript
{
  totalTrades: Number,
  updated: Number,
  errors: Number
}
```

### `CopytradeTradingService.completeExpiredTrades()`

Completes trades that have reached their end date.

**Returns:**
```javascript
{
  completed: Number,
  errors: Number,
  totalReturned: Number  // Total USD returned to users
}
```

### `CopytradeTradingService.calculateHourlyChange(purchase)`

Calculates the hourly change percentage for a trade based on:
- Risk level
- Progress through duration
- Target ROI

**Returns:** Number (percentage change, typically -1% to +1%)

---

## Monitoring & Logging

### Log Messages

**Hourly Updates:**
- `📈 Updating active copytrade purchases` - Start of update cycle
- `📊 Updated copytrade purchase` - Individual trade updated
- `✅ Completed hourly copytrade updates` - Update cycle complete

**Trade Completion:**
- `🏁 Completing expired copytrade purchases` - Start of completion cycle
- `✅ Completed copytrade purchase` - Individual trade completed
- `🏁 Completed expired copytrade purchases` - Completion cycle done

**Errors:**
- `❌ Error updating copytrade purchase` - Update failed for specific trade
- `❌ Error completing copytrade purchase` - Completion failed for specific trade

### Job Statistics

Access via `copytradeTradingJob.getStats()`:

```javascript
{
  totalRuns: Number,
  totalTradesUpdated: Number,
  totalTradesCompleted: Number,
  totalFundsReturned: Number,
  isRunning: Boolean,
  lastRunTime: Date,
  schedule: String,
  lastRunStats: Object
}
```

---

## Error Handling

### Transaction Safety

- All trade completions use MongoDB transactions
- If any step fails, transaction is aborted
- User balance and purchase status remain consistent

### Error Recovery

- Individual trade failures don't stop the entire job
- Errors are logged with full context
- Failed trades can be manually retried

---

## Testing

### Manual Trigger

```javascript
import CopytradeTradingJob from './jobs/copytrade-trading.job.js';

const job = new CopytradeTradingJob();
const result = await job.runNow();
console.log(result);
```

### Check Job Status

```javascript
const stats = job.getStats();
console.log(stats);
```

---

## Important Notes

1. **Final Value Guarantee**: Regardless of hourly fluctuations, the final value is always calculated using the guaranteed ROI based on risk level.

2. **Atomic Operations**: Trade completions use MongoDB transactions to ensure data consistency.

3. **Portfolio Integration**: Completed trades add funds as USDT to the user's portfolio, maintaining consistency with the portfolio system.

4. **No Manual Intervention**: The system runs automatically. Admins don't need to manually complete trades.

5. **Timezone**: All dates are stored and processed in UTC.

6. **Performance**: The cron job processes trades efficiently using indexed queries.

---

## Troubleshooting

### Trades Not Updating

1. Check if cron job is running: `job.getStats()`
2. Check server logs for errors
3. Verify `trade_start_date` and `trade_end_date` are set correctly
4. Ensure trades have `trade_status: 'active'`

### Trades Not Completing

1. Check if `trade_end_date` has passed
2. Verify cron job is running hourly
3. Check logs for transaction errors
4. Manually trigger completion: `job.runNow()`

### Balance Not Updated After Completion

1. Check transaction logs for rollback
2. Verify user exists in database
3. Check BalanceService logs
4. Manually recalculate user balance

---

## Summary

- ✅ Automatic hourly updates for active trades
- ✅ Automatic completion when trades expire
- ✅ Guaranteed final ROI based on risk level
- ✅ Atomic transactions ensure data consistency
- ✅ Comprehensive logging and monitoring
- ✅ No manual intervention required

