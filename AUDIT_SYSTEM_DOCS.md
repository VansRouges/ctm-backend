# Admin Audit System - API Documentation

## Overview
The Audit System tracks all administrative actions for accountability and monitoring. Every admin operation is logged with detailed metadata including who performed the action, what changed, and when. All audit logs are cached using **Redis** with a **60-second TTL**.

## Data Model

```javascript
{
  "_id": "507f1f77bcf86cd799439011",
  "admin": {
    "id": "admin_001",
    "username": "admin",
    "email": "admin@ctm.com"
  },
  "action": "user_update",                      // Action type (enum)
  "resource": {
    "type": "user",                             // Resource type
    "id": "507f191e810c19729de860ea",          // Resource ID
    "name": "user@example.com"                  // Resource name
  },
  "changes": {                                  // Optional: before/after values
    "before": { "balance": 1000 },
    "after": { "balance": 1500 }
  },
  "metadata": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "statusCode": 200,
    "method": "PUT",
    "endpoint": "/api/v1/users/507f191e810c19729de860ea"
  },
  "description": "Updated user: user@example.com",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Action Types
| Category | Actions |
|----------|---------|
| **Admin** | `admin_login`, `admin_logout`, `admin_password_change` |
| **User** | `user_create`, `user_update`, `user_delete`, `user_bulk_update`, `user_bulk_delete` |
| **Notification** | `notification_create`, `notification_update`, `notification_delete`, `notification_bulk_update`, `notification_bulk_delete` |
| **Support** | `support_ticket_create`, `support_ticket_update`, `support_ticket_delete`, `support_ticket_bulk_update` |
| **Copytrade** | `copytrade_purchase_create`, `copytrade_purchase_update`, `copytrade_purchase_delete` |
| **Stock** | `stock_create`, `stock_update`, `stock_delete`, `stock_update_trigger` |

### Resource Types
`user`, `notification`, `support_ticket`, `copytrade_purchase`, `stock`, `deposit`, `withdraw`, `admin`

---

## API Endpoints

**Base URL**: `/api/v1/audit-logs`  
**Authentication**: All endpoints require admin JWT token in `Authorization: Bearer <token>` header

---

### 1. Get All Audit Logs
**`GET /api/v1/audit-logs`**

Returns all audit logs (no pagination). Results are cached in Redis for 60 seconds.

**Query Parameters:**
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `action` | string | No | Filter by action type | `?action=user_update` |
| `resourceType` | string | No | Filter by resource type | `?resourceType=user` |
| `adminId` | string | No | Filter by admin ID | `?adminId=admin_001` |
| `sortBy` | string | No | Sort field (default: `createdAt`) | `?sortBy=createdAt` |
| `sortOrder` | string | No | `asc` or `desc` (default: `desc`) | `?sortOrder=desc` |

**Response:**
```json
{
  "success": true,
  "message": "Audit logs retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "admin": {
        "id": "admin_001",
        "username": "admin",
        "email": "admin@ctm.com"
      },
      "action": "user_update",
      "resource": {
        "type": "user",
        "id": "507f191e810c19729de860ea",
        "name": "user@example.com"
      },
      "changes": {
        "before": { "balance": 1000, "status": "active" },
        "after": { "balance": 1500, "status": "active" }
      },
      "metadata": {
        "ip": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "statusCode": 200,
        "method": "PUT",
        "endpoint": "/api/v1/users/507f191e810c19729de860ea"
      },
      "description": "Updated user: user@example.com",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "totalCount": 150,
  "cached": true,
  "source": "redis"
}
```

**Cache Headers:**
- `X-Cache: HIT` - Data from Redis cache
- `X-Cache: MISS` - Data from database

---

### 2. Get Audit Log by ID
**`GET /api/v1/audit-logs/:id`**

**Response:**
```json
{
  "success": true,
  "message": "Audit log retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "admin": { "id": "admin_001", "username": "admin", "email": "admin@ctm.com" },
    "action": "user_delete",
    "resource": { "type": "user", "id": "507f191e810c19729de860ea", "name": "user@example.com" },
    "description": "Deleted user: user@example.com",
    "metadata": { ... },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 3. Get Audit Logs by Admin
**`GET /api/v1/audit-logs/admin/:adminId`**

Returns all audit logs for a specific admin.

**Response:**
```json
{
  "success": true,
  "message": "Admin audit logs retrieved successfully",
  "data": [...],
  "count": 25
}
```

---

### 4. Get Audit Statistics
**`GET /api/v1/audit-logs/stats`**

**Response:**
```json
{
  "success": true,
  "message": "Audit statistics retrieved successfully",
  "data": {
    "totalLogs": 1250,
    "topActions": [
      { "_id": "user_update", "count": 450 },
      { "_id": "notification_update", "count": 320 },
      { "_id": "admin_login", "count": 180 }
    ],
    "resourceBreakdown": [
      { "_id": "user", "count": 550 },
      { "_id": "notification", "count": 380 },
      { "_id": "support_ticket", "count": 150 }
    ],
    "recentActivity": [
      { "_id": "...", "action": "user_update", "createdAt": "...", ... }
    ]
  }
}
```

---

## Usage Examples

### JavaScript/Fetch
```javascript
// Get all audit logs
const response = await fetch('/api/v1/audit-logs', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});
const { data, totalCount } = await response.json();

// Filter by action type
const userUpdates = await fetch('/api/v1/audit-logs?action=user_update&sortOrder=desc', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});

// Get logs for specific admin
const adminLogs = await fetch(`/api/v1/audit-logs/admin/${adminId}`, {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});

// Get statistics
const stats = await fetch('/api/v1/audit-logs/stats', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
```

### PowerShell
```powershell
# Get all audit logs
$headers = @{ "Authorization" = "Bearer $adminToken" }
$auditLogs = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/audit-logs" -Headers $headers

# Filter by resource type
$userLogs = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/audit-logs?resourceType=user" -Headers $headers

# Get admin's actions
$adminActions = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/audit-logs/admin/admin_001" -Headers $headers

# Get statistics
$stats = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/audit-logs/stats" -Headers $headers
```

---

## Frontend Integration

### Display Audit Trail
```javascript
useEffect(() => {
  const fetchAuditLogs = async () => {
    const response = await fetch('/api/v1/audit-logs?sortOrder=desc', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();
    setAuditLogs(data.data);
  };

  fetchAuditLogs();
}, [adminToken]);
```

### Filter by Action Type
```javascript
const [selectedAction, setSelectedAction] = useState('all');

const fetchFilteredLogs = async () => {
  const url = selectedAction === 'all' 
    ? '/api/v1/audit-logs'
    : `/api/v1/audit-logs?action=${selectedAction}`;
    
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const data = await response.json();
  setAuditLogs(data.data);
};
```

### Display Changes (Before/After)
```javascript
const AuditLogItem = ({ log }) => (
  <div>
    <h3>{log.action}</h3>
    <p>{log.description}</p>
    <p>By: {log.admin.username} ({log.admin.email})</p>
    <p>When: {new Date(log.createdAt).toLocaleString()}</p>
    
    {log.changes && (
      <div>
        <h4>Changes:</h4>
        <pre>Before: {JSON.stringify(log.changes.before, null, 2)}</pre>
        <pre>After: {JSON.stringify(log.changes.after, null, 2)}</pre>
      </div>
    )}
    
    <div>
      <p>IP: {log.metadata.ip}</p>
      <p>Method: {log.metadata.method} {log.metadata.endpoint}</p>
    </div>
  </div>
);
```

### Client-Side Pagination
```javascript
// Since API returns all logs, handle pagination on frontend
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 50;

const paginatedLogs = auditLogs.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
);
```

---

## Tracked Actions

### Admin Authentication
- Admin login
- Admin logout

### User Management
- User updates (balance, status, profile changes)
- User deletions

### Notification Management
- Status updates (read/unread)
- Bulk operations (mark all as read)
- Deletions

### Support Tickets
- Ticket status/priority updates
- Ticket deletions

### Copytrade Purchases
- Purchase updates (status, value changes)
- Purchase deletions

### Stock Management
- Manual stock update triggers

---

## Caching Details

### Cache Behavior
- **TTL**: 60 seconds
- **Storage**: Redis
- **Invalidation**: Automatic on any admin action
- **Cache Key Format**: `audit_logs:{"action":"user_update","resourceType":"user","adminId":null,"sortBy":"createdAt","sortOrder":"desc"}`

### Performance
- **Cached Response**: ~1-5ms
- **Database Response**: ~100-300ms
- **Cache Hit Rate**: ~90% for dashboard views

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

---

## Use Cases

1. **Accountability**: Track which admin performed specific actions
2. **Compliance**: Maintain audit trail for regulatory requirements
3. **Investigation**: Troubleshoot issues by reviewing admin actions
4. **Monitoring**: Dashboard showing recent admin activity
5. **Security**: Detect suspicious or unauthorized actions
