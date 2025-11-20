# Portfolio API - User End

## Overview

This documentation is for **user-end developers** implementing portfolio features in the frontend application. Users can view their portfolio, check available tokens for withdrawal, and validate withdrawal amounts.

---

## Base URL

```
https://your-api-domain.com/api/v1
```

---

## Authentication

All endpoints require user authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer YOUR_USER_JWT_TOKEN
```

---

## Endpoints

### 1. Get My Portfolio

**Endpoint:** `GET /api/v1/portfolio/my-portfolio`

**Description:** Retrieves the authenticated user's complete portfolio with live prices, profit/loss calculations, and totals.

**Authentication:** Required (User JWT Token)

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

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `holdings[]` | Array | Array of individual token holdings |
| `holdings[].tokenName` | String | Token symbol (e.g., "BTC", "USDT") |
| `holdings[].amount` | Number | Number of tokens held |
| `holdings[].currentPrice` | Number | Live price from CoinMarketCap API |
| `holdings[].currentValue` | Number | `amount × currentPrice` (USD) |
| `holdings[].totalInvestedUsd` | Number | Total USD invested in this token |
| `holdings[].profitLoss` | Number | `currentValue - totalInvestedUsd` |
| `holdings[].profitLossPercentage` | Number | `(profitLoss / totalInvestedUsd) × 100` |
| `totalCurrentValue` | Number | Sum of all `currentValue` (total portfolio worth) |
| `totalInvestedValue` | Number | Sum of all `totalInvestedUsd` (total invested) |
| `totalProfitLoss` | Number | `totalCurrentValue - totalInvestedValue` |
| `totalProfitLossPercentage` | Number | Overall ROI percentage |

---

#### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Failed to fetch portfolio",
  "error": "Error message details"
}
```

---

### 2. Get My Available Tokens

**Endpoint:** `GET /api/v1/portfolio/my-available-tokens`

**Description:** Returns a list of tokens the user has in their portfolio that can be used for withdrawal.

**Authentication:** Required (User JWT Token)

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

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `data[]` | Array | List of available tokens |
| `data[].tokenName` | String | Token symbol (e.g., "BTC", "USDT") |
| `data[].amount` | Number | Amount of tokens available |
| `data[].averagePrice` | Number | Average acquisition price per token |

---

#### Empty Portfolio Response (200 OK)

```json
{
  "success": true,
  "data": []
}
```

---

### 3. Validate Withdrawal Amount

**Endpoint:** `POST /api/v1/portfolio/validate-withdrawal`

**Description:** Validates if the user can withdraw a specific amount of a token. Use this before submitting the withdrawal request to show errors early.

**Authentication:** Required (User JWT Token)

---

#### Request Body

```json
{
  "tokenName": "BTC",
  "amount": 0.001
}
```

**Required Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `tokenName` | String | Token symbol (e.g., "BTC", "USDT", "XRP") |
| `amount` | Number | Amount of tokens to withdraw |

**Note:** The `userId` field is automatically set from the authenticated user's token. Do not send it in the request.

---

#### Valid Withdrawal Response (200 OK)

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

---

#### Invalid Response - Token Not in Portfolio (200 OK)

```json
{
  "success": false,
  "data": {
    "valid": false,
    "reason": "You don't have any BTC in your portfolio",
    "code": "TOKEN_NOT_IN_PORTFOLIO",
    "availableTokens": [
      {
        "tokenName": "USDT",
        "amount": 1500
      }
    ]
  }
}
```

---

#### Invalid Response - Insufficient Balance (200 OK)

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

## Frontend Integration Examples

### Display Portfolio

```typescript
// Fetch user portfolio
const getMyPortfolio = async () => {
  try {
    const token = localStorage.getItem('userToken');
    
    const response = await fetch('/api/v1/portfolio/my-portfolio', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    throw error;
  }
};

// Usage in React component
const PortfolioDisplay = () => {
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      const data = await getMyPortfolio();
      setPortfolio(data);
    };
    
    fetchPortfolio();
    // Refresh every 60 seconds for updated prices
    const interval = setInterval(fetchPortfolio, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!portfolio) return <div>Loading...</div>;

  return (
    <div>
      <h2>Total Portfolio Value: ${portfolio.totalCurrentValue.toFixed(2)}</h2>
      {portfolio.holdings.map(token => (
        <div key={token.tokenName}>
          <h3>{token.tokenName}</h3>
          <p>Amount: {token.amount}</p>
          <p>Current Value: ${token.currentValue.toFixed(2)}</p>
          <p>Profit/Loss: {token.profitLossPercentage >= 0 ? '+' : ''}
            {token.profitLossPercentage.toFixed(2)}%</p>
        </div>
      ))}
    </div>
  );
};
```

---

### Get Available Tokens for Withdrawal

```typescript
// Fetch available tokens
const getMyAvailableTokens = async () => {
  try {
    const token = localStorage.getItem('userToken');
    
    const response = await fetch('/api/v1/portfolio/my-available-tokens', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
  } catch (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }
};

// Usage in withdrawal form
const WithdrawalForm = () => {
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState('');

  useEffect(() => {
    const fetchTokens = async () => {
      const data = await getMyAvailableTokens();
      setTokens(data);
    };
    fetchTokens();
  }, []);

  return (
    <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)}>
      <option value="">Select Token</option>
      {tokens.map(token => (
        <option key={token.tokenName} value={token.tokenName}>
          {token.tokenName} ({token.amount} available)
        </option>
      ))}
    </select>
  );
};
```

---

### Validate Withdrawal

```typescript
// Validate withdrawal before submission
const validateWithdrawal = async (tokenName: string, amount: number) => {
  try {
    const token = localStorage.getItem('userToken');
    
    const response = await fetch('/api/v1/portfolio/validate-withdrawal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tokenName,
        amount
      })
    });

    const result = await response.json();
    
    if (result.success && result.data.valid) {
      // ✅ Validation passed
      return {
        isValid: true,
        usdValue: result.data.usdValue,
        currentPrice: result.data.currentPrice
      };
    } else {
      // ❌ Validation failed
      return {
        isValid: false,
        error: result.data.reason,
        code: result.data.code,
        availableTokens: result.data.availableTokens
      };
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Network error. Please try again.'
    };
  }
};

// Usage in form
const handleWithdrawalSubmit = async () => {
  const validation = await validateWithdrawal(selectedToken, amount);
  
  if (!validation.isValid) {
    // Show error message
    setError(validation.error);
    if (validation.availableTokens) {
      // Show available tokens
      setAvailableTokens(validation.availableTokens);
    }
    return;
  }
  
  // Proceed with withdrawal submission
  // Show USD value: validation.usdValue
};
```

---

## Important Notes

1. **User Authentication**: The `userId` field is automatically set from the JWT token. Never send it in request bodies.

2. **Live Prices**: Portfolio prices are fetched live from CoinMarketCap API, so values may fluctuate.

3. **Price Availability**: If a token is not listed on CoinMarketCap, `currentPrice` will be `null` and `currentValue` will be `null`.

4. **Empty Portfolio**: If user has no tokens, `my-available-tokens` returns an empty array `[]`.

5. **Validation Timing**: Call validation endpoint as user types or selects token to provide immediate feedback.

6. **Token Names**: Always use uppercase (e.g., "BTC", "USDT", "XRP"). The API converts to uppercase automatically.

7. **Refresh Frequency**: Consider refreshing portfolio every 60 seconds to get updated prices.

---

## Error Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| `TOKEN_NOT_IN_PORTFOLIO` | User doesn't have this token | User tries to withdraw a token they never deposited |
| `INSUFFICIENT_TOKEN_BALANCE` | User doesn't have enough tokens | User tries to withdraw more than they have |

---

## Summary

### Key Points for Frontend Developers

✅ **Simple Endpoints**: Three main endpoints for portfolio management  
✅ **Auto User ID**: User ID comes from JWT token automatically  
✅ **Live Prices**: Prices fetched live from CoinMarketCap  
✅ **Validation**: Validate withdrawals before submission  
✅ **Error Handling**: Handle empty portfolios and null prices gracefully  

### Endpoints Summary

1. **GET `/my-portfolio`** - Get complete portfolio with live prices
2. **GET `/my-available-tokens`** - Get tokens available for withdrawal
3. **POST `/validate-withdrawal`** - Validate withdrawal before submission

### Display Recommendations

- Show `totalCurrentValue` as the main balance
- Display individual tokens from `holdings[]` array
- Show profit/loss with color coding (green for profit, red for loss)
- Refresh portfolio periodically (every 60 seconds)
- Handle null prices gracefully (token not found on CoinMarketCap)

