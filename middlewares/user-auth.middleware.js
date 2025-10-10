import jwt from 'jsonwebtoken';
import User from '../model/user.model.js';
import logger from '../utils/logger.js';

// Middleware to authenticate user tokens (not admin)
export const requireUserAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('❌ No authorization header provided', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is for user (not admin)
    if (decoded.type !== 'user') {
      logger.warn('❌ Invalid token type for user endpoint', {
        tokenType: decoded.type,
        path: req.path,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      logger.warn('❌ User not found for valid token', {
        userId: decoded.userId,
        path: req.path
      });
      
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('❌ Inactive user attempted access', {
        userId: user._id,
        email: user.email,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Attach user info to request
    req.user = {
      userId: user._id,
      email: user.email,
      type: 'user'
    };

    logger.info('✅ User authenticated', {
      userId: user._id,
      email: user.email,
      path: req.path,
      method: req.method
    });

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('❌ Invalid JWT token', {
        error: error.message,
        path: req.path,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.warn('❌ Expired JWT token', {
        path: req.path,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    logger.error('❌ User authentication error', {
      error: error.message,
      stack: error.stack,
      path: req.path
    });

    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Optional user authentication (doesn't fail if no token)
export const optionalUserAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type === 'user') {
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = {
          userId: user._id,
          email: user.email,
          type: 'user'
        };
      }
    }

    next();

  } catch (error) {
    // Token invalid or expired, continue without user
    req.user = null;
    next();
  }
};