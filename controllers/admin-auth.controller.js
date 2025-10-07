import bcrypt from 'bcryptjs';
import { generateAdminToken } from '../middlewares/auth.middleware.js';
import redisClient from '../config/redis.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';

// Helper function to add token to blacklist using Redis
const blacklistToken = async (token) => {
  if (token) {
    // Store just the token part (remove 'Bearer ' if present)
    const cleanToken = token.replace('Bearer ', '');
    // Set token to expire in 24 hours (same as JWT expiration)
    await redisClient.blacklistToken(cleanToken, 24 * 60 * 60);
  }
};

// Helper function to check if token is blacklisted using Redis
export const isTokenBlacklisted = async (token) => {
  if (!token) return false;
  const cleanToken = token.replace('Bearer ', '');
  return await redisClient.isTokenBlacklisted(cleanToken);
};

class AdminAuthController {
  // Admin login endpoint
  static async adminLogin(req, res) {
    try {
      const { username, password } = req.body;

      // Validate required fields
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }

      // Hardcoded admin credentials (you can move this to database later)
      const ADMIN_CREDENTIALS = {
        username: 'admin',
        password: '$2b$12$SwtbnfAzFSP.AkXbDrJLH.KHC6tmYdwjYZOOxlnsHcGYV6.sdHW16', // bcrypt hash of 'admin123'
        email: 'admin@ctm.com',
        id: 'admin_001'
      };

      // Check username
      if (username !== ADMIN_CREDENTIALS.username) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, ADMIN_CREDENTIALS.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate JWT token
      const token = generateAdminToken({
        id: ADMIN_CREDENTIALS.id,
        username: ADMIN_CREDENTIALS.username,
        email: ADMIN_CREDENTIALS.email
      });

      // Set cookie (optional, for browser clients)
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Set admin info in request for audit logging
      req.admin = {
        id: ADMIN_CREDENTIALS.id,
        username: ADMIN_CREDENTIALS.username,
        email: ADMIN_CREDENTIALS.email
      };

      // Create audit log for admin login
      await createAuditLog(req, res, {
        action: 'admin_login',
        resourceType: 'auth',
        description: `Admin ${ADMIN_CREDENTIALS.username} logged in successfully`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          admin: {
            id: ADMIN_CREDENTIALS.id,
            username: ADMIN_CREDENTIALS.username,
            email: ADMIN_CREDENTIALS.email,
            role: 'admin'
          },
          expiresIn: '24h'
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }

  // Admin logout endpoint
  static async adminLogout(req, res) {
    try {
      // Get token from Authorization header or cookie
      const authHeader = req.headers.authorization;
      const cookieToken = req.cookies?.admin_token;
      
      let token = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      } else if (cookieToken) {
        token = cookieToken;
      }

      // Add token to blacklist if present
      if (token) {
        await blacklistToken(token);
      }

      // Clear cookie
      res.clearCookie('admin_token');

      // Create audit log for admin logout
      if (req.admin) {
        await createAuditLog(req, res, {
          action: 'admin_logout',
          resourceType: 'admin',
          description: `Admin ${req.admin.username} logged out`
        });

        // Invalidate audit cache
        await invalidateAuditCache();
      }

      res.json({
        success: true,
        message: 'Logout successful',
        data: {
          tokenBlacklisted: !!token
        }
      });
    } catch (error) {
      console.error('Admin logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: error.message
      });
    }
  }

  // Verify admin session endpoint
  static async verifyAdminSession(req, res) {
    try {
      // If middleware passed, admin is authenticated
      res.json({
        success: true,
        message: 'Session valid',
        data: {
          admin: req.admin
        }
      });
    } catch (error) {
      console.error('Session verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Session verification failed',
        error: error.message
      });
    }
  }

  // Generate password hash utility (for creating admin passwords)
  static async generatePasswordHash(req, res) {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required'
        });
      }

      const hash = await bcrypt.hash(password, 12);
      
      res.json({
        success: true,
        data: {
          password,
          hash
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Hash generation failed',
        error: error.message
      });
    }
  }

  // Redis status endpoint (admin only)
  static async getRedisStatus(req, res) {
    try {
      const status = redisClient.getConnectionStatus();
      
      // Test Redis connectivity
      let testResult = null;
      if (status.isConnected) {
        const testKey = 'test_connection';
        const testValue = Date.now().toString();
        await redisClient.set(testKey, testValue, 60); // 1 minute expiration
        const retrievedValue = await redisClient.get(testKey);
        testResult = {
          success: retrievedValue === testValue,
          testKey,
          sentValue: testValue,
          retrievedValue
        };
      }

      res.json({
        success: true,
        data: {
          redis: {
            ...status,
            test: testResult
          }
        }
      });
    } catch (error) {
      console.error('Redis status check error:', error);
      res.status(500).json({
        success: false,
        message: 'Redis status check failed',
        error: error.message
      });
    }
  }
}

export default AdminAuthController;