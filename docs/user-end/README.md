# User-End API Documentation

This folder contains API documentation for **user-end developers** implementing features in the frontend application.

## Available Documentation

### 📊 Portfolio API
**File:** `PORTFOLIO_API.md`

Endpoints for users to:
- View their portfolio with live prices
- Check available tokens for withdrawal
- Validate withdrawal amounts

**Key Endpoints:**
- `GET /api/v1/portfolio/my-portfolio` - Get user's portfolio
- `GET /api/v1/portfolio/my-available-tokens` - Get available tokens
- `POST /api/v1/portfolio/validate-withdrawal` - Validate withdrawal

---

### 💼 Copytrade Purchase API
**File:** `COPYTRADE_PURCHASE_API.md`

Endpoints for users to:
- Create copytrade purchases
- View their copytrade purchases
- Track purchase status

**Key Endpoints:**
- `POST /api/v1/copytrade-purchases` - Create purchase
- `GET /api/v1/copytrade-purchases/my-purchases` - Get user's purchases
- `GET /api/v1/copytrade-purchases/:id` - Get purchase by ID

---

## Authentication

All endpoints require user authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer YOUR_USER_JWT_TOKEN
```

---

## Base URL

```
https://your-api-domain.com/api/v1
```

---

## Quick Start

1. **User Authentication**: Ensure user is logged in and has a valid JWT token
2. **Read Documentation**: Check the relevant API documentation file
3. **Implement Endpoints**: Use the provided examples and integration guides
4. **Handle Errors**: Follow error handling patterns in the documentation

---

## Notes

- User ID is automatically extracted from JWT token - never send it in request bodies
- All endpoints return JSON responses
- Error responses follow consistent format: `{ success: false, message: "...", error: "..." }`
- Success responses follow format: `{ success: true, data: {...} }`

