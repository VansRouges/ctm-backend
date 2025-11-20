# Portfolio API - Admin End

## Overview

This documentation is for **admin-end developers** implementing portfolio management features in the admin panel. Admins can view any user's portfolio, check their available tokens, and recalculate account balances.

---

## Base URL

```
https://your-api-domain.com/api/v1
```

---

## Authentication

All endpoints require admin authentication. Include the admin JWT token in the Authorization header:

```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

---

## Endpoints

### 1. Get User Portfolio

**Endpoint:** `GET /api/v1/portfolio/user/:userId`

**Description:** Retrieves a specific user's complete portfolio with live prices, profit/loss calculations, and totals.

**Authentication:** Required (Admin JWT Token)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | String | User's MongoDB ObjectId |

---

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "userId": "68f02408d173966c99f2db7f",
    "holdings": [
      {
        "tokenName": "USDT",
        "amount": 1500,
        "averageAcquisitionPrice": 1.00013366,
        "currentPrice": 0.9989276638141984,
        "totalInvestedUsd": 1500.20048464,
        "currentValue": 1498.39149572,
        "profitLoss": -1.80898892,
        "profitLossPercentage": -0.12,
        "lastUpdated": "2025-10-24T17:41:12.309Z"
      },
      {
        "tokenName": "BTC",
        "amount": 0.0008,
        "averageAcquisitionPrice": 50000.00,
        "currentPrice": 55000.00,
        "totalInvestedUsd": 40.00,
        "currentValue": 44.00,
        "profitLoss": 4.00,
        "profitLossPercentage": 10.00,
        "lastUpdated": "2025-10-24T17:58:14.653Z"
      }
    ],
    "totalCurrentValue": 1542.39149572,
    "totalInvestedValue": 1540.20048464,
    "totalProfitLoss": 2.19101108,
    "totalProfitLossPercentage": 0.14
  }
}
```

---

### 2. Get User's Available Tokens

**Endpoint:** `GET /api/v1/portfolio/user/:userId/available-tokens`

**Description:** Returns a list of tokens a specific user has in their portfolio that can be used for withdrawal.

**Authentication:** Required (Admin JWT Token)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | String | User's MongoDB ObjectId |

---

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "tokenName": "USDT",
      "amount": 1500,
      "averagePrice": 1.00013366
    },
    {
      "tokenName": "BTC",
      "amount": 0.0008,
      "averagePrice": 50000.00
    }
  ]
}
```

---

### 3. Recalculate User's Account Balance

**Endpoint:** `POST /api/v1/portfolio/user/:userId/recalculate`

**Description:** Recalculates and syncs a user's `accountBalance` from their portfolio holdings using live prices. Useful for syncing balance after price changes or manual adjustments.

**Authentication:** Required (Admin JWT Token)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | String | User's MongoDB ObjectId |

---

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Account balance recalculated successfully",
  "data": {
    "newBalance": 1542.39149572
  }
}
```

**What Happens:**
1. System fetches all user's portfolio entries
2. Fetches live prices for each token from CoinMarketCap
3. Calculates `totalCurrentValue` from portfolio
4. Updates user's `accountBalance` to match `totalCurrentValue`

---

#### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Failed to recalculate balance",
  "error": "Error message details"
}
```

---

## Frontend Integration Examples

### View User Portfolio

```typescript
// Get user portfolio
const getUserPortfolio = async (userId: string) => {
  const token = localStorage.getItem('adminToken');
  
  const response = await fetch(`/api/v1/portfolio/user/${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const result = await response.json();
  
  if (result.success) {
    return result.data;
  }
  throw new Error(result.message);
};
```

---

### Get User's Available Tokens

```typescript
// Get user's available tokens
const getUserAvailableTokens = async (userId: string) => {
  const token = localStorage.getItem('adminToken');
  
  const response = await fetch(`/api/v1/portfolio/user/${userId}/available-tokens`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const result = await response.json();
  
  if (result.success) {
    return result.data;
  }
  throw new Error(result.message);
};
```

---

### Recalculate Balance

```typescript
// Recalculate user's account balance
const recalculateBalance = async (userId: string) => {
  const token = localStorage.getItem('adminToken');
  
  const response = await fetch(`/api/v1/portfolio/user/${userId}/recalculate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('New balance:', result.data.newBalance);
    return result.data.newBalance;
  }
  throw new Error(result.message);
};
```

---

## Important Notes

1. **Balance Synchronization**: `accountBalance` should theoretically equal `portfolio.totalCurrentValue`, but may differ due to:
   - Price fluctuations
   - Timing differences
   - Rounding differences

2. **Recalculation Use Cases**:
   - After significant price changes
   - After manual portfolio adjustments
   - To sync balance after system issues
   - Periodic maintenance

3. **Live Prices**: Prices are fetched from CoinMarketCap API, so values may fluctuate.

4. **Price Availability**: If a token is not listed on CoinMarketCap, `currentPrice` will be `null` and `currentValue` will be `null`.

5. **Empty Portfolio**: If user has no tokens, portfolio will have empty `holdings[]` array.

---

## Admin Workflow

### Viewing User Portfolio

1. Admin navigates to user management
2. Admin selects a user
3. Admin calls `GET /api/v1/portfolio/user/:userId`
4. Admin views portfolio details, holdings, and performance

### Checking Available Tokens

1. Admin needs to see what tokens user can withdraw
2. Admin calls `GET /api/v1/portfolio/user/:userId/available-tokens`
3. Admin uses this information for withdrawal processing

### Recalculating Balance

1. Admin notices balance discrepancy
2. Admin calls `POST /api/v1/portfolio/user/:userId/recalculate`
3. System syncs `accountBalance` with current portfolio value
4. Admin verifies new balance

---

## Summary

### Key Points for Admin Developers

✅ **User Portfolio Access**: View any user's portfolio  
✅ **Balance Management**: Recalculate balances when needed  
✅ **Token Information**: Check available tokens for withdrawals  
✅ **Live Prices**: Prices fetched live from CoinMarketCap  
✅ **Sync Capability**: Recalculate to sync balance with portfolio  

### Endpoints Summary

1. **GET `/user/:userId`** - Get user's complete portfolio
2. **GET `/user/:userId/available-tokens`** - Get user's available tokens
3. **POST `/user/:userId/recalculate`** - Recalculate user's account balance

### Use Cases

- **User Support**: View user's portfolio to help with inquiries
- **Balance Verification**: Recalculate balance to verify accuracy
- **Withdrawal Processing**: Check available tokens before processing withdrawals
- **Reporting**: Generate portfolio reports for users
- **Maintenance**: Sync balances after system updates or price changes

