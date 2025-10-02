# Admin Notification System - Quick Reference

## ✅ What's Been Implemented

### 📦 New Files Created
1. `model/notification.model.js` - Notification schema with timestamps
2. `controllers/notification.controller.js` - Complete CRUD operations
3. `routes/notification.route.js` - Admin-only API endpoints
4. `utils/notificationHelper.js` - Helper functions for creating notifications

### 🔄 Files Modified
1. `app.js` - Added notification routes
2. `controllers/user.controller.js` - Notifications on user creation
3. `controllers/deposit.controller.js` - Notifications on deposit creation
4. `controllers/withdraw.controller.js` - Notifications on withdrawal creation
5. `controllers/copytrade-purchase.controller.js` - Notifications on purchase
6. `controllers/user-support.controller.js` - Notifications on support ticket creation

## 🎯 Key Features

### Automatic Notifications
Every non-admin POST request creates a notification:
- ✅ User registration
- ✅ Deposit requests
- ✅ Withdrawal requests
- ✅ Copytrade purchases
- ✅ Support tickets

### Description Examples
- `"evelynhansleyy@gmail.com just created an account"`
- `"evelynhansleyy@gmail.com just deposited BTC0.005"`
- `"evelynhansleyy@gmail.com just requested withdrawal of ETH1.5"`
- `"evelynhansleyy@gmail.com just purchased Premium Plan copytrading plan"`
- `"evelynhansleyy@gmail.com just created a support ticket: 'Cannot withdraw'"`

### Admin Operations
- ✅ View all notifications (with filters & pagination)
- ✅ Mark as read/unread
- ✅ Mark all as read
- ✅ Delete individual notifications
- ✅ Delete all read notifications
- ✅ Get unread count

## 🚀 Quick Start

### 1. Get Unread Notifications
```powershell
GET /api/v1/notifications?status=unread&limit=20
Authorization: Bearer <admin-token>
```

### 2. Mark Notification as Read
```powershell
PUT /api/v1/notifications/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "read"
}
```

### 3. Get Unread Count (for badges)
```powershell
GET /api/v1/notifications/unread-count
Authorization: Bearer <admin-token>
```

### 4. Mark All as Read
```powershell
PUT /api/v1/notifications/mark-all-read
Authorization: Bearer <admin-token>
```

### 5. Delete All Read Notifications
```powershell
DELETE /api/v1/notifications/delete-all-read
Authorization: Bearer <admin-token>
```

## 📊 Response Format

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": [
    {
      "_id": "67890",
      "action": "deposit",
      "description": "evelynhansleyy@gmail.com just deposited BTC0.005",
      "status": "unread",
      "metadata": {
        "userId": "12345",
        "userEmail": "evelynhansleyy@gmail.com",
        "amount": 0.005,
        "currency": "BTC",
        "referenceId": "deposit_id"
      },
      "createdAt": "2025-10-02T10:30:00.000Z",
      "updatedAt": "2025-10-02T10:30:00.000Z",
      "timeAgo": "2 hours ago"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalCount": 50,
    "limit": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "unreadCount": 15
}
```

## 🔍 Query Filters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | Filter by read/unread | `?status=unread` |
| `action` | string | Filter by action type | `?action=deposit` |
| `page` | number | Page number | `?page=2` |
| `limit` | number | Items per page | `?limit=50` |
| `sortBy` | string | Sort field | `?sortBy=createdAt` |
| `sortOrder` | string | asc or desc | `?sortOrder=desc` |

## 🎨 Action Types

| Action | Description |
|--------|-------------|
| `user_created` | New user registration |
| `deposit` | Deposit request |
| `withdraw` | Withdrawal request |
| `copytrade_purchase` | Copytrade purchase |
| `support_ticket` | Support ticket |

## 💡 Integration Tips

1. **Polling**: Call `/unread-count` every 30 seconds for real-time updates
2. **Badge**: Use unreadCount for notification badge in admin UI
3. **Cleanup**: Regularly delete read notifications to keep database clean
4. **Filters**: Use action filters to show specific notification types

## 🛡️ Security

- ✅ All endpoints require admin authentication
- ✅ JWT token validation via `requireAdminAuth` middleware
- ✅ Only admins can view, update, or delete notifications
- ✅ User data automatically populated from database

Your notification system is production-ready! 🎉