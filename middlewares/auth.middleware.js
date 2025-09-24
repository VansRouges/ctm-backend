import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { isTokenBlacklisted } from '../controllers/admin-auth.controller.js';

/**
 * Admin authentication middleware
 * Validates JWT token from Bearer Authorization header
 * Use this for admin-only endpoints
 */
export const requireAdminAuth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header required'
      });
    }

    // Check if header starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Use: Bearer <token>'
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Check if token is blacklisted (logged out)
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please login again.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is admin
    if (!decoded.isAdmin || decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Add admin info to request object
    req.admin = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      isAdmin: decoded.isAdmin,
      iat: decoded.iat,
      exp: decoded.exp
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Optional admin auth middleware
 * Adds admin info to request if valid token provided, but doesn't block request
 */
export const optionalAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token && !(await isTokenBlacklisted(token))) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          
          if (decoded.isAdmin && decoded.role === 'admin') {
            req.admin = {
              id: decoded.id,
              username: decoded.username,
              email: decoded.email,
              role: decoded.role,
              isAdmin: decoded.isAdmin,
              iat: decoded.iat,
              exp: decoded.exp
            };
          }
        } catch (tokenError) {
          // Invalid token, but we don't block the request
          console.warn('Invalid token in optional auth:', tokenError.message);
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

/**
 * Generate JWT token for admin login
 * Call this function when admin successfully signs in
 */
export const generateAdminToken = (adminData) => {
  const payload = {
    id: adminData.id,
    username: adminData.username,
    email: adminData.email,
    role: 'admin',
    isAdmin: true
  };

  const options = {
    expiresIn: '24h', // Token expires in 24 hours
    issuer: 'CTM-Backend',
    audience: 'CTM-Admin'
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

/**
 * Verify and decode JWT token (utility function)
 */
export const verifyAdminToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw error;
  }
};