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

### 1. Get All Users with Portfolio Information

**Endpoint:** `GET /api/v1/portfolio/users`

**Description:** Retrieves all users (role: 'user') with their complete portfolio information, including user profile data and portfolio holdings with live prices. Useful for admin dashboards and user management overviews.

**Authentication:** Required (Admin JWT Token)

**Query Parameters:** None

---

#### Success Response (200 OK)

```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "user": {
        "_id": "68f02408d173966c99f2db7f",
        "email": "user@example.com",
        "username": "johndoe",
        "firstName": "John",
        "lastName": "Doe",
        "fullName": "John Doe",
        "profilePicture": "https://example.com/profile.jpg",
        "authProvider": "google",
        "isEmailVerified": true,
        "isActive": true,
        "lastLogin": "2025-11-24T10:00:00.000Z",
        "roi": 25,
        "kycStatus": false,
        "accountStatus": true,
        "totalInvestment": 10000,
        "accountBalance": 12500,
        "createdAt": "2025-10-01T00:00:00.000Z",
        "updatedAt": "2025-11-24T10:00:00.000Z"
      },
      "portfolio": {
        "holdings": [
          {
            "tokenName": "BTC",
            "amount": 0.5,
            "averageAcquisitionPrice": 40000,
            "currentPrice": 45000,
            "totalInvestedUsd": 20000,
            "currentValue": 22500,
            "profitLoss": 2500,
            "profitLossPercentage": 12.5,
            "lastUpdated": "2025-11-24T10:00:00.000Z"
          },
          {
            "tokenName": "USDT",
            "amount": 5000,
            "averageAcquisitionPrice": 1.0,
            "currentPrice": 0.9989,
            "totalInvestedUsd": 5000,
            "currentValue": 4994.5,
            "profitLoss": -5.5,
            "profitLossPercentage": -0.11,
            "lastUpdated": "2025-11-24T10:00:00.000Z"
          }
        ],
        "totalCurrentValue": 27494.5,
        "totalInvestedValue": 25000,
        "totalProfitLoss": 2494.5,
        "totalProfitLossPercentage": 9.98
      }
    }
  ]
}
```

**Response Fields:**

- `count`: Total number of users returned
- `data`: Array of user objects, each containing:
  - `user`: Complete user profile information (excluding password)
  - `portfolio`: Portfolio data with holdings and totals

**Note:** Users are sorted by creation date (newest first). Only users with `role: 'user'` are returned (admins are excluded).

---

### 2. Get User Portfolio

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

### 3. Get User's Available Tokens

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

### 4. Recalculate User's Account Balance

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
  "message": "Account balance and equity metrics recalculated successfully",
  "data": {
    "newBalance": 1542.39149572,
    "accountBalance": 1542.39149572,
    "currentValue": 4542.39149572,
    "lockedValue": 3000,
    "roi": 12.5
  }
}
```

**What Happens:**
1. System fetches all user's portfolio entries
2. Fetches live prices for each token from CoinMarketCap
3. Calculates available (`accountBalance`) from portfolio
4. Adds locked capital from active copytrades/stocks → `currentValue`
5. Updates user's `accountBalance`, `currentValue`, and `roi`

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

### 5. Update User Financial Metrics (accountBalance / currentValue)

**Endpoint:** `PUT /api/v1/portfolio/user/:userId/financial`

**Description:** Admin sets a user's **available balance** (`accountBalance`) and/or **total equity** (`currentValue`). Changes are applied by adjusting portfolio holdings (USDT credits / token deductions) so values **persist through financial sync** (they are not wiped on the next GET).

**Definitions:**
- `accountBalance` = liquid portfolio mark-to-market (available)
- `lockedValue` = capital in active copytrades + active/pending-liquidation stocks
- `currentValue` = `accountBalance + lockedValue`

**Authentication:** Required (Admin JWT Token)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | String | User's MongoDB ObjectId |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountBalance` | Number | No* | Target available USD (>= 0) |
| `currentValue` | Number | No* | Target total equity USD (>= 0) |

\* At least one field is required.

**Rules:**
1. Providing only `accountBalance` adjusts liquid holdings; `currentValue` becomes `accountBalance + lockedValue`.
2. Providing only `currentValue` sets available to `currentValue - lockedValue` (must be >= 0).
3. Providing both requires `currentValue === accountBalance + lockedValue` (within $0.01). To change locked capital, update active copytrade/stock values separately.
4. Increases are credited as USDT. Decreases prefer USDT/stablecoins, then highest-value tokens.
5. Does **not** change `totalInvestment`.

---

#### Example Request

```json
PUT /api/v1/portfolio/user/68f02408d173966c99f2db7f/financial
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "accountBalance": 10000
}
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Financial metrics updated successfully",
  "data": {
    "email": "user@example.com",
    "totalInvestment": 8000,
    "accountBalance": 10000,
    "lockedValue": 3000,
    "currentValue": 13000,
    "lifetimeWithdrawals": 0,
    "roi": 62.5,
    "netGainLoss": 5000
  },
  "before": {
    "accountBalance": 7500,
    "currentValue": 10500,
    "lockedValue": 3000,
    "roi": 31.25
  },
  "portfolioAdjustments": [
    {
      "action": "add",
      "tokenName": "USDT",
      "tokenAmount": 2500,
      "usdValue": 2500
    }
  ]
}
```

#### Error Responses

**400 — Locked mismatch when both fields sent:**
```json
{
  "success": false,
  "message": "currentValue must equal accountBalance + lockedValue. Update accountBalance alone, or set currentValue to accountBalance + lockedValue. To change locked capital, update active copytrade/stock values.",
  "error": "CURRENT_VALUE_LOCKED_MISMATCH",
  "data": {
    "accountBalance": 10000,
    "currentValue": 20000,
    "lockedValue": 3000,
    "expectedCurrentValue": 13000
  }
}
```

**400 — currentValue below locked:**
```json
{
  "success": false,
  "message": "currentValue cannot be less than locked capital in active trades/stocks",
  "error": "CURRENT_VALUE_BELOW_LOCKED",
  "data": {
    "currentValue": 1000,
    "lockedValue": 3000
  }
}
```

---

**Alternate endpoint (same behavior):** admins can also send `accountBalance` / `currentValue` on:

```
PUT /api/v1/users/:id
```

That route applies the same portfolio-backed financial update, plus any other allowed profile fields in the same request.

---

## Frontend Integration Examples

### Get All Users with Portfolios

```typescript
// Get all users with their portfolio information
const getAllUsersWithPortfolios = async () => {
  const token = localStorage.getItem('adminToken');
  
  const response = await fetch('/api/v1/portfolio/users', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const result = await response.json();
  
  if (result.success) {
    console.log(`Found ${result.count} users`);
    return result.data; // Array of users with portfolios
  }
  throw new Error(result.message);
};

// Usage example
const users = await getAllUsersWithPortfolios();
users.forEach(({ user, portfolio }) => {
  console.log(`${user.email}: ${portfolio.totalCurrentValue} USD`);
});
```

---

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
    return result.data;
  }
  throw new Error(result.message);
};
```

---

### Update Account Balance / Current Value

```typescript
// Preferred dedicated endpoint
const updateUserFinancials = async (
  userId: string,
  payload: { accountBalance?: number; currentValue?: number }
) => {
  const token = localStorage.getItem('adminToken');

  const response = await fetch(`/api/v1/portfolio/user/${userId}/financial`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!result.success) {
    throw Object.assign(new Error(result.message), {
      code: result.error,
      data: result.data
    });
  }
  return result;
};

// Example: set available balance only (currentValue follows as balance + locked)
await updateUserFinancials(userId, { accountBalance: 10000 });

// Example: set total equity only (available becomes currentValue - locked)
await updateUserFinancials(userId, { currentValue: 15000 });
```

---

## Important Notes

1. **Balance Synchronization**: `accountBalance` equals liquid `portfolio.totalCurrentValue`. `currentValue` equals `accountBalance + lockedValue`.

2. **Admin edits are durable**: `PUT .../financial` adjusts holdings so subsequent sync/GET keeps the new figures.

3. **Recalculation Use Cases**:
   - After significant price changes
   - After manual portfolio adjustments
   - To sync balance after system issues
   - Periodic maintenance

4. **Live Prices**: Prices are fetched from CoinMarketCap API, so values may fluctuate.

5. **Price Availability**: If a token is not listed on CoinMarketCap, `currentPrice` will be `null` and `currentValue` will be `null`.

6. **Empty Portfolio**: If user has no tokens, portfolio will have empty `holdings[]` array.

---

## Admin Workflow

### Viewing All Users with Portfolios

1. Admin navigates to user management dashboard
2. Admin calls `GET /api/v1/portfolio/users`
3. Admin views list of all users with their portfolio summaries
4. Admin can see total users, balances, and portfolio performance at a glance

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
3. System syncs `accountBalance` / `currentValue` with portfolio + locked trades
4. Admin verifies new balance

### Editing Account Balance / Current Value

1. Admin opens user financial editor
2. Prefer `GET /api/v1/portfolio/user/:userId/financial-summary` to load `accountBalance`, `lockedValue`, `currentValue`
3. Admin edits fields and calls `PUT /api/v1/portfolio/user/:userId/financial`
4. UI should show `lockedValue` as read-only context: `currentValue = accountBalance + lockedValue`

---

## Summary

### Key Points for Admin Developers

✅ **User Portfolio Access**: View any user's portfolio  
✅ **Balance Management**: Recalculate or directly set accountBalance / currentValue  
✅ **Token Information**: Check available tokens for withdrawals  
✅ **Live Prices**: Prices fetched live from CoinMarketCap  
✅ **Sync Capability**: Recalculate to sync balance with portfolio  

### Endpoints Summary

1. **GET `/users`** - Get all users with their portfolio information
2. **GET `/user/:userId`** - Get user's complete portfolio
3. **GET `/user/:userId/available-tokens`** - Get user's available tokens
4. **POST `/user/:userId/recalculate`** - Recalculate user's account balance + equity
5. **PUT `/user/:userId/financial`** - Set accountBalance and/or currentValue
6. **GET `/user/:userId/financial-summary`** - Get equity summary (available, locked, current, ROI)

### Use Cases

- **Dashboard Overview**: Get all users with portfolios for admin dashboard
- **User Management**: View all users and their portfolio status at once
- **User Support**: View user's portfolio to help with inquiries
- **Manual Balance Edit**: Set available balance or total equity for a user
- **Balance Verification**: Recalculate balance to verify accuracy
- **Withdrawal Processing**: Check available tokens before processing withdrawals
- **Reporting**: Generate portfolio reports for users
- **Maintenance**: Sync balances after system updates or price changes

