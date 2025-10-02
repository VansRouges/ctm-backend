# Admin Notification System - API Documentation

## Overview
The notification system tracks all user actions (POST requests) and provides real-time visibility for administrators. All notifications are cached using **Redis** with a **60-second TTL** for optimal performance.

## Data Model

```javascript
{
  "_id": "67890abcdef",
  "action": "deposit",                          // Action type (enum)
  "description": "user@example.com just deposited BTC0.005",
  "status": "unread",                           // 'unread' or 'read'
  "metadata": {
    "userId": "12345",                          // User ObjectId
    "userEmail": "user@example.com",
    "amount": 0.005,                            // Optional
    "currency": "BTC",                          // Optional
    "referenceId": "deposit_67890",             // Optional
    "additionalInfo": {}                        // Optional
  },
  "createdAt": "2025-10-02T10:30:00.000Z",
  "updatedAt": "2025-10-02T10:30:00.000Z"
}
```

### Action Types
| Action | Triggered By | Description |
|--------|-------------|-------------|
| `user_created` | User registration | New user account created |
| `deposit` | Deposit request | User submitted deposit |
| `withdraw` | Withdrawal request | User requested withdrawal |
| `copytrade_purchase` | Copytrade purchase | User purchased copytrade plan |
| `support_ticket` | Support ticket | User created support ticket |

---

## API Endpoints

**Base URL**: `/api/v1/notifications`  
**Authentication**: All endpoints require admin JWT token in `Authorization: Bearer <token>` header

---

## API Endpoints

**Base URL**: `/api/v1/notifications`  
**Authentication**: All endpoints require admin JWT token in `Authorization: Bearer <token>` header

---

### 1. Get All Notifications
**`GET /api/v1/notifications`**

Returns all notifications (no pagination). Results are cached in Redis for 60 seconds.

**Query Parameters:**
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `status` | string | No | Filter by status | `?status=unread` |
| `action` | string | No | Filter by action type | `?action=deposit` |
| `sortBy` | string | No | Sort field (default: `createdAt`) | `?sortBy=createdAt` |
| `sortOrder` | string | No | `asc` or `desc` (default: `desc`) | `?sortOrder=desc` |

**Response:**
```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": [
    {
      "_id": "67890abcdef",
      "action": "deposit",
      "description": "user@example.com just deposited BTC0.005",
      "status": "unread",
      "metadata": {
        "userId": "12345",
        "userEmail": "user@example.com",
        "amount": 0.005,
        "currency": "BTC",
        "referenceId": "deposit_67890"
      },
      "createdAt": "2025-10-02T10:30:00.000Z",
      "updatedAt": "2025-10-02T10:30:00.000Z"
    }
  ],
  "totalCount": 150,
  "unreadCount": 45,
  "cached": true,
  "source": "redis"
}
```

**Cache Headers:**
- `X-Cache: HIT` - Data from Redis cache
- `X-Cache: MISS` - Data from database

---

### 2. Get Notification by ID
**`GET /api/v1/notifications/:id`**

**Response:**
```json
{
  "success": true,
  "message": "Notification retrieved successfully",
  "data": {
    "_id": "67890abcdef",
    "action": "withdraw",
    "description": "user@example.com just requested withdrawal of ETH1.5",
    "status": "unread",
    "metadata": {
      "userId": "12345",
      "userEmail": "user@example.com",
      "amount": 1.5,
      "currency": "ETH"
    },
    "createdAt": "2025-10-02T10:30:00.000Z",
    "updatedAt": "2025-10-02T10:30:00.000Z"
  }
}
```

---

### 3. Update Notification Status
**`PUT /api/v1/notifications/:id/status`**

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
  "data": {
    "_id": "67890abcdef",
    "action": "deposit",
    "status": "read",
    ...
  }
}
```

---

### 4. Mark All as Read
**`PUT /api/v1/notifications/mark-all-read`**

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

---

### 5. Delete Notification
**`DELETE /api/v1/notifications/:id`**

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully",
  "data": {
    "_id": "67890abcdef",
    "action": "deposit",
    ...
  }
}
```

---

### 6. Delete All Read Notifications
**`DELETE /api/v1/notifications/delete-all-read`**

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

---

### 7. Get Unread Count
**`GET /api/v1/notifications/unread-count`**

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

---

## Usage Examples

### JavaScript/Fetch
```javascript
// Get all unread notifications
const response = await fetch('/api/v1/notifications?status=unread', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});
const { data, totalCount, unreadCount } = await response.json();

// Mark notification as read
await fetch(`/api/v1/notifications/${notificationId}/status`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ status: 'read' })
});

// Get unread count for badge
const countResponse = await fetch('/api/v1/notifications/unread-count', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
const { data: { unreadCount } } = await countResponse.json();
```

### PowerShell
```powershell
# Get notifications
$headers = @{ "Authorization" = "Bearer $adminToken" }
$notifications = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/notifications?status=unread" -Headers $headers

# Mark as read
$body = @{ status = "read" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/notifications/$notificationId/status" -Method Put -Headers $headers -ContentType "application/json" -Body $body

# Mark all as read
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/notifications/mark-all-read" -Method Put -Headers $headers
```

---

## Frontend Integration

### Polling for New Notifications
```javascript
useEffect(() => {
  const fetchNotifications = async () => {
    const response = await fetch('/api/v1/notifications?status=unread', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();
    setNotifications(data.data);
    setUnreadCount(data.unreadCount);
  };

  fetchNotifications();
  const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
  
  return () => clearInterval(interval);
}, [adminToken]);
```

### Client-Side Pagination
```javascript
// Since API returns all notifications, handle pagination on frontend
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 20;

const paginatedNotifications = notifications.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
);
```

### Optimistic UI Updates
```javascript
const markAsRead = async (notificationId) => {
  // Update UI immediately
  setNotifications(prev =>
    prev.map(n => n._id === notificationId ? { ...n, status: 'read' } : n)
  );
  setUnreadCount(prev => prev - 1);

  // Send request to backend
  await fetch(`/api/v1/notifications/${notificationId}/status`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'read' })
  });
};
```

---

## Caching Details

### Cache Behavior
- **TTL**: 60 seconds
- **Storage**: Redis
- **Invalidation**: Automatic on write operations (create, update, delete)
- **Cache Key Format**: `notifications:{"status":"unread","action":null,"sortBy":"createdAt","sortOrder":"desc"}`

### Performance
- **Cached Response**: ~1-5ms
- **Database Response**: ~100-300ms
- **Cache Hit Rate**: ~95% with 30s polling

---

## Description Patterns

Notifications automatically generate human-readable descriptions:

| Action | Description Pattern |
|--------|---------------------|
| User Created | `"user@example.com just created an account"` |
| Deposit | `"user@example.com just deposited BTC0.005"` |
| Withdraw | `"user@example.com just requested withdrawal of ETH1.5"` |
| Copytrade Purchase | `"user@example.com just purchased Premium Plan copytrading plan"` |
| Support Ticket | `"user@example.com just created a support ticket: 'Cannot withdraw funds'"` |

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common Status Codes:**
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not found
- `500` - Server error