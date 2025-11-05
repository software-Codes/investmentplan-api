# Admin API Documentation

Complete API reference for admin user management operations.

---

## 🔐 Admin Authentication

All admin endpoints require admin authentication token.

```
Authorization: Bearer <admin_token>
```

---

## 👥 User Management

### 1. List All Users

Get paginated list of users with optional filters.

```http
GET /api/v1/admin/users?page=1&size=50&status=active&search=john
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `page` (optional): Page number, default 1
- `size` (optional): Items per page, default 50
- `status` (optional): Filter by status (pending, active, suspended, deactivated)
- `search` (optional): Search by name or email

**Response:**
```json
{
  "success": true,
  "message": "Users fetched",
  "data": {
    "items": [
      {
        "user_id": "uuid",
        "full_name": "John Doe",
        "email": "john@example.com",
        "account_status": "active",
        "email_verified": true,
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "size": 50
  }
}
```

---

### 2. Get User Details

Get detailed information about a specific user.

```http
GET /api/v1/admin/users/:userId
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "User fetched",
  "data": {
    "user_id": "uuid",
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone_number": "+1234567890",
    "account_status": "active",
    "email_verified": true,
    "phone_verified": false,
    "profile_photo_url": "https://...",
    "last_login_at": "2024-01-01T00:00:00.000Z",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 3. Block User (Suspend Account)

Suspend a user account. User cannot login or access any endpoints.

```http
PATCH /api/v1/admin/users/:userId/block
Authorization: Bearer <admin_token>
```

**What happens:**
- Account status changed to `suspended`
- User cannot login
- All API requests return 403 error
- Existing sessions remain but blocked from API access
- Action logged in audit trail

**Response:**
```json
{
  "success": true,
  "message": "User suspended",
  "data": {
    "userId": "uuid",
    "newStatus": "suspended"
  }
}
```

---

### 4. Unblock User (Reactivate Account)

Reactivate a suspended user account.

```http
PATCH /api/v1/admin/users/:userId/unblock
Authorization: Bearer <admin_token>
```

**What happens:**
- Account status changed to `active`
- User can login again
- User can access all endpoints
- Action logged in audit trail

**Response:**
```json
{
  "success": true,
  "message": "User re-activated",
  "data": {
    "userId": "uuid",
    "newStatus": "active"
  }
}
```

---

### 5. Force Logout User

Invalidate all active sessions for a user. User must login again.

```http
POST /api/v1/admin/users/:userId/force-logout
Authorization: Bearer <admin_token>
```

**What happens:**
- All user sessions marked as inactive
- User logged out from all devices
- User must login again to access account
- Action logged in audit trail

**Response:**
```json
{
  "success": true,
  "message": "User Logged out Successfully. Ask them to login Again",
  "data": {
    "userId": "uuid",
    "invalidated": 3
  }
}
```

---

### 6. Delete User

Permanently delete user account and all data, or soft delete.

```http
DELETE /api/v1/admin/users/:userId?soft=false
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `soft` (optional): Set to `true` for soft delete (marks as deactivated), default `false` (hard delete)

**Hard Delete (soft=false):**
- Permanently deletes user and all data
- Cannot be undone
- Removes: profile, sessions, wallets, KYC documents, OTP records

**Soft Delete (soft=true):**
- Marks account as `deactivated`
- User cannot login
- Data preserved for recovery

**Response:**
```json
{
  "success": true,
  "message": "User deleted",
  "data": {
    "userId": "uuid",
    "deleted": true,
    "softDelete": false
  }
}
```

---

## 📊 User Account Statuses

| Status | Description | Can Login | Can Access API |
|--------|-------------|-----------|----------------|
| `pending` | Registration incomplete | ❌ | ❌ |
| `active` | Normal active account | ✅ | ✅ |
| `suspended` | Blocked by admin | ❌ | ❌ |
| `deactivated` | Soft deleted | ❌ | ❌ |

---

## 🔒 User Access Control

### When User is Blocked (Suspended)

**Login Attempt:**
```json
{
  "success": false,
  "message": "Your account has been suspended. Please contact support."
}
```
Status: 403

**API Request:**
```json
{
  "success": false,
  "message": "Your account has been suspended. Please contact support."
}
```
Status: 403

### When User is Deactivated

**Login Attempt:**
```json
{
  "success": false,
  "message": "Your account has been deactivated. Please contact support."
}
```
Status: 403

**API Request:**
```json
{
  "success": false,
  "message": "Your account has been deactivated. Please contact support."
}
```
Status: 403

---

## 🎯 Admin Workflow Examples

### Block Abusive User
```bash
# 1. Block the user
PATCH /api/v1/admin/users/{userId}/block

# 2. Force logout from all devices
POST /api/v1/admin/users/{userId}/force-logout
```

### Temporarily Suspend User
```bash
# 1. Block user
PATCH /api/v1/admin/users/{userId}/block

# 2. Later, unblock when resolved
PATCH /api/v1/admin/users/{userId}/unblock
```

### Permanently Remove User
```bash
# Hard delete (cannot be undone)
DELETE /api/v1/admin/users/{userId}?soft=false
```

### Soft Delete for Recovery
```bash
# Soft delete (can be recovered)
DELETE /api/v1/admin/users/{userId}?soft=true

# Later, reactivate if needed
PATCH /api/v1/admin/users/{userId}/unblock
```

---

## 📝 Postman Setup

### 1. Block User
- Method: `PATCH`
- URL: `http://localhost:3000/api/v1/admin/users/{userId}/block`
- Authorization: Bearer Token (admin token)
- Body: None required

### 2. Unblock User
- Method: `PATCH`
- URL: `http://localhost:3000/api/v1/admin/users/{userId}/unblock`
- Authorization: Bearer Token (admin token)
- Body: None required

### 3. Force Logout
- Method: `POST`
- URL: `http://localhost:3000/api/v1/admin/users/{userId}/force-logout`
- Authorization: Bearer Token (admin token)
- Body: None required

### 4. Delete User
- Method: `DELETE`
- URL: `http://localhost:3000/api/v1/admin/users/{userId}?soft=false`
- Authorization: Bearer Token (admin token)
- Body: None required

---

## 🔍 Frontend Integration

### Block User
```javascript
const blockUser = async (userId, adminToken) => {
  const response = await fetch(`/api/v1/admin/users/${userId}/block`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  return response.json();
};
```

### Unblock User
```javascript
const unblockUser = async (userId, adminToken) => {
  const response = await fetch(`/api/v1/admin/users/${userId}/unblock`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  return response.json();
};
```

### Force Logout
```javascript
const forceLogout = async (userId, adminToken) => {
  const response = await fetch(`/api/v1/admin/users/${userId}/force-logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  return response.json();
};
```

### Delete User
```javascript
const deleteUser = async (userId, adminToken, softDelete = false) => {
  const response = await fetch(
    `/api/v1/admin/users/${userId}?soft=${softDelete}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    }
  );
  return response.json();
};
```

---

## 🎨 React Admin Panel Example

```jsx
function UserManagement({ adminToken }) {
  const [users, setUsers] = useState([]);

  const handleBlock = async (userId) => {
    if (!confirm('Block this user?')) return;
    
    const response = await fetch(`/api/v1/admin/users/${userId}/block`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    if (data.success) {
      alert('User blocked successfully');
      fetchUsers(); // Refresh list
    }
  };

  const handleUnblock = async (userId) => {
    const response = await fetch(`/api/v1/admin/users/${userId}/unblock`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    if (data.success) {
      alert('User unblocked successfully');
      fetchUsers();
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Permanently delete this user? This cannot be undone!')) return;
    
    const response = await fetch(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    if (data.success) {
      alert('User deleted successfully');
      fetchUsers();
    }
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.user_id}>
            <td>{user.full_name}</td>
            <td>{user.email}</td>
            <td>{user.account_status}</td>
            <td>
              {user.account_status === 'active' && (
                <button onClick={() => handleBlock(user.user_id)}>
                  Block
                </button>
              )}
              {user.account_status === 'suspended' && (
                <button onClick={() => handleUnblock(user.user_id)}>
                  Unblock
                </button>
              )}
              <button onClick={() => handleDelete(user.user_id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## ✅ Key Features

- ✅ **One-Click Actions**: No reason required, just click
- ✅ **Instant Effect**: Changes apply immediately
- ✅ **Login Prevention**: Blocked users cannot login
- ✅ **API Blocking**: Blocked users get 403 on all requests
- ✅ **Audit Trail**: All actions logged automatically
- ✅ **Soft Delete Option**: Preserve data for recovery
- ✅ **Force Logout**: Kick users from all devices

---

## 🔐 Security Notes

1. **Admin Only**: All endpoints require admin authentication
2. **Audit Logging**: All actions logged with admin ID and timestamp
3. **Immediate Effect**: Status changes apply to next request
4. **No Bypass**: Blocked users cannot access any endpoint
5. **Session Validation**: Checks account status on every request

---

## 📋 Complete Endpoint Summary

```
GET    /api/v1/admin/users              # List users
GET    /api/v1/admin/users/:userId      # Get user details
PATCH  /api/v1/admin/users/:userId/block    # Block user
PATCH  /api/v1/admin/users/:userId/unblock  # Unblock user
POST   /api/v1/admin/users/:userId/force-logout  # Force logout
DELETE /api/v1/admin/users/:userId      # Delete user
```
