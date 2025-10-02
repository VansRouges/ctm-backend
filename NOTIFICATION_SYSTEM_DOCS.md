# Admin Notification System Documentation

## Overview
The notification system tracks all non-admin POST requests across the backend, providing real-time visibility into user actions for administrators.

## Architecture

### Components
1. **Model**: `model/notification.model.js` - MongoDB schema for notifications
2. **Controller**: `controllers/notification.controller.js` - Business logic for notification management
3. **Routes**: `routes/notification.route.js` - API endpoints (admin-only)
4. **Helper**: `utils/notificationHelper.js` - Utility functions for creating notifications

## Notification Model

### Schema
```javascript
{
  action: String (enum),           // Type of action performed
  description: String,              // Human-readable description
  status: String (enum),            // 'unread' or 'read'
  metadata: {
    userId: ObjectId,              // Reference to User
    userEmail: String,             // User email (for quick access)
    amount: Number,                // Transaction amount (if applicable)
    currency: String,              // Currency/token name
    referenceId: String,           // ID of related resource
    additionalInfo: Mixed          // Any extra data
  },
  createdAt: Date,                 // Auto-generated timestamp
  updatedAt: Date                  // Auto-generated timestamp
}
```

### Action Types
- `user_created` - New user registration
- `deposit` - Deposit request
- `withdraw` - Withdrawal request
- `copytrade_purchase` - Copytrade plan purchase
- `support_ticket` - Support ticket creation

### Status Values
- `unread` - New notification (default)
- `read` - Admin has viewed the notification

## API Endpoints

All notification endpoints require admin authentication (`requireAdminAuth` middleware).

### 1. Get All Notifications
**GET** `/api/v1/notifications`

**Query Parameters:**
- `status` (optional): Filter by status ('unread' or 'read')
- `action` (optional): Filter by action type
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50): Items per page
- `sortBy` (optional, default: 'createdAt'): Sort field
- `sortOrder` (optional, default: 'desc'): Sort order ('asc' or 'desc')

**Example:**
```bash
GET /api/v1/notifications?status=unread&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": [...notifications],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 100,
    "limit": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "unreadCount": 45
}
```

### 2. Get Notification by ID
**GET** `/api/v1/notifications/:id`

**Response:**
```json
{
  "success": true,
  "message": "Notification retrieved successfully",
  "data": {
    "_id": "...",
    "action": "deposit",
    "description": "evelynhansleyy@gmail.com just deposited BTC0.005",
    "status": "unread",
    "metadata": {
      "userId": "...",
      "userEmail": "evelynhansleyy@gmail.com",
      "amount": 0.005,
      "currency": "BTC",
      "referenceId": "..."
    },
    "createdAt": "2025-10-02T10:30:00.000Z",
    "updatedAt": "2025-10-02T10:30:00.000Z",
    "timeAgo": "2 hours ago"
  }
}
```

### 3. Update Notification Status
**PUT** `/api/v1/notifications/:id/status`

**Request Body:**
```json
{
  "status": "read"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification status updated successfully",
  "data": {...}
}
```

### 4. Mark All as Read
**PUT** `/api/v1/notifications/mark-all-read`

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "modifiedCount": 45
  }
}
```

### 5. Delete Notification
**DELETE** `/api/v1/notifications/:id`

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully",
  "data": {...}
}
```

### 6. Delete All Read Notifications
**DELETE** `/api/v1/notifications/delete-all-read`

**Response:**
```json
{
  "success": true,
  "message": "All read notifications deleted",
  "data": {
    "deletedCount": 30
  }
}
```

### 7. Get Unread Count
**GET** `/api/v1/notifications/unread-count`

**Response:**
```json
{
  "success": true,
  "message": "Unread count retrieved successfully",
  "data": {
    "unreadCount": 15
  }
}
```

## Notification Triggers

### User Creation
**Triggered by:** `POST /api/v1/users`

**Description Format:**
- With email: `"evelynhansleyy@gmail.com just created an account"`
- Without email: `"A user just created an account"`

### Deposit
**Triggered by:** `POST /api/v1/deposits`

**Description Format:**
- With amount: `"evelynhansleyy@gmail.com just deposited BTC0.005"`
- Without amount: `"evelynhansleyy@gmail.com just placed a deposit order"`

### Withdraw
**Triggered by:** `POST /api/v1/withdraws`

**Description Format:**
- With amount: `"evelynhansleyy@gmail.com just requested withdrawal of ETH1.5"`
- Without amount: `"evelynhansleyy@gmail.com just placed a withdrawal request"`

### Copytrade Purchase
**Triggered by:** `POST /api/v1/copytrade-purchases`

**Description Format:**
- With plan name: `"evelynhansleyy@gmail.com just purchased Premium Trading Plan copytrading plan"`
- Without plan name: `"evelynhansleyy@gmail.com just made a copytrade purchase"`

### Support Ticket
**Triggered by:** `POST /api/v1/user-support`

**Description Format:**
- With subject: `"evelynhansleyy@gmail.com just created a support ticket: 'Cannot withdraw funds'"`
- Without subject: `"evelynhansleyy@gmail.com just created a support ticket"`

## Testing the Notification System

### 1. Test User Creation Notification
```powershell
# Create a new user
$newUser = @{
    email = "testuser@example.com"
    username = "testuser"
    firstName = "Test"
    lastName = "User"
    clerkId = "test_clerk_id_123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/users" -Method Post -ContentType "application/json" -Body $newUser

# Check notifications (as admin)
$headers = @{ "Authorization" = "Bearer $adminToken" }
$notifications = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/notifications?status=unread" -Headers $headers
$notifications.data | Select-Object action, description, createdAt
```

### 2. Test Deposit Notification
```powershell
$deposit = @{
    user = "USER_ID_HERE"
    token_name = "BTC"
    amount = 0.005
    token_deposit_address = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/deposits" -Method Post -ContentType "application/json" -Body $deposit
```

### 3. Test Complete Notification Flow
```powershell
# 1. Login as admin
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/admin/auth/login" -Method Post -ContentType "application/json" -Body '{"username": "admin", "password": "admin123"}'
$adminToken = $response.data.token
$headers = @{ "Authorization" = "Bearer $adminToken" }

# 2. Get unread count
$count = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/notifications/unread-count" -Headers $headers
Write-Output "Unread notifications: $($count.data.unreadCount)"

# 3. Get unread notifications
$unread = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/notifications?status=unread&limit=10" -Headers $headers
$unread.data | ForEach-Object {
    Write-Output "$($_.action): $($_.description) - $($_.timeAgo)"
}

# 4. Mark specific notification as read
$notificationId = $unread.data[0]._id
$statusUpdate = @{ status = "read" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/notifications/$notificationId/status" -Method Put -Headers $headers -ContentType "application/json" -Body $statusUpdate

# 5. Mark all as read
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/notifications/mark-all-read" -Method Put -Headers $headers

# 6. Delete all read notifications
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/notifications/delete-all-read" -Method Delete -Headers $headers
```

## Integration Notes

### Controllers Updated
The following controllers now create notifications on POST requests:
1. `user.controller.js` - createUser()
2. `deposit.controller.js` - createDeposit()
3. `withdraw.controller.js` - createWithdraw()
4. `copytrade-purchase.controller.js` - createCopytradePurchase()
5. `user-support.controller.js` - createUserSupport()

### Error Handling
- Notification creation failures are logged but don't break the main operation
- If notification helper fails, the original request still succeeds
- This ensures system stability even if notification service has issues

### Performance Considerations
- Notifications are created asynchronously (fire-and-forget)
- Indexed fields: `status`, `action`, `createdAt` for fast queries
- Pagination built-in for large notification lists
- Virtual field `timeAgo` provides human-readable timestamps

## Best Practices

1. **Regular Cleanup**: Use `DELETE /api/v1/notifications/delete-all-read` to remove old read notifications
2. **Monitoring**: Check `/api/v1/notifications/unread-count` periodically for dashboard badges
3. **Filtering**: Use status and action filters to manage specific notification types
4. **Pagination**: Always use pagination for large notification lists

## Future Enhancements

Potential improvements to consider:
- Real-time notifications via WebSockets
- Email notifications for critical actions
- Notification preferences/settings
- Notification categories and priority levels
- Bulk operations (mark multiple as read)
- Export notifications to CSV/PDF

Your notification system is now fully integrated and ready to track all user actions! 🎉