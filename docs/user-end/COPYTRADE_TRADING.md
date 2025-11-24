# Copytrade Trading System - User End

## Overview

This document explains how copytrade purchases work after they are approved by an admin. The trading system automatically manages your active copytrade purchases, updating their values hourly and completing them when they reach their end date.

---

## How Trading Works

### 1. Purchase Creation (Pending Status)

When you create a copytrade purchase:
- Status: `pending`
- No balance is deducted yet
- Waiting for admin approval

### 2. Admin Approval (Active Status)

When an admin approves your purchase:
- Status changes to `active`
- Your balance is deducted from your portfolio (starting with highest value tokens)
- Trading begins immediately
- `trade_start_date` is set
- `trade_end_date` is calculated based on `trade_duration` (in days)

### 3. Active Trading Period

While your trade is active:
- **Hourly Updates**: Every hour, the system updates `trade_current_value` based on simulated market fluctuations
- **Profit/Loss Tracking**: `trade_profit_loss` is automatically calculated as `trade_current_value - initial_investment`
- **Real-time Value**: You can check your trade's current value at any time through the API

**Note**: The hourly fluctuations are simulated and trend towards the final ROI based on your trade's risk level. The final value is guaranteed based on the risk level.

### 4. Trade Completion

When your trade reaches its `trade_end_date`:
- Status changes to `completed`
- Final ROI is calculated based on risk level:
  - **Low Risk**: Uses `trade_roi_min`
  - **Medium Risk**: Uses `trade_roi_max`
  - **High Risk**: Uses `trade_roi_min`
- Final value = `initial_investment × (1 + ROI%)`
- Final value is added to your `accountBalance` as USDT
- Your portfolio is updated with the new balance

---

## API Endpoints

### Get Your Active Trades

**Endpoint:** `GET /api/v1/copytrade-purchase/my-purchases`

**Response includes:**
- `trade_current_value`: Current value of the trade (updates hourly)
- `trade_profit_loss`: Current profit/loss amount
- `isProfit`: Whether the trade is currently profitable
- `trade_status`: `active`, `completed`, `pending`, or `cancelled`
- `trade_start_date`: When trading began
- `trade_end_date`: When trading will complete
- `trade_duration`: Duration in days

### Get Specific Trade Details

**Endpoint:** `GET /api/v1/copytrade-purchase/:id`

Returns detailed information about a specific copytrade purchase, including current value and profit/loss.

---

## Important Notes

1. **Hourly Updates**: Trade values update every hour automatically. You don't need to do anything.

2. **Final Value Guarantee**: Regardless of hourly fluctuations, the final value is guaranteed based on:
   - Your initial investment
   - The risk level of the trade
   - The ROI percentage for that risk level

3. **Balance Addition**: When a trade completes, the final value is automatically added to your `accountBalance` as USDT. You can then use this balance for withdrawals or new purchases.

4. **No Manual Intervention**: The trading system runs automatically. You don't need to monitor or manage active trades manually.

5. **Status Tracking**: Always check `trade_status` to see if your trade is:
   - `pending`: Waiting for admin approval
   - `active`: Currently trading
   - `completed`: Finished, funds added to balance
   - `cancelled`: Trade was cancelled

---

## Example Flow

1. **Day 1**: You create a copytrade purchase for $1000 (Low Risk, 10% ROI)
   - Status: `pending`
   - Balance: Not deducted yet

2. **Day 1 (Admin Approval)**: Admin approves your purchase
   - Status: `active`
   - Balance deducted: $1000
   - Trading begins
   - `trade_start_date`: 2025-11-24 10:00:00
   - `trade_end_date`: 2025-12-04 10:00:00 (10 days later)

3. **Day 1-10**: Trade is active
   - Hour 1: `trade_current_value` = $1005.23
   - Hour 2: `trade_current_value` = $1003.87
   - Hour 3: `trade_current_value` = $1007.12
   - ... (fluctuates hourly)

4. **Day 10**: Trade completes
   - Status: `completed`
   - Final ROI: 10% (Low Risk uses `trade_roi_min`)
   - Final value: $1000 × 1.10 = $1100
   - $1100 added to your `accountBalance` as USDT

---

## Frontend Integration

### Displaying Active Trades

```typescript
// Fetch user's active trades
const getActiveTrades = async () => {
  const token = localStorage.getItem('userToken');
  
  const response = await fetch('/api/v1/copytrade-purchase/my-purchases', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const result = await response.json();
  
  if (result.success) {
    // Filter for active trades
    const activeTrades = result.data.filter(
      (trade: any) => trade.trade_status === 'active'
    );
    
    return activeTrades;
  }
  throw new Error(result.message);
};

// Display trade information
activeTrades.forEach(trade => {
  console.log(`Trade: ${trade.trade_title}`);
  console.log(`Current Value: $${trade.trade_current_value}`);
  console.log(`Profit/Loss: $${trade.trade_profit_loss}`);
  console.log(`Status: ${trade.trade_status}`);
  console.log(`Ends: ${trade.trade_end_date}`);
});
```

### Calculating Time Remaining

```typescript
const getTimeRemaining = (endDate: string) => {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Completed';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  return `${days} days, ${hours} hours`;
};
```

---

## Summary

- ✅ Trades update automatically every hour
- ✅ Final value is guaranteed based on risk level and ROI
- ✅ Completed trades automatically add funds to your balance
- ✅ No manual intervention required
- ✅ Check `trade_status` to track trade progress

