# Google OAuth Integration Guide for Next.js Frontend

Complete guide to integrate Google OAuth authentication with your CTM Next.js frontend application.

---

## 🔗 Backend API Endpoints

Your backend is running at: **`http://localhost:5000`** (development)

### Available OAuth Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/oauth/google` | Initiates Google OAuth flow |
| `GET` | `/api/v1/oauth/google/callback` | OAuth callback (handled by backend) |
| `GET` | `/api/v1/oauth/profile` | Get authenticated user profile |
| `POST` | `/api/v1/oauth/logout` | Logout user |

---

## 🚀 Frontend Integration Steps

### Step 1: Create OAuth Login Button

Create a component or button that redirects users to the Google OAuth endpoint:

```tsx
// components/GoogleLoginButton.tsx
'use client';

export default function GoogleLoginButton() {
  const handleGoogleLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = 'http://localhost:5000/api/v1/oauth/google';
  };

  return (
    <button
      onClick={handleGoogleLogin}
      className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      <span className="font-medium text-gray-700">Continue with Google</span>
    </button>
  );
}
```

### Step 2: Create OAuth Callback Page

Create a callback page that handles the redirect from Google OAuth:

```tsx
// app/auth/callback/page.tsx
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      // Handle OAuth error
      console.error('OAuth error:', error);
      
      // Show error message to user
      if (error === 'oauth_failed') {
        alert('Google OAuth authentication failed. Please try again.');
      } else if (error === 'oauth_error') {
        alert('An error occurred during authentication. Please try again.');
      }
      
      // Redirect to login page
      router.push('/login');
      return;
    }

    if (token) {
      // Store token in localStorage
      localStorage.setItem('authToken', token);
      
      // Fetch user profile with the token
      fetchUserProfile(token);
    } else {
      // No token received, redirect to login
      router.push('/login');
    }
  }, [searchParams, router]);

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await fetch('http://localhost:5000/api/v1/oauth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store user data
        localStorage.setItem('user', JSON.stringify(data.user));
        
        console.log('✅ Login successful:', data.user);
        
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        console.error('Failed to fetch user profile');
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
```

### Step 3: Create Auth Helper Functions

Create utility functions for authentication:

```typescript
// lib/auth.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface User {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  profilePicture?: string;
  authProvider: 'manual' | 'google';
  kycStatus: boolean;
  accountStatus: string;
  role: string;
  totalInvestment: number;
  accountBalance: number;
  createdAt: string;
  lastLogin?: string;
}

// Get stored token
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
};

// Get stored user
export const getUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

// Fetch user profile
export const fetchUserProfile = async (): Promise<User | null> => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/oauth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

// Logout user
export const logout = async (): Promise<void> => {
  const token = getAuthToken();
  
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/oauth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }
  
  // Clear local storage
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  
  // Redirect to login
  window.location.href = '/login';
};
```

### Step 4: Create Protected Route Wrapper

Protect routes that require authentication:

```tsx
// components/ProtectedRoute.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, fetchUserProfile } from '@/lib/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        router.push('/login');
        return;
      }

      // Verify token is still valid
      const user = await fetchUserProfile();
      if (!user) {
        router.push('/login');
        return;
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
```

### Step 5: Use in Your Pages

```tsx
// app/dashboard/page.tsx
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute> 
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        {/* Your dashboard content */}
      </div>
    </ProtectedRoute>
  );
}
```

---

## 🔐 Making Authenticated API Requests

Use the token to make authenticated requests to your backend:

```typescript
// Example: Fetch user data
const fetchUserData = async () => {
  const token = getAuthToken();
  
  const response = await fetch('http://localhost:5000/api/v1/oauth/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  const data = await response.json();
  return data;
};

// Example: Submit KYC
const submitKYC = async (kycData: any) => {
  const token = getAuthToken();
  
  const response = await fetch('http://localhost:5000/api/v1/kyc/submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(kycData),
  });
  
  return response.json();
};
```

---

## 📁 Project Structure

```
your-nextjs-app/
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── page.tsx          # OAuth callback handler
│   ├── login/
│   │   └── page.tsx              # Login page with Google button
│   └── dashboard/
│       └── page.tsx              # Protected dashboard
├── components/
│   ├── GoogleLoginButton.tsx    # Google OAuth button
│   └── ProtectedRoute.tsx       # Auth wrapper component
├── lib/
│   └── auth.ts                   # Auth utility functions
└── .env.local                    # Environment variables
```

---

## 🌍 Environment Variables

Create a `.env.local` file in your Next.js project root:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:5000

# For production:
# NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

---

## 🎯 Complete Authentication Flow

1. **User clicks "Continue with Google"** → Redirects to `http://localhost:5000/api/v1/oauth/google`
2. **Backend redirects to Google** → User sees Google OAuth consent screen
3. **User authorizes** → Google redirects back to backend callback
4. **Backend generates JWT token** → Redirects to `http://localhost:3000/auth/callback?token=<JWT_TOKEN>`
5. **Frontend receives token** → Stores in localStorage and fetches user profile
6. **User is authenticated** → Redirected to dashboard

---

## 🔒 Token Information

- **Token Type**: JWT (JSON Web Token)
- **Expiration**: 48 hours
- **Storage**: localStorage (key: `authToken`)
- **Usage**: Include in `Authorization` header as `Bearer <token>`

---

## ✅ User Data Structure

After successful authentication, you'll receive:

```typescript
{
  "_id": "user_mongodb_id",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "profilePicture": "https://...",
  "authProvider": "google",
  "kycStatus": false,
  "accountStatus": "active",
  "role": "user",
  "totalInvestment": 0,
  "accountBalance": 0,
  "createdAt": "2025-10-15T...",
  "lastLogin": "2025-10-15T..."
}
```

---

## 🐛 Error Handling

The backend returns these error scenarios:

| Error | URL Parameter | Description |
|-------|---------------|-------------|
| OAuth Failed | `?error=oauth_failed` | User denied permission or OAuth failed |
| OAuth Error | `?error=oauth_error` | Server-side error during authentication |

Handle these in your callback page to show appropriate messages to users.

---

## 🚀 Production Deployment

### Backend Changes:
Update your `.env.production.local`:
```env
FRONTEND_URL=https://your-frontend-domain.com
GOOGLE_CALLBACK_URL=https://your-backend-domain.com/api/v1/oauth/google/callback
```

### Frontend Changes:
Update your `.env.production`:
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

### Google Console:
Add production callback URL to authorized redirect URIs:
```
https://your-backend-domain.com/api/v1/oauth/google/callback
```

---

## 📚 Additional Features

### Logout Button Component

```tsx
'use client';

import { logout } from '@/lib/auth';

export default function LogoutButton() {
  return (
    <button
      onClick={logout}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
    >
      Logout
    </button>
  );
}
```

### User Profile Display

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getUser, User } from '@/lib/auth';

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      {user.profilePicture && (
        <img
          src={user.profilePicture}
          alt={user.firstName || 'User'}
          className="w-10 h-10 rounded-full"
        />
      )}
      <div>
        <p className="font-medium">{user.firstName} {user.lastName}</p>
        <p className="text-sm text-gray-600">{user.email}</p>
      </div>
    </div>
  );
}
```

---

## 🎉 You're All Set!

Your Next.js frontend is now ready to authenticate users with Google OAuth. Users can sign in with their Google accounts and access protected routes seamlessly.

**Need Help?** Check the browser console for detailed logs during the authentication flow.