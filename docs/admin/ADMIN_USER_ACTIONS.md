# Admin User Actions API

This document describes endpoints that allow admins to perform actions **on behalf of users**, including creating deposits, withdrawals, and copytrade purchases.

---

## Table of Contents

1. [Overview](#overview)
2. [Admin Deposit Creation](#admin-deposit-creation)
3. [Admin Withdrawal Creation](#admin-withdrawal-creation)
4. [Admin Copytrade Purchase Creation](#admin-copytrade-purchase-creation)
5. [Common Patterns](#common-patterns)
6. [Error Handling](#error-handling)

---

## Overview

These endpoints enable admins to:
- **Create deposits** for users (with optional auto-approval)
- **Create withdrawals** for users (with optional auto-approval)
- **Create copytrade purchases** for users (with optional auto-approval)

All actions:
- Require admin authentication
- Validate that the target user exists and is not an admin
- Create audit logs for accountability
- Send notifications to the affected user
- Support optional `autoApprove` flag for immediate processing

---

## Admin Deposit Creation

### Endpoint

```
POST /api/v1/deposits/admin
```

**Authentication:** Required (Admin JWT token)

### Description

Allows admins to create deposits on behalf of users. When `autoApprove` is `true`, the deposit is immediately approved and funds are added to the user's account and portfolio.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | String | Yes | The ID of the user receiving the deposit |
| `token_name` | String | Yes | Token symbol (e.g., "BTC", "ETH", "USDT") |
| `amount` | Number | Yes | Amount of tokens being deposited |
| `token_deposit_address` | String | No | Deposit address (optional) |
| `autoApprove` | Boolean | No | If `true`, deposit is immediately approved and funds added (default: `false`) |

### Example Request

```json
POST /api/v1/deposits/admin
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "token_name": "BTC",
  "amount": 0.5,
  "token_deposit_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "autoApprove": true
}
```

### Success Response (201 Created)

**Without autoApprove:**
```json
{
  "success": true,
  "message": "Deposit created successfully (pending approval)",
  "data": {
    "_id": "507f191e810c19729de860ea",
    "token_name": "BTC",
    "amount": 0.5,
    "user": "507f1f77bcf86cd799439011",
    "status": "pending",
    "isDeposit": true,
    "isWithdraw": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**With autoApprove:**
```json
{
  "success": true,
  "message": "Deposit created and approved successfully",
  "data": {
    "_id": "507f191e810c19729de860ea",
    "token_name": "BTC",
    "amount": 0.5,
    "user": "507f1f77bcf86cd799439011",
    "status": "approved",
    "usdValue": 22500.00,
    "tokenPriceAtApproval": 45000.00,
    "approvedAt": "2024-01-15T10:30:00.000Z",
    "isDeposit": true,
    "isWithdraw": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "usdValueAdded": 22500.00,
  "userNewBalance": 25000.00
}
```

### Error Responses

**400 Bad Request - Missing Fields:**
```json
{
  "success": false,
  "message": "Required fields: userId, token_name, amount"
}
```

**403 Forbidden - Admin User:**
```json
{
  "success": false,
  "message": "Cannot create deposits for admin users"
}
```

**404 Not Found - User Not Found:**
```json
{
  "success": false,
  "message": "User not found"
}
```

**502 Bad Gateway - Price Fetch Failed:**
```json
{
  "success": false,
  "message": "Failed to fetch token price",
  "error": "Price service unavailable"
}
```

---

## Admin Withdrawal Creation

### Endpoint

```
POST /api/v1/withdraws/admin
```

**Authentication:** Required (Admin JWT token)

### Description

Allows admins to create withdrawals on behalf of users. The system validates that the user has sufficient balance before creating the withdrawal. When `autoApprove` is `true`, the withdrawal is immediately approved and funds are deducted from the user's account and portfolio.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | String | Yes | The ID of the user making the withdrawal |
| `token_name` | String | Yes | Token symbol (e.g., "BTC", "ETH", "USDT") |
| `amount` | Number | Yes | Amount of tokens being withdrawn |
| `token_withdraw_address` | String | No | Withdrawal address (optional) |
| `autoApprove` | Boolean | No | If `true`, withdrawal is immediately approved and funds deducted (default: `false`) |

### Example Request

```json
POST /api/v1/withdraws/admin
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "token_name": "BTC",
  "amount": 0.3,
  "token_withdraw_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "autoApprove": true
}
```

### Success Response (201 Created)

**Without autoApprove:**
```json
{
  "success": true,
  "message": "Withdrawal created successfully (pending approval)",
  "data": {
    "_id": "507f191e810c19729de860eb",
    "token_name": "BTC",
    "amount": 0.3,
    "user": "507f1f77bcf86cd799439011",
    "status": "pending",
    "isWithdraw": true,
    "isDeposit": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**With autoApprove:**
```json
{
  "success": true,
  "message": "Withdrawal created and approved successfully",
  "data": {
    "_id": "507f191e810c19729de860eb",
    "token_name": "BTC",
    "amount": 0.3,
    "user": "507f1f77bcf86cd799439011",
    "status": "approved",
    "usdValue": 13500.00,
    "tokenPriceAtApproval": 45000.00,
    "approvedAt": "2024-01-15T10:30:00.000Z",
    "isWithdraw": true,
    "isDeposit": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "usdValueDeducted": 13500.00,
  "userNewBalance": 11500.00,
  "userPreviousBalance": 25000.00
}
```

### Error Responses

**400 Bad Request - Insufficient Balance:**
```json
{
  "success": false,
  "message": "Insufficient balance for this withdrawal",
  "data": {
    "requiredUsdValue": 13500.00,
    "currentBalance": 10000.00,
    "deficit": 3500.00
  }
}
```

**400 Bad Request - Missing Fields:**
```json
{
  "success": false,
  "message": "Required fields: userId, token_name, amount"
}
```

**403 Forbidden - Admin User:**
```json
{
  "success": false,
  "message": "Cannot create withdrawals for admin users"
}
```

**404 Not Found - User Not Found:**
```json
{
  "success": false,
  "message": "User not found"
}
```

---

## Admin Copytrade Purchase Creation

### Endpoint

```
POST /api/v1/copytrade-purchase/admin
```

**Authentication:** Required (Admin JWT token)

### Description

Allows admins to create copytrade purchases on behalf of users. The system validates that:
- The user has sufficient `accountBalance` (must be >= `trade_min` of the option)
- The user has sufficient funds for the `initial_investment`

When `autoApprove` is `true`, the purchase is immediately approved, funds are deducted from the user's portfolio (highest value tokens first), and the purchase status changes to `active`.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | String | Yes | The ID of the user making the purchase |
| `copytradeOptionId` | String | Yes | The ID of the copytrade option being purchased |
| `initial_investment` | Number | Yes | Investment amount in USD (must be >= option's `trade_min`) |
| `autoApprove` | Boolean | No | If `true`, purchase is immediately approved and balance deducted (default: `false`) |

### Example Request

```json
POST /api/v1/copytrade-purchase/admin
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "copytradeOptionId": "507f191e810c19729de860ec",
  "initial_investment": 3000,
  "autoApprove": true
}
```

### Success Response (201 Created)

**Without autoApprove:**
```json
{
  "success": true,
  "message": "Copytrade purchase created successfully (pending approval)",
  "data": {
    "purchase": {
      "_id": "507f191e810c19729de860ed",
      "user": "507f1f77bcf86cd799439011",
      "copytradeOption": "507f191e810c19729de860ec",
      "trade_title": "High Risk Trading Plan",
      "trade_min": 1000,
      "trade_max": 10000,
      "trade_risk": "high",
      "trade_roi_min": 5,
      "trade_roi_max": 15,
      "trade_duration": 30,
      "initial_investment": 3000,
      "trade_current_value": 3000,
      "trade_profit_loss": 0,
      "trade_status": "pending",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "note": "Balance will be deducted when admin approves (status changes to active)"
  }
}
```

**With autoApprove:**
```json
{
  "success": true,
  "message": "Copytrade purchase created and approved successfully",
  "data": {
    "purchase": {
      "_id": "507f191e810c19729de860ed",
      "user": "507f1f77bcf86cd799439011",
      "copytradeOption": "507f191e810c19729de860ec",
      "trade_title": "High Risk Trading Plan",
      "trade_min": 1000,
      "trade_max": 10000,
      "trade_risk": "high",
      "trade_roi_min": 5,
      "trade_roi_max": 15,
      "trade_duration": 30,
      "initial_investment": 3000,
      "trade_current_value": 3000,
      "trade_profit_loss": 0,
      "trade_status": "active",
      "trade_start_date": "2024-01-15T10:30:00.000Z",
      "trade_end_date": "2024-02-14T10:30:00.000Z",
      "trade_approval_date": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "deductions": [
      {
        "tokenName": "BTC",
        "tokenAmount": 0.06666667,
        "usdValue": 2000
      },
      {
        "tokenName": "ETH",
        "tokenAmount": 5.55555556,
        "usdValue": 1000
      }
    ],
    "newAccountBalance": 17000.00
  }
}
```

### Error Responses

**400 Bad Request - Insufficient Balance:**
```json
{
  "success": false,
  "message": "User does not have sufficient balance. Minimum required: $1000, Available: $500",
  "error": "INSUFFICIENT_BALANCE_FOR_PURCHASE",
  "data": {
    "required": 1000,
    "available": 500,
    "deficit": 500,
    "tradeTitle": "High Risk Trading Plan"
  }
}
```

**400 Bad Request - Insufficient Funds:**
```json
{
  "success": false,
  "message": "Insufficient funds. Required: $3000, Available: $2000",
  "error": "INSUFFICIENT_FUNDS",
  "data": {
    "required": 3000,
    "available": 2000,
    "deficit": 1000,
    "tradeTitle": "High Risk Trading Plan"
  }
}
```

**400 Bad Request - Investment Below Minimum:**
```json
{
  "success": false,
  "message": "Investment amount is below the minimum required. Minimum: $1000, Provided: $500",
  "error": "INVESTMENT_BELOW_MINIMUM",
  "data": {
    "investment": 500,
    "minimum": 1000,
    "tradeTitle": "High Risk Trading Plan"
  }
}
```

**400 Bad Request - Insufficient Portfolio Value:**
```json
{
  "success": false,
  "message": "Insufficient portfolio value. Required: $3000, Available: $2000",
  "error": "INSUFFICIENT_PORTFOLIO_VALUE",
  "data": {
    "required": 3000,
    "available": 2000,
    "deficit": 1000
  }
}
```

**404 Not Found - Copytrade Option Not Found:**
```json
{
  "success": false,
  "message": "Copytrade option not found",
  "error": "COPYTRADE_OPTION_NOT_FOUND",
  "data": {
    "copytradeOptionId": "507f191e810c19729de860ec"
  }
}
```

**404 Not Found - User Not Found:**
```json
{
  "success": false,
  "message": "User not found",
  "error": "USER_NOT_FOUND"
}
```

---

## Common Patterns

### Pattern 1: Create and Approve in One Step

Use `autoApprove: true` when you want to immediately process the transaction:

```javascript
// Deposit
const depositResponse = await fetch('/api/v1/deposits/admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: '507f1f77bcf86cd799439011',
    token_name: 'BTC',
    amount: 0.5,
    autoApprove: true
  })
});

// Withdrawal
const withdrawalResponse = await fetch('/api/v1/withdraws/admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: '507f1f77bcf86cd799439011',
    token_name: 'BTC',
    amount: 0.3,
    autoApprove: true
  })
});

// Copytrade Purchase
const purchaseResponse = await fetch('/api/v1/copytrade-purchase/admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: '507f1f77bcf86cd799439011',
    copytradeOptionId: '507f191e810c19729de860ec',
    initial_investment: 3000,
    autoApprove: true
  })
});
```

### Pattern 2: Create First, Approve Later

Use `autoApprove: false` (or omit it) to create a pending transaction, then approve it later using the update endpoints:

```javascript
// Step 1: Create deposit (pending)
const createResponse = await fetch('/api/v1/deposits/admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: '507f1f77bcf86cd799439011',
    token_name: 'BTC',
    amount: 0.5,
    autoApprove: false
  })
});

const { data } = await createResponse.json();
const depositId = data._id;

// Step 2: Approve deposit later
const approveResponse = await fetch(`/api/v1/deposits/${depositId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'approved'
  })
});
```

---

## Error Handling

### Common Error Scenarios

1. **User Not Found**: The `userId` provided doesn't exist
   - **Solution**: Verify the user ID is correct

2. **Admin User**: Attempting to create transactions for another admin
   - **Solution**: Only create transactions for regular users (`role: 'user'`)

3. **Insufficient Balance**: User doesn't have enough funds
   - **Solution**: Check user's balance before creating withdrawal or copytrade purchase

4. **Price Service Failure**: Unable to fetch token prices
   - **Solution**: Retry the request or check price service status

5. **Invalid Copytrade Option**: The copytrade option ID doesn't exist
   - **Solution**: Verify the option ID is correct

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "ERROR_CODE",
  "data": {
    // Additional error context
  }
}
```

### Handling Errors in Frontend

```javascript
try {
  const response = await fetch('/api/v1/deposits/admin', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: '507f1f77bcf86cd799439011',
      token_name: 'BTC',
      amount: 0.5,
      autoApprove: true
    })
  });

  const result = await response.json();

  if (!result.success) {
    // Handle error
    if (result.error === 'INSUFFICIENT_BALANCE_FOR_PURCHASE') {
      console.error('User has insufficient balance:', result.data);
      // Show error message to admin
    } else if (result.error === 'USER_NOT_FOUND') {
      console.error('User not found');
      // Show error message to admin
    } else {
      console.error('Unexpected error:', result.message);
      // Show generic error message
    }
  } else {
    // Success - handle response
    console.log('Transaction created successfully:', result.data);
  }
} catch (error) {
  console.error('Network error:', error);
  // Handle network errors
}
```

---

## Important Notes

1. **User Validation**: All endpoints validate that the target user exists and is not an admin
2. **Balance Validation**: Withdrawals and copytrade purchases validate sufficient balance before creation
3. **Audit Logging**: All admin actions are logged in the audit log system
4. **Notifications**: Users receive notifications when admins create transactions on their behalf
5. **Auto-Approve**: When `autoApprove: true`, the transaction is processed immediately (no separate approval step needed)
6. **Portfolio Deduction**: For copytrade purchases, funds are deducted from the highest value tokens first
7. **Balance Recalculation**: After copytrade purchase approval, the user's `accountBalance` is recalculated from remaining portfolio values

---

## Related Documentation

- [Portfolio API](./PORTFOLIO_API.md) - View user portfolios and balances
- [Copytrade Purchase API](./COPYTRADE_PURCHASE_API.md) - Manage copytrade purchases
- [Copytrade Trading](./COPYTRADE_TRADING.md) - Understanding the trading system

