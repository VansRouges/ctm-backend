# Copytrade Purchase API - User End

## Overview

This documentation is for **user-end developers** implementing copytrade purchase features in the frontend application. Users can create copytrade purchases, which will be pending until admin approval.

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

### 1. Create Copytrade Purchase

**Endpoint:** `POST /api/v1/copytrade-purchases`

**Description:** Creates a new copytrade purchase with status `pending`. The purchase will be approved by admin later, which triggers balance deduction.

**Authentication:** Required (User JWT Token)

---

#### Request Body

```json
{
  "copytradeOptionId": "60f1b2c3d4e5f6a7b8c9d0e1f",
  "initial_investment": 5000
}
```

**Required Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `copytradeOptionId` | String (ObjectId) | ID of the copytrade option being purchased |
| `initial_investment` | Number | Amount in USD the user wants to invest |

**Optional Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `trade_current_value` | Number | Initial current value (defaults to `initial_investment`) |
| `trade_profit_loss` | Number | Initial profit/loss (defaults to 0) |
| `trade_token` | String | Token symbol (optional, not used) |
| `trade_token_address` | String | Token contract address (optional, not used) |
| `trade_win_rate` | Number | Win rate percentage (optional) |

**Note:** The `user` field is automatically set from the authenticated user's token. Do not send it in the request.

---

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Copytrade purchase created successfully (pending approval)",
  "data": {
    "purchase": {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e1f",
      "user": "6897a73e63d62b4a2878ab4c",
      "copytradeOption": "60f1b2c3d4e5f6a7b8c9d0e1f",
      "trade_title": "Alpha Growth Strategy",
      "trade_min": 1000,
      "trade_max": 25000,
      "trade_risk": "medium",
      "trade_roi_min": 8,
      "trade_roi_max": 22,
      "trade_duration": 45,
      "initial_investment": 5000,
      "trade_current_value": 5000,
      "trade_profit_loss": 0,
      "trade_status": "pending",
      "createdAt": "2025-10-24T18:00:00.000Z",
      "updatedAt": "2025-10-24T18:00:00.000Z"
    },
    "note": "Balance will be deducted when admin approves (status changes to active)"
  }
}
```

---

#### Error Responses

**1. Missing Required Field (400 Bad Request)**

```json
{
  "success": false,
  "message": "copytradeOptionId is required"
}
```

**2. Copytrade Option Not Found (404 Not Found)**

```json
{
  "success": false,
  "message": "Copytrade option not found",
  "error": "COPYTRADE_OPTION_NOT_FOUND"
}
```

**3. Investment Below Minimum (400 Bad Request)**

```json
{
  "success": false,
  "message": "Investment amount is below minimum. Minimum: $1000, Provided: $500",
  "error": "INVESTMENT_BELOW_MINIMUM",
  "data": {
    "investment": 500,
    "minimum": 1000,
    "tradeTitle": "Alpha Growth Strategy"
  }
}
```

**4. Insufficient Balance (400 Bad Request)**

```json
{
  "success": false,
  "message": "User does not have sufficient balance. Minimum required: $1000, Available: $500",
  "error": "INSUFFICIENT_BALANCE_FOR_PURCHASE",
  "data": {
    "required": 1000,
    "available": 500,
    "deficit": 500
  }
}
```

**5. Insufficient Funds (400 Bad Request)**

```json
{
  "success": false,
  "message": "Insufficient funds. Required: $5000, Available: $3000",
  "error": "INSUFFICIENT_FUNDS",
  "data": {
    "required": 5000,
    "available": 3000,
    "deficit": 2000
  }
}
```

---

### 2. Get My Copytrade Purchases

**Endpoint:** `GET /api/v1/copytrade-purchases/my-purchases`

**Description:** Retrieves all copytrade purchases for the authenticated user.

**Authentication:** Required (User JWT Token)

---

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e1f",
      "trade_title": "Alpha Growth Strategy",
      "initial_investment": 5000,
      "trade_current_value": 5500,
      "trade_profit_loss": 500,
      "trade_status": "active",
      "trade_roi_min": 8,
      "trade_roi_max": 22,
      "trade_duration": 45,
      "createdAt": "2025-10-24T18:00:00.000Z",
      "updatedAt": "2025-10-24T18:05:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 3. Get Copytrade Purchase by ID

**Endpoint:** `GET /api/v1/copytrade-purchases/:id`

**Description:** Retrieves a specific copytrade purchase by ID. Users can only access their own purchases.

**Authentication:** Required (User JWT Token)

---

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e1f",
    "user": "6897a73e63d62b4a2878ab4c",
    "trade_title": "Alpha Growth Strategy",
    "initial_investment": 5000,
    "trade_current_value": 5500,
    "trade_profit_loss": 500,
    "trade_status": "active",
    "trade_roi_min": 8,
    "trade_roi_max": 22,
    "trade_duration": 45,
    "trade_approval_date": "2025-10-24T18:05:00.000Z",
    "createdAt": "2025-10-24T18:00:00.000Z",
    "updatedAt": "2025-10-24T18:05:00.000Z"
  }
}
```

---

## Purchase Flow

### Step 1: User Creates Purchase

1. User selects a copytrade option
2. User enters investment amount
3. Frontend calls `POST /api/v1/copytrade-purchases`
4. Purchase is created with status `pending`
5. **No balance deduction** at this point

### Step 2: Admin Approves (Backend)

1. Admin reviews purchase in admin panel
2. Admin changes status from `pending` to `active`
3. Backend automatically:
   - Deducts from user's portfolio (highest value tokens first)
   - Recalculates account balance
   - Updates purchase status

### Step 3: User Views Purchase

1. User can view their purchases via `GET /api/v1/copytrade-purchases/my-purchases`
2. Status will show:
   - `pending` - Waiting for admin approval
   - `active` - Approved and running
   - `completed` - Trade completed
   - `cancelled` - Trade cancelled

---

## Frontend Integration Example

```typescript
// Create copytrade purchase
const createPurchase = async (optionId: string, amount: number) => {
  try {
    const token = localStorage.getItem('userToken');
    
    const response = await fetch('/api/v1/copytrade-purchases', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        copytradeOptionId: optionId,
        initial_investment: amount
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Purchase created:', result.data.purchase);
      console.log('Status:', result.data.purchase.trade_status); // "pending"
      return result.data.purchase;
    } else {
      // Handle error
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error creating purchase:', error);
    throw error;
  }
};

// Get user's purchases
const getMyPurchases = async () => {
  try {
    const token = localStorage.getItem('userToken');
    
    const response = await fetch('/api/v1/copytrade-purchases/my-purchases', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
  } catch (error) {
    console.error('Error fetching purchases:', error);
    throw error;
  }
};

// Get purchase by ID
const getPurchaseById = async (purchaseId: string) => {
  try {
    const token = localStorage.getItem('userToken');
    
    const response = await fetch(`/api/v1/copytrade-purchases/${purchaseId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
  } catch (error) {
    console.error('Error fetching purchase:', error);
    throw error;
  }
};
```

---

## Important Notes

1. **User Authentication**: The `user` field is automatically set from the JWT token. Never send it in the request body.

2. **Pending Status**: All purchases start as `pending`. Balance deduction happens only when admin approves.

3. **Balance Validation**: System validates that user has sufficient balance before creating purchase, but doesn't deduct until approval.

4. **Status Values**: 
   - `pending` - Waiting for admin approval
   - `active` - Approved and running
   - `completed` - Trade completed
   - `cancelled` - Trade cancelled

5. **Error Handling**: Always check `result.success` and handle errors appropriately.

6. **Token Management**: Store user JWT token securely (e.g., localStorage, secure cookie).

---

## Status Flow

```
pending → active → completed
   ↓
cancelled
```

- Users can only create purchases (`pending`)
- Admin approves (`pending` → `active`)
- Admin can cancel (`pending` → `cancelled`)
- System completes trades (`active` → `completed`)

---

## Summary

### Key Points for Frontend Developers

✅ **Simple API**: Only need `copytradeOptionId` and `initial_investment`  
✅ **Auto User ID**: User ID comes from JWT token automatically  
✅ **Pending by Default**: All purchases start as `pending`  
✅ **No Balance Deduction**: Balance deducted only on admin approval  
✅ **Status Tracking**: Use status field to show purchase state to users  

### Required Fields

- `copytradeOptionId` - The option being purchased
- `initial_investment` - Investment amount in USD

### Optional Fields

- `trade_current_value` - Defaults to `initial_investment`
- `trade_profit_loss` - Defaults to 0
- `trade_token` - Not used (optional)
- `trade_token_address` - Not used (optional)
- `trade_win_rate` - Optional metadata

