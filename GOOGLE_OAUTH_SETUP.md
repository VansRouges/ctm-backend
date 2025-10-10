# Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth authentication for your CTM Backend application.

## 🔑 Google Console Setup

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" at the top of the page
3. Click "New Project"
4. Enter your project name (e.g., "CTM Backend")
5. Click "Create"

### Step 2: Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google+ API" 
3. Click on it and then click "Enable"
4. Also search for and enable "People API" (recommended for profile data)

### Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" (for public users) and click "Create"
3. Fill in the required information:
   - **App name**: CTM Platform
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Add your domain to "Authorized domains" (e.g., `yourdomain.com`)
5. Click "Save and Continue"
6. In "Scopes", click "Add or Remove Scopes" and add:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
7. Click "Save and Continue"
8. Add test users (your email and any others you want to test with)
9. Click "Save and Continue"

### Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Name it "CTM Backend OAuth"
5. Add authorized redirect URIs:
   - For development: `http://localhost:3000/api/v1/auth/google/callback`
   - For production: `https://yourdomain.com/api/v1/auth/google/callback`
6. Click "Create"
7. **Important**: Copy your Client ID and Client Secret

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3001

# Session Secret (generate a random string)
SESSION_SECRET=your_random_session_secret_here
```

## 📝 Production Environment Variables

For production, update these values:

```env
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/v1/auth/google/callback
FRONTEND_URL=https://yourfrontend.com
```

## 🔗 OAuth Endpoints

Your application now has these endpoints:

### Authentication
- `GET /api/v1/auth/google` - Initiate Google OAuth
- `GET /api/v1/auth/google/callback` - OAuth callback (handled automatically)

### User Management
- `GET /api/v1/auth/profile` - Get user profile (requires authentication)
- `POST /api/v1/auth/logout` - Logout user

## 🌐 Frontend Integration

### Initiate Login
```javascript
// Redirect user to Google OAuth
window.location.href = 'http://localhost:3000/api/v1/auth/google';
```

### Handle Callback
Your frontend should handle the callback at `/auth/callback` with URL parameters:
- `token` - JWT token for authenticated requests
- `user` - User data (JSON encoded)

Example callback handler:
```javascript
// In your frontend route handler (e.g., /auth/callback)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const userData = JSON.parse(decodeURIComponent(urlParams.get('user')));

if (token) {
  // Store token in localStorage or secure cookie
  localStorage.setItem('authToken', token);
  localStorage.setItem('user', JSON.stringify(userData));
  
  // Redirect to dashboard or home page
  window.location.href = '/dashboard';
} else {
  // Handle error
  const error = urlParams.get('error');
  console.error('OAuth error:', error);
}
```

### Make Authenticated Requests
```javascript
// Include token in Authorization header
const token = localStorage.getItem('authToken');

fetch('/api/v1/auth/profile', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

## 🛠️ Installation

Make sure you have installed the required dependencies:

```bash
npm install passport passport-google-oauth20 express-session
```

## 🔒 Security Notes

1. **Keep secrets secure**: Never commit your Google Client Secret to version control
2. **Use HTTPS in production**: OAuth requires HTTPS in production environments
3. **Validate redirect URIs**: Only use trusted domains in your OAuth configuration
4. **Session security**: Use a strong, random session secret
5. **Token expiration**: JWT tokens expire in 7 days by default

## 🧪 Testing

1. Start your backend server
2. Navigate to `http://localhost:3000/api/v1/auth/google`
3. You should be redirected to Google's OAuth consent screen
4. After authorization, you'll be redirected back with a token

## 🐛 Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch"**: Check that your callback URL in Google Console matches exactly
2. **"invalid_client"**: Verify your Client ID and Secret are correct
3. **CORS errors**: Make sure your frontend URL is properly configured
4. **Session issues**: Ensure SESSION_SECRET is set in your environment

### Debug Mode:
Enable debug logging by setting:
```env
DEBUG=passport*
```

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Google Strategy](http://www.passportjs.org/packages/passport-google-oauth20/)
- [Express Session Documentation](https://github.com/expressjs/session)