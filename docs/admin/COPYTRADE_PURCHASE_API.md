# Copytrade Purchase API - Admin End

## Overview

This documentation is for **admin-end developers** implementing copytrade purchase management features in the admin panel. Admins can view, approve, update, and delete copytrade purchases.

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

### 1. Get All Copytrade Purchases

**Endpoint:** `GET /api/v1/copytrade-purchases`

**Description:** Retrieves all copytrade purchases across all users. Useful for admin dashboard.

**Authentication:** Required (Admin JWT Token)

**Query Parameters (Optional):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | String | Filter by status (`pending`, `active`, `completed`, `cancelled`) |
| `userId` | String | Filter by user ID |

---

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e1f",
      "user": {
        "_id": "6897a73e63d62b4a2878ab4c",
        "email": "user@example.com"
      },
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

### 2. Get Copytrade Purchases by User

**Endpoint:** `GET /api/v1/copytrade-purchases/user/:userId`

**Description:** Retrieves all copytrade purchases for a specific user.

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
      "_id": "60f1b2c3d4e5f6a7b8c9d0e1f",
      "trade_title": "Alpha Growth Strategy",
      "initial_investment": 5000,
      "trade_status": "active",
      "createdAt": "2025-10-24T18:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 3. Get Copytrade Purchase by ID

**Endpoint:** `GET /api/v1/copytrade-purchases/:id`

**Description:** Retrieves a specific copytrade purchase by ID.

**Authentication:** Required (Admin JWT Token)

---

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e1f",
    "user": "6897a73e63d62b4a2878ab4c",
    "copytradeOption": "60f1b2c3d4e5f6a7b8c9d0e1f",
    "trade_title": "Alpha Growth Strategy",
    "initial_investment": 5000,
    "trade_current_value": 5500,
    "trade_profit_loss": 500,
    "trade_status": "active",
    "trade_approval_date": "2025-10-24T18:05:00.000Z",
    "createdAt": "2025-10-24T18:00:00.000Z",
    "updatedAt": "2025-10-24T18:05:00.000Z"
  }
}
```

---

### 4. Approve/Update Copytrade Purchase

**Endpoint:** `PUT /api/v1/copytrade-purchases/:id`

**Description:** Updates a copytrade purchase. **Most importantly, changing status from `pending` to `active` triggers approval logic and balance deduction.**

**Authentication:** Required (Admin JWT Token)

---

#### Request Body

**To Approve Purchase (Status: `pending` → `active`):**

```json
{
  "trade_status": "active"
}
```

**To Update Other Fields:**

```json
{
  "trade_current_value": 5500,
  "trade_profit_loss": 500,
  "trade_status": "completed",
  "trade_end_date": "2025-12-08T18:00:00.000Z"
}
```

---

#### Approval Flow (Status: `pending` → `active`)

When admin changes status from `pending` to `active`, the backend automatically:

1. **Fetches live prices** for all user's portfolio tokens
2. **Sorts tokens** by current value (highest first)
3. **Deducts from portfolio** starting with highest value token:
   - Deducts entire token if value ≤ remaining amount needed
   - Deducts partial token if value > remaining amount needed
4. **Recalculates `accountBalance`** from remaining portfolio values
5. **Updates purchase status** to `active`
6. **Sets `trade_approval_date`** to current timestamp

---

#### Success Response - Approval (200 OK)

```json
{
  "success": true,
  "message": "Copytrade purchase approved successfully",
  "data": {
    "purchase": {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e1f",
      "trade_status": "active",
      "trade_approval_date": "2025-10-24T18:05:00.000Z",
      ...
    },
    "deductions": [
      {
        "tokenName": "BTC",
        "tokenAmount": 0.1,
        "usdValue": 5000
      }
    ],
    "newAccountBalance": 5000
  }
}
```

---

#### Success Response - Update (200 OK)

```json
{
  "success": true,
  "message": "Copytrade purchase updated successfully",
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e1f",
    "trade_current_value": 5500,
    "trade_profit_loss": 500,
    "trade_status": "completed",
    ...
  }
}
```

---

#### Error Responses

**1. Insufficient Portfolio Value (400 Bad Request)**

```json
{
  "success": false,
  "message": "Insufficient portfolio value. Required: $5000, Available: $3000",
  "error": "INSUFFICIENT_PORTFOLIO_VALUE",
  "data": {
    "required": 5000,
    "available": 3000,
    "deficit": 2000
  }
}
```

**2. No Portfolio Entries (400 Bad Request)**

```json
{
  "success": false,
  "message": "User has no portfolio entries",
  "error": "NO_PORTFOLIO_ENTRIES"
}
```

**3. Cannot Change Status (400 Bad Request)**

```json
{
  "success": false,
  "message": "Cannot change status of an approved (active) copytrade purchase"
}
```

---

### 5. Delete Copytrade Purchase

**Endpoint:** `DELETE /api/v1/copytrade-purchases/:id`

**Description:** Deletes a copytrade purchase. Use with caution.

**Authentication:** Required (Admin JWT Token)

---

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Copytrade purchase deleted successfully",
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e1f",
    "trade_title": "Alpha Growth Strategy",
    ...
  }
}
```

---

## Admin Workflow

### Step 1: View Pending Purchases

1. Admin calls `GET /api/v1/copytrade-purchases?status=pending`
2. Admin reviews purchase details
3. Admin checks user's balance and portfolio

### Step 2: Approve Purchase

1. Admin calls `PUT /api/v1/copytrade-purchases/:id` with `{ "trade_status": "active" }`
2. Backend automatically:
   - Validates user has sufficient portfolio value
   - Deducts from portfolio (highest value tokens first)
   - Recalculates account balance
   - Updates purchase status
3. Admin receives confirmation with deduction details

### Step 3: Monitor Active Purchases

1. Admin calls `GET /api/v1/copytrade-purchases?status=active`
2. Admin can update `trade_current_value` to reflect performance
3. System automatically calculates `trade_profit_loss`

### Step 4: Complete Purchase

1. When trade duration ends, admin updates status to `completed`
2. Admin sets `trade_end_date`
3. Final `trade_current_value` and `trade_profit_loss` are recorded

---

## Frontend Integration Example

```typescript
// Get all pending purchases
const getPendingPurchases = async () => {
  const token = localStorage.getItem('adminToken');
  
  const response = await fetch('/api/v1/copytrade-purchases?status=pending', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const result = await response.json();
  return result.data;
};

// Approve purchase
const approvePurchase = async (purchaseId: string) => {
  const token = localStorage.getItem('adminToken');
  
  const response = await fetch(`/api/v1/copytrade-purchases/${purchaseId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      trade_status: 'active'
    })
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('Purchase approved');
    console.log('Deductions:', result.data.deductions);
    console.log('New balance:', result.data.newAccountBalance);
    return result.data;
  } else {
    throw new Error(result.message);
  }
};

// Update purchase value
const updatePurchaseValue = async (purchaseId: string, currentValue: number) => {
  const token = localStorage.getItem('adminToken');
  
  const response = await fetch(`/api/v1/copytrade-purchases/${purchaseId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      trade_current_value: currentValue
    })
  });

  const result = await response.json();
  return result.data;
};
```

---

## Important Notes

1. **Approval Triggers Deduction**: Changing status from `pending` to `active` automatically deducts balance from user's portfolio.

2. **Portfolio Deduction Order**: System deducts from highest value tokens first (e.g., BTC before USDT).

3. **Balance Recalculation**: After deduction, `accountBalance` is recalculated from remaining portfolio values.

4. **Status Immutability**: Cannot change status from `active` back to `pending` or other statuses.

5. **Validation**: System validates user has sufficient portfolio value before approval.

6. **Audit Trail**: All actions are logged in audit logs.

---

## Status Management

### Status Values

- `pending` - Waiting for admin approval
- `active` - Approved and running (balance deducted)
- `completed` - Trade completed
- `cancelled` - Trade cancelled

### Status Transitions

```
pending → active → completed
   ↓
cancelled
```

**Allowed Transitions:**
- `pending` → `active` (approval - triggers deduction)
- `pending` → `cancelled` (rejection)
- `active` → `completed` (trade finished)
- `active` → `cancelled` (termination)

**Not Allowed:**
- `active` → `pending` ❌
- `completed` → `active` ❌
- `cancelled` → `active` ❌

---

## Summary

### Key Points for Admin Developers

✅ **Approval Flow**: Change status `pending` → `active` to approve  
✅ **Automatic Deduction**: Balance deducted automatically on approval  
✅ **Portfolio-Based**: Deduction happens from user's portfolio tokens  
✅ **Highest Value First**: System deducts from highest value tokens first  
✅ **Balance Recalculation**: Account balance recalculated after deduction  
✅ **Status Management**: Use status field to track purchase lifecycle  

### Critical Operations

1. **Approve Purchase**: `PUT /:id` with `{ "trade_status": "active" }`
2. **Update Value**: `PUT /:id` with `{ "trade_current_value": ... }`
3. **Complete Trade**: `PUT /:id` with `{ "trade_status": "completed" }`
4. **Cancel Trade**: `PUT /:id` with `{ "trade_status": "cancelled" }`

