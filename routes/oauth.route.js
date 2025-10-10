import express from 'express';
import passport from '../config/passport.js';
import { 
  initiateGoogleAuth, 
  handleGoogleCallback, 
  getCurrentUser, 
  logoutUser 
} from '../controllers/oauth.controller.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Google OAuth Routes

// Start Google OAuth flow
router.get('/google', 
  initiateGoogleAuth,
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
    session: false 
  }),
  handleGoogleCallback
);

// Protected User Routes

// Get current user profile
router.get('/profile', requireUserAuth, getCurrentUser);

// Logout user
router.post('/logout', requireUserAuth, logoutUser);

// Health check for OAuth service
router.get('/health', (req, res) => {
  logger.info('🔍 OAuth health check', {
    timestamp: new Date().toISOString(),
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'OAuth service is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      googleAuth: '/api/v1/oauth/google',
      googleCallback: '/api/v1/oauth/google/callback',
      userProfile: '/api/v1/oauth/profile',
      logout: '/api/v1/oauth/logout'
    }
  });
});

export default router;