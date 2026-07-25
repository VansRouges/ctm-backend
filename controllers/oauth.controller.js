import jwt from 'jsonwebtoken';
import User from '../model/user.model.js';
import logger from '../utils/logger.js';
import { createNotification } from '../utils/notificationHelper.js';
import FinancialSummaryService from '../services/financial-summary.service.js';

// Generate JWT token for user with 48 hour expiration
const generateUserToken = (userId) => {
  return jwt.sign(
    { userId, type: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '48h' } // 48 hours as requested
  );
};

// Initiate Google OAuth authentication
export const initiateGoogleAuth = (req, res, next) => {
  logger.info('🚀 Initiating Google OAuth authentication', {
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  // This will redirect to Google OAuth consent screen
  // The actual redirect is handled by passport middleware
  next();
};

// Handle Google OAuth callback
export const handleGoogleCallback = async (req, res) => {
  try {
    if (!req.user) {
      logger.warn('❌ Google OAuth callback without user', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    const user = req.user;
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateUserToken(user._id);

    // Create login notification
    await createNotification({
      action: 'user_login',
      description: `User ${user.email} logged in via Google OAuth`,
      metadata: {
        userId: user._id,
        userEmail: user.email,
        authProvider: 'google',
        loginMethod: 'oauth',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        additionalInfo: {
          loginTime: new Date().toISOString()
        }
      }
    });

    logger.info('✅ Google OAuth login successful', {
      userId: user._id,
      email: user.email,
      authProvider: 'google'
    });

    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}`;
    res.redirect(redirectUrl);

  } catch (error) {
    logger.error('❌ Google OAuth callback error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id
    });

    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
  }
};

// Get current user profile (for authenticated users)
export const getCurrentUser = async (req, res) => {
  try {
    try {
      await FinancialSummaryService.syncUserFinancialMetrics(req.user.userId);
    } catch (syncError) {
      if (syncError.message !== 'USER_NOT_FOUND') {
        logger.warn('⚠️ Financial metrics sync failed on getCurrentUser', {
          userId: req.user.userId,
          error: syncError.message
        });
      }
    }

    const user = await User.findById(req.user.userId)
      .select('-password -googleId')
      .lean();

    if (!user) {
      logger.warn('❌ User not found for token', {
        userId: req.user.userId
      });
      
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('✅ User profile retrieved', {
      userId: user._id,
      email: user.email
    });

    res.json({
      success: true,
      data: {
        user,
        financialSummary: {
          totalInvestment: user.totalInvestment || 0,
          accountBalance: user.accountBalance || 0,
          lockedValue: Number(
            ((user.currentValue || 0) - (user.accountBalance || 0)).toFixed(8)
          ),
          currentValue: user.currentValue || 0,
          lifetimeWithdrawals: user.lifetimeWithdrawals || 0,
          roi: user.roi || 0,
          netGainLoss: Number(
            (
              (user.currentValue || 0) +
              (user.lifetimeWithdrawals || 0) -
              (user.totalInvestment || 0)
            ).toFixed(8)
          )
        }
      }
    });

  } catch (error) {
    logger.error('❌ Get current user error', {
      error: error.message,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile'
    });
  }
};

// Logout user (client-side token removal)
export const logoutUser = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Create logout notification
    await createNotification({
      action: 'user_logout',
      userId: userId,
      metadata: {
        logoutMethod: 'manual',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info('✅ User logged out', {
      userId: userId
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('❌ User logout error', {
      error: error.message,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};