# Portfolio & Balance Management API Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Balance Structure](#balance-structure)
3. [Portfolio System](#portfolio-system)
4. [Balance Flow](#balance-flow)
5. [API Endpoints](#api-endpoints)
6. [Frontend Integration Guide](#frontend-integration-guide)
7. [Examples](#examples)

---

## Overview

The CTM backend implements a **multi-token portfolio system** where users can:
- Deposit multiple cryptocurrencies (BTC, USDT, XRP, ETC, etc.)
- Track individual token holdings with live USD values
- Withdraw specific tokens from their portfolio
- View combined portfolio balance and individual token performance

### Key Concepts

- **Portfolio**: Individual token holdings per user (e.g., 10 BTC, 30 USDT, 40 XRP)
- **Account Balance**: Current available USD balance for withdrawals and purchases
- **Total Investment**: Historical tracking of all approved deposits (never decreases)
- **ROI**: Return on Investment (calculated from portfolio performance)

---

## Balance Structure

### User Model Fields

```javascript
{
  totalInvestment: Number,    // Total USD value of all approved deposits (historical)
  accountBalance: Number,     // Current available USD balance (for withdrawals/purchases)
  roi: Number,                // Return on Investment percentage
  currentValue: Number        // Current portfolio value (legacy field)
}
```

### Balance Field Explanations

#### 1. **`totalInvestment`** (Historical Tracking)
- **Purpose**: Tracks the total USD value of all approved deposits
- **Behavior**: 
  - ✅ **Increases** when a deposit is approved
  - ❌ **Never decreases** (even after withdrawals)
  - 📊 Used for historical/analytical purposes
- **Example**: User deposits $1000, then withdraws $200
  - `totalInvestment` = $1000 (remains unchanged)
  - `accountBalance` = $800 (decreases)

#### 2. **`accountBalance`** (Available Balance)
- **Purpose**: Current available USD balance for withdrawals and purchases
- **Behavior**:
  - ✅ **Increases** when a deposit is approved
  - ❌ **Decreases** when a withdrawal is approved
  - ❌ **Decreases** when purchasing copytrade plans (if implemented)
  - 💰 Used for transaction validation
- **Example**: User deposits $1000, then withdraws $200
  - `totalInvestment` = $1000
  - `accountBalance` = $800

#### 3. **`roi`** (Return on Investment)
- **Purpose**: Tracks user's overall return percentage
- **Behavior**: Calculated from portfolio performance
- **Note**: Currently stored on user model but may be calculated dynamically

#### 4. **`currentValue`** (Legacy Field)
- **Purpose**: Legacy field, may be deprecated
- **Recommendation**: Use portfolio's `totalCurrentValue` instead

---

## Portfolio System

### Portfolio Model Structure

Each user can have multiple portfolio entries (one per token):

```javascript
{
  user: ObjectId,                    // User reference
  token_name: String,                 // Token symbol (e.g., "BTC", "USDT", "XRP")
  amount: Number,                     // Current token amount held
  averageAcquisitionPrice: Number,   // Average price at which tokens were acquired
  totalInvestedUsd: Number,           // Total USD invested in this token
  lastUpdated: Date                  // Last update timestamp
}
```

### Portfolio Entry Example

```javascript
{
  user: "68f02408d173966c99f2db7f",
  token_name: "BTC",
  amount: 0.0008,
  averageAcquisitionPrice: 50000.00,
  totalInvestedUsd: 40.00,
  lastUpdated: "2025-10-24T17:58:14.653Z"
}
```

### Portfolio Calculations

The portfolio system calculates:
- **Current Value**: `amount × currentLivePrice`
- **Profit/Loss**: `currentValue - totalInvestedUsd`
- **Profit/Loss %**: `(profitLoss / totalInvestedUsd) × 100`

---

## Balance Flow

### 1. **Deposit Flow** (When Admin Approves Deposit)

```
User deposits 10 ETC at $15.79/token = $157.90 USD

Step 1: Admin approves deposit
  ↓
Step 2: System fetches live ETC price from CoinMarketCap
  ↓
Step 3: Calculate USD value (10 × $15.79 = $157.90)
  ↓
Step 4: Update User balances:
  - totalInvestment: +$157.90
  - accountBalance: +$157.90
  ↓
Step 5: Update/Create Portfolio entry:
  - token_name: "ETC"
  - amount: +10 ETC
  - totalInvestedUsd: +$157.90
  - averageAcquisitionPrice: calculated
```

**Result:**
- User's `totalInvestment`: $157.90
- User's `accountBalance`: $157.90
- Portfolio entry: 10 ETC worth $157.90

---

### 2. **Withdrawal Flow** (When Admin Approves Withdrawal)

```
User wants to withdraw $80 worth of BTC

Step 1: User creates withdrawal request
  - token_name: "BTC"
  - amount: calculated based on current price
  ↓
Step 2: System validates:
  - User has BTC in portfolio? ✅
  - User has enough BTC amount? ✅
  - accountBalance >= $80? ✅
  ↓
Step 3: Admin approves withdrawal
  ↓
Step 4: System fetches live BTC price
  ↓
Step 5: Calculate token amount ($80 / currentBTCPrice)
  ↓
Step 6: Deduct from Portfolio:
  - BTC amount: -calculated amount
  - totalInvestedUsd: -proportional amount
  ↓
Step 7: Update User balance:
  - accountBalance: -$80
  - totalInvestment: unchanged ✅
```

**Result:**
- User's `totalInvestment`: $157.90 (unchanged)
- User's `accountBalance`: $77.90 (decreased)
- Portfolio entry: BTC amount reduced, ETC unchanged

---

### 3. **Copytrade Purchase Flow** (Current Implementation)

**⚠️ IMPORTANT NOTE**: Currently, copytrade purchases **DO NOT** automatically deduct from `accountBalance`. The purchase is created as a record, but balance deduction must be handled separately.

```
User purchases copytrade plan for $500

Current Behavior:
  - CopytradePurchase record created
  - accountBalance: unchanged ❌
  - totalInvestment: unchanged ✅
  - Portfolio: unchanged ✅

Recommended Future Implementation:
  Step 1: Validate accountBalance >= $500
  Step 2: Create CopytradePurchase record
  Step 3: Deduct from accountBalance: -$500
  Step 4: totalInvestment: unchanged ✅
```

**Note**: You may need to implement balance deduction for copytrade purchases if users should pay from their account balance.

---

## API Endpoints

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication
All portfolio endpoints require user authentication:
```
Authorization: Bearer YOUR_USER_JWT_TOKEN
```

---

### 1. Get User Portfolio

**Endpoint:** `GET /api/v1/portfolio/user/:userId`

**Description:** Retrieves user's complete portfolio with live prices, profit/loss calculations, and totals.

**Request:**
```http
GET /api/v1/portfolio/user/68f02408d173966c99f2db7f
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
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
        "tokenName": "ZEC",
        "amount": 2,
        "averageAcquisitionPrice": 258.38116613,
        "currentPrice": 554.0302316672897,
        "totalInvestedUsd": 516.76233226,
        "currentValue": 1108.06046333,
        "profitLoss": 591.29813107,
        "profitLossPercentage": 114.42,
        "lastUpdated": "2025-10-24T17:58:14.653Z"
      }
    ],
    "totalCurrentValue": 2606.45195905,
    "totalInvestedValue": 2016.9628169,
    "totalProfitLoss": 589.48914215,
    "totalProfitLossPercentage": 29.22
  }
}
```

**Response Fields Explained:**

| Field | Description |
|-------|-------------|
| `holdings[]` | Array of individual token holdings |
| `holdings[].tokenName` | Token symbol (BTC, USDT, XRP, etc.) |
| `holdings[].amount` | Number of tokens held |
| `holdings[].currentPrice` | Live price from CoinMarketCap API |
| `holdings[].currentValue` | `amount × currentPrice` (USD) |
| `holdings[].totalInvestedUsd` | Total USD invested in this token |
| `holdings[].profitLoss` | `currentValue - totalInvestedUsd` |
| `holdings[].profitLossPercentage` | `(profitLoss / totalInvestedUsd) × 100` |
| `totalCurrentValue` | Sum of all `currentValue` (total portfolio worth) |
| `totalInvestedValue` | Sum of all `totalInvestedUsd` (total invested) |
| `totalProfitLoss` | `totalCurrentValue - totalInvestedValue` |
| `totalProfitLossPercentage` | Overall ROI percentage |

---

### 2. Get Available Tokens for Withdrawal

**Endpoint:** `GET /api/v1/portfolio/user/:userId/available-tokens`

**Description:** Returns list of tokens the user can withdraw from (tokens they have in their portfolio).

**Request:**
```http
GET /api/v1/portfolio/user/68f02408d173966c99f2db7f
Authorization: Bearer YOUR_TOKEN
```

**Response (200 OK):**
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
      "tokenName": "ZEC",
      "amount": 2,
      "averagePrice": 258.38116613
    }
  ]
}
```

**Use Case:** Display dropdown/select for withdrawal token selection.

---

### 3. Validate Withdrawal Amount

**Endpoint:** `POST /api/v1/portfolio/validate-withdrawal`

**Description:** Validates if user can withdraw a specific amount of a token. Use this before creating withdrawal request.

**Request:**
```http
POST /api/v1/portfolio/validate-withdrawal
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "userId": "68f02408d173966c99f2db7f",
  "tokenName": "BTC",
  "amount": 0.001
}
```

**Response - Valid (200 OK):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "tokenAmount": 0.001,
    "currentPrice": 50000.00,
    "usdValue": 50.00,
    "availableAmount": 0.0008
  }
}
```

**Response - Invalid (200 OK):**
```json
{
  "success": false,
  "data": {
    "valid": false,
    "reason": "Insufficient BTC balance",
    "code": "INSUFFICIENT_TOKEN_BALANCE",
    "requested": 0.001,
    "available": 0.0008,
    "deficit": 0.0002,
    "availableTokens": [
      {
        "tokenName": "USDT",
        "amount": 1500
      }
    ]
  }
}
```

**Use Case:** Validate withdrawal before submission to show errors early.

---

### 4. Recalculate Account Balance (Admin Only)

**Endpoint:** `POST /api/v1/portfolio/user/:userId/recalculate`

**Description:** Recalculates user's `accountBalance` from portfolio holdings using live prices. Useful for syncing balance after price changes.

**Request:**
```http
POST /api/v1/portfolio/user/68f02408d173966c99f2db7f
Authorization: Bearer ADMIN_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Account balance recalculated successfully",
  "data": {
    "newBalance": 2606.45195905
  }
}
```

**Note:** This endpoint is admin-only. Regular users should not need to recalculate balance manually.

---

## Frontend Integration Guide

### Displaying Portfolio in Next.js

Based on your screenshot, you need to display:
1. **Token List**: Individual tokens with amounts and values
2. **Combined Balance**: Total portfolio value
3. **Current Value**: Live USD value of all holdings

### Example React Component

```typescript
// components/PortfolioDisplay.tsx
import { useEffect, useState } from 'react';

interface TokenHolding {
  tokenName: string;
  amount: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercentage: number;
}

interface PortfolioData {
  userId: string;
  holdings: TokenHolding[];
  totalCurrentValue: number;
  totalInvestedValue: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
}

export default function PortfolioDisplay({ userId }: { userId: string }) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPortfolio();
    // Refresh every 60 seconds to get updated prices
    const interval = setInterval(fetchPortfolio, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchPortfolio = async () => {
    try {
      const token = localStorage.getItem('userToken'); // Get from your auth system
      const response = await fetch(
        `http://localhost:5000/api/v1/portfolio/user/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch portfolio');
      }

      const result = await response.json();
      if (result.success) {
        setPortfolio(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch portfolio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading portfolio...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!portfolio) return <div>No portfolio data</div>;

  return (
    <div className="portfolio-container">
      {/* Combined Balance Display */}
      <div className="portfolio-summary">
        <h2>Total Portfolio Value</h2>
        <div className="total-value">
          ${portfolio.totalCurrentValue.toFixed(2)}
        </div>
        <div className="profit-loss">
          {portfolio.totalProfitLoss >= 0 ? '+' : ''}
          ${portfolio.totalProfitLoss.toFixed(2)} 
          ({portfolio.totalProfitLossPercentage >= 0 ? '+' : ''}
          {portfolio.totalProfitLossPercentage.toFixed(2)}%)
        </div>
      </div>

      {/* Token List */}
      <div className="token-list">
        <h3>Your Holdings</h3>
        {portfolio.holdings.length === 0 ? (
          <div>No tokens in portfolio</div>
        ) : (
          portfolio.holdings.map((holding) => (
            <div key={holding.tokenName} className="token-card">
              <div className="token-header">
                <span className="token-name">{holding.tokenName}</span>
                <span className={`profit-loss ${holding.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                  {holding.profitLoss >= 0 ? '+' : ''}
                  ${holding.profitLoss.toFixed(2)} 
                  ({holding.profitLossPercentage >= 0 ? '+' : ''}
                  {holding.profitLossPercentage.toFixed(2)}%)
                </span>
              </div>
              <div className="token-details">
                <div>Amount: {holding.amount} {holding.tokenName}</div>
                <div>Current Price: ${holding.currentPrice.toFixed(2)}</div>
                <div>Current Value: ${holding.currentValue.toFixed(2)}</div>
                <div>Invested: ${holding.totalInvestedUsd.toFixed(2)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

### Displaying Available Tokens for Withdrawal

```typescript
// components/WithdrawalForm.tsx
const [availableTokens, setAvailableTokens] = useState([]);

useEffect(() => {
  const fetchTokens = async () => {
    const response = await fetch(
      `/api/v1/portfolio/user/${userId}/available-tokens`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const result = await response.json();
    if (result.success) {
      setAvailableTokens(result.data);
    }
  };
  fetchTokens();
}, [userId]);

// In your form:
<select name="tokenName">
  {availableTokens.map(token => (
    <option key={token.tokenName} value={token.tokenName}>
      {token.tokenName} ({token.amount} available)
    </option>
  ))}
</select>
```

---

## Balance Storage Logic

### How Balance is Stored

1. **On User Model** (MongoDB):
   - `totalInvestment`: Cumulative sum of all approved deposits
   - `accountBalance`: Current available balance (updated on deposits/withdrawals)

2. **In Portfolio Model** (MongoDB):
   - Individual token holdings with amounts and USD values
   - Used to calculate live portfolio value

### Balance Calculation

**Account Balance** should theoretically equal:
```
accountBalance ≈ sum(portfolio.holdings[].currentValue)
```

However, in practice:
- `accountBalance` is updated immediately on deposit/withdrawal approval
- Portfolio values fluctuate with live prices
- Use `accountBalance` for transaction validation
- Use `portfolio.totalCurrentValue` for display purposes

---

## What Happens During Operations

### ✅ Deposit Approval

1. Admin approves deposit
2. System fetches live token price
3. Calculates USD value
4. Updates `totalInvestment`: `+usdValue`
5. Updates `accountBalance`: `+usdValue`
6. Adds/updates portfolio entry:
   - Token amount: `+tokenAmount`
   - Total invested USD: `+usdValue`
   - Average price: recalculated

**Result:** Both balances increase, portfolio entry created/updated

---

### ✅ Withdrawal Approval

1. Admin approves withdrawal
2. System validates:
   - User has token in portfolio
   - User has sufficient token amount
   - `accountBalance >= usdValue`
3. Fetches live token price
4. Calculates token amount to withdraw
5. Deducts from portfolio:
   - Token amount: `-tokenAmount`
   - Total invested USD: `-proportionalAmount`
6. Updates `accountBalance`: `-usdValue`
7. **`totalInvestment` remains unchanged** ✅

**Result:** `accountBalance` decreases, portfolio entry updated, `totalInvestment` unchanged

---

### ⚠️ Copytrade Purchase (Current State)

**Current Implementation:**
- CopytradePurchase record is created
- **No balance deduction occurs automatically**
- `accountBalance` remains unchanged
- `totalInvestment` remains unchanged
- Portfolio remains unchanged

**Recommendation:**
If users should pay from their balance, implement balance deduction:
1. Validate `accountBalance >= purchaseAmount`
2. Create CopytradePurchase record
3. Deduct from `accountBalance`: `-purchaseAmount`
4. Keep `totalInvestment` unchanged

---

## Examples

### Example 1: User with Multiple Tokens

**Initial State:**
- User deposits 30 USDT ($30)
- User deposits 40 XRP ($100)
- User deposits 0.0008 BTC ($80)

**Portfolio:**
```json
{
  "holdings": [
    { "tokenName": "USDT", "amount": 30, "currentValue": 30.00 },
    { "tokenName": "XRP", "amount": 40, "currentValue": 100.00 },
    { "tokenName": "BTC", "amount": 0.0008, "currentValue": 80.00 }
  ],
  "totalCurrentValue": 210.00
}
```

**User Balances:**
- `totalInvestment`: $210
- `accountBalance`: $210

---

**After Withdrawal:**
- User withdraws $80 worth of BTC

**Portfolio:**
```json
{
  "holdings": [
    { "tokenName": "USDT", "amount": 30, "currentValue": 30.00 },
    { "tokenName": "XRP", "amount": 40, "currentValue": 100.00 },
    { "tokenName": "BTC", "amount": 0.0000, "currentValue": 0.00 }
  ],
  "totalCurrentValue": 130.00
}
```

**User Balances:**
- `totalInvestment`: $210 (unchanged)
- `accountBalance`: $130 (decreased)

---

### Example 2: Frontend Display

Based on your screenshot, display:

```typescript
// Display combined balance
<div className="total-balance">
  <span>Total Portfolio Value</span>
  <span>${portfolio.totalCurrentValue.toFixed(2)}</span>
</div>

// Display token list
{portfolio.holdings.map(token => (
  <div className="token-item">
    <span>{token.tokenName}</span>
    <span>{token.amount} tokens</span>
    <span>${token.currentValue.toFixed(2)}</span>
    <span className={token.profitLoss >= 0 ? 'profit' : 'loss'}>
      {token.profitLossPercentage >= 0 ? '+' : ''}
      {token.profitLossPercentage.toFixed(2)}%
    </span>
  </div>
))}
```

---

## Important Notes

### ⚠️ Balance Synchronization

- `accountBalance` is updated immediately on transactions
- Portfolio values use **live prices** from CoinMarketCap
- Portfolio `totalCurrentValue` may differ slightly from `accountBalance` due to:
  - Price fluctuations
  - Timing differences
  - Rounding differences

**Recommendation:** Use `accountBalance` for transaction validation, use `portfolio.totalCurrentValue` for display.

### ⚠️ Token Price Availability

- Prices are fetched from CoinMarketCap API
- If a token is not listed on CoinMarketCap, the price will be `null`
- Portfolio entries with `null` prices will show `currentValue: null`

### ⚠️ Copytrade Purchases

Currently, copytrade purchases **do not** automatically deduct from `accountBalance`. If you need this functionality, you'll need to:
1. Add balance validation before purchase
2. Deduct balance when purchase is created
3. Update the copytrade purchase controller

---

## Error Handling

### Common Errors

**1. Insufficient Balance**
```json
{
  "success": false,
  "message": "Insufficient totalInvestment to approve this withdrawal",
  "data": {
    "required": 100.00,
    "available": 50.00,
    "deficit": 50.00
  }
}
```

**2. Token Not in Portfolio**
```json
{
  "success": false,
  "data": {
    "valid": false,
    "reason": "You don't have any BTC in your portfolio",
    "code": "TOKEN_NOT_IN_PORTFOLIO"
  }
}
```

**3. Insufficient Token Amount**
```json
{
  "success": false,
  "data": {
    "valid": false,
    "reason": "Insufficient BTC balance",
    "code": "INSUFFICIENT_TOKEN_BALANCE",
    "requested": 0.001,
    "available": 0.0008,
    "deficit": 0.0002
  }
}
```

---

## Summary

### Key Takeaways for Frontend

1. **Use `/api/v1/portfolio/user/:userId`** to get complete portfolio with live prices
2. **Display `totalCurrentValue`** as the combined balance
3. **Show individual tokens** from `holdings[]` array
4. **Use `accountBalance`** for withdrawal validation (from user profile endpoint)
5. **Refresh portfolio** periodically (every 60 seconds) to get updated prices
6. **Handle null prices** gracefully (token not found on CoinMarketCap)

### Balance Fields Summary

| Field | Purpose | Changes When |
|-------|---------|--------------|
| `totalInvestment` | Historical tracking | ✅ Deposit approved |
| `accountBalance` | Available balance | ✅ Deposit approved<br>❌ Withdrawal approved<br>❌ Copytrade purchase (if implemented) |
| `portfolio.totalCurrentValue` | Live portfolio value | Calculated from live prices |

---

## Support

For questions or issues, contact the backend team or refer to the API logs for detailed error messages.

