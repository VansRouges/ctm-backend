# Admin-End API Documentation

This folder contains API documentation for **admin-end developers** implementing features in the admin panel.

## Available Documentation

### 📊 Portfolio API
**File:** `PORTFOLIO_API.md`

Endpoints for admins to:
- View any user's portfolio
- Check user's available tokens
- Recalculate user's account balance

**Key Endpoints:**
- `GET /api/v1/portfolio/user/:userId` - Get user's portfolio
- `GET /api/v1/portfolio/user/:userId/available-tokens` - Get user's tokens
- `POST /api/v1/portfolio/user/:userId/recalculate` - Recalculate balance

---

### 💼 Copytrade Purchase API
**File:** `COPYTRADE_PURCHASE_API.md`

Endpoints for admins to:
- View all copytrade purchases
- Approve pending purchases (triggers balance deduction)
- Update purchase values
- Complete or cancel purchases

**Key Endpoints:**
- `GET /api/v1/copytrade-purchases` - Get all purchases
- `GET /api/v1/copytrade-purchases/user/:userId` - Get user's purchases
- `PUT /api/v1/copytrade-purchases/:id` - Approve/update purchase
- `DELETE /api/v1/copytrade-purchases/:id` - Delete purchase

---

### 👤 Admin User Actions API
**File:** `ADMIN_USER_ACTIONS.md`

Endpoints for admins to perform actions **on behalf of users**:
- Create deposits for users (with optional auto-approval)
- Create withdrawals for users (with optional auto-approval)
- Create copytrade purchases for users (with optional auto-approval)

**Key Endpoints:**
- `POST /api/v1/deposits/admin` - Create deposit for user
- `POST /api/v1/withdraws/admin` - Create withdrawal for user
- `POST /api/v1/copytrade-purchase/admin` - Create copytrade purchase for user

**Features:**
- Optional `autoApprove` flag for immediate processing
- Automatic balance validation
- Audit logging for all actions
- User notifications

---

## Authentication

All endpoints require admin authentication. Include the admin JWT token in the Authorization header:

```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

---

## Base URL

```
https://your-api-domain.com/api/v1
```

---

## Important Admin Operations

### Approving Copytrade Purchases

When admin changes purchase status from `pending` to `active`:
1. System validates user has sufficient portfolio value
2. System deducts from portfolio (highest value tokens first)
3. System recalculates account balance
4. Purchase status updated to `active`

**Request:**
```json
PUT /api/v1/copytrade-purchases/:id
{
  "trade_status": "active"
}
```

### Recalculating Account Balance

Use this when balance needs to be synced with portfolio:
1. System fetches all portfolio entries
2. Fetches live prices for each token
3. Calculates total current value
4. Updates user's accountBalance

**Request:**
```
POST /api/v1/portfolio/user/:userId/recalculate
```

---

## Quick Start

1. **Admin Authentication**: Ensure admin is logged in and has a valid admin JWT token
2. **Read Documentation**: Check the relevant API documentation file
3. **Implement Endpoints**: Use the provided examples and integration guides
4. **Handle Errors**: Follow error handling patterns in the documentation

---

## Notes

- All endpoints require admin authentication
- User IDs are provided in URL parameters or request bodies
- All endpoints return JSON responses
- Error responses follow consistent format: `{ success: false, message: "...", error: "..." }`
- Success responses follow format: `{ success: true, data: {...} }`
- Approval operations trigger automatic balance deductions
- All admin actions are logged in audit logs

