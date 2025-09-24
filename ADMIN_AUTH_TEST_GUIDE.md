# Test JWT Admin Authentication

## Quick Test Commands

### 1. Start the server
```bash
npm start
```

### 2. Login to get admin token
```bash
curl -X POST http://localhost:3000/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "admin_001",
      "username": "admin",
      "email": "admin@ctm.com",
      "role": "admin"
    },
    "expiresIn": "24h"
  }
}
```

### 3. Copy the token and test protected endpoints

**Test without token (should fail with 401):**
```bash
curl -X GET http://localhost:3000/api/v1/users
```

**Test with admin token (should succeed):**
```bash
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Test other protected endpoints

**All these now require admin authentication:**

- `GET /api/v1/users` - Get all users
- `GET /api/v1/deposits` - Get all deposits  
- `GET /api/v1/withdraws` - Get all withdrawals
- `GET /api/v1/user-support` - Get all support tickets
- `GET /api/v1/copytrading-options` - Get all copytrading options
- `GET /api/v1/copytrade-purchases` - Get all copytrade purchases
- `GET /api/v1/crypto-options` - Get all crypto options
- `GET /api/v1/admin-emails` - Get all admin emails (all admin-email endpoints protected)
- `POST /api/admin/update-stocks` - Manual stock update
- All DELETE endpoints for the above resources

### 5. Verify session
```bash
curl -X GET http://localhost:3000/api/v1/admin/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6. Logout
```bash
curl -X POST http://localhost:3000/api/v1/admin/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## PowerShell Version (for Windows)

### Login
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/admin/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"username": "admin", "password": "admin123"}'

$token = $response.data.token
Write-Output "Token: $token"
```

### Test protected endpoint
```powershell
$headers = @{ "Authorization" = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/users" -Headers $headers
```

## Authentication Flow Summary

1. **Login** → Get JWT token (24-hour expiration)
2. **Use token** → Include `Authorization: Bearer <token>` header
3. **Access protected resources** → Admin endpoints now secured
4. **Logout** → Clear session (optional, token expires anyway)

## Security Features Implemented

✅ **JWT Token Authentication** - 24-hour expiration  
✅ **Admin Role Validation** - Only admin users can access protected endpoints  
✅ **Secure Password Hashing** - bcrypt with 12 salt rounds  
✅ **Bearer Token Format** - Standard Authorization header  
✅ **HttpOnly Cookies** - Additional security for browser clients  
✅ **Environment-based Secrets** - JWT secret from .env files  

## Protected Endpoints Summary

All these endpoints now require valid admin authentication:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | Get all users |
| DELETE | `/api/v1/users/:id` | Delete user |
| GET | `/api/v1/deposits` | Get all deposits |
| DELETE | `/api/v1/deposits/:id` | Delete deposit |
| GET | `/api/v1/withdraws` | Get all withdrawals |
| DELETE | `/api/v1/withdraws/:id` | Delete withdrawal |
| GET | `/api/v1/user-support` | Get all support tickets |
| DELETE | `/api/v1/user-support/:id` | Delete support ticket |
| GET | `/api/v1/copytrading-options` | Get all copytrading options |
| DELETE | `/api/v1/copytrading-options/:id` | Delete copytrading option |
| GET | `/api/v1/copytrade-purchases` | Get all copytrade purchases |
| DELETE | `/api/v1/copytrade-purchases/:id` | Delete copytrade purchase |
| GET | `/api/v1/crypto-options` | Get all crypto options |
| DELETE | `/api/v1/crypto-options/:id` | Delete crypto option |
| ALL | `/api/v1/admin-emails/*` | All admin email operations |
| POST | `/api/admin/update-stocks` | Manual stock update |