// middlewares/user-or-admin-auth.middleware.js
import jwt from 'jsonwebtoken';
import User from '../model/user.model.js';
import { JWT_SECRET } from '../config/env.js';
import { isTokenBlacklisted } from '../controllers/admin-auth.controller.js';
import logger from '../utils/logger.js';

/**
 * Accept either a valid user JWT or admin JWT.
 * Sets req.user and/or req.admin accordingly.
 */
export const requireUserOrAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const token = authHeader.substring(7);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET || process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Admin token
    if (decoded.isAdmin && decoded.role === 'admin') {
      if (await isTokenBlacklisted(token)) {
        return res.status(401).json({
          success: false,
          message: 'Token has been invalidated. Please login again.'
        });
      }

      req.admin = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
        isAdmin: true
      };
      return next();
    }

    // User token
    if (decoded.type === 'user' && decoded.userId) {
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Account is deactivated' });
      }

      req.user = {
        userId: user._id,
        email: user.email,
        type: 'user'
      };
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Invalid token type'
    });
  } catch (error) {
    logger.error('❌ User/admin auth middleware error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

export default requireUserOrAdminAuth;
