import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../model/user.model.js';
import logger from '../utils/logger.js';
import { createNotification } from '../utils/notificationHelper.js';

// Generate JWT token for user with 48 hour expiration
const generateUserToken = (userId) => {
  return jwt.sign(
    { userId, type: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '48h' }
  );
};

// Validate password strength
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// User Signup
export const signup = async (req, res) => {
  try {
    const { email, password, firstName, lastName, username } = req.body;

    logger.info('🚀 User signup attempt', {
      email: email?.toLowerCase(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      logger.warn('❌ Signup validation failed - missing required fields', {
        email: email?.toLowerCase(),
        hasPassword: !!password,
        hasFirstName: !!firstName,
        hasLastName: !!lastName
      });

      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, and last name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.warn('❌ Signup validation failed - invalid email format', {
        email: email?.toLowerCase()
      });

      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      logger.warn('❌ Signup validation failed - weak password', {
        email: email?.toLowerCase(),
        errors: passwordValidation.errors
      });

      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: email.toLowerCase() 
    });

    if (existingUser) {
      logger.warn('❌ Signup failed - user already exists', {
        email: email?.toLowerCase(),
        existingUserId: existingUser._id
      });

      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userData = {
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username?.trim() || email.split('@')[0],
      authProvider: 'manual',
      isActive: true,
      lastLogin: new Date()
    };

    const user = new User(userData);
    await user.save();

    // Generate JWT token
    const token = generateUserToken(user._id);

    // Create notifications
    await createNotification({
      action: 'user_created',
      description: `New user ${user.email} created an account via manual signup`,
      metadata: {
        userId: user._id,
        userEmail: user.email,
        authProvider: 'manual',
        registrationMethod: 'manual',
        referenceId: user._id.toString(),
        additionalInfo: {
          registrationTime: new Date().toISOString(),
          ip: req.ip
        }
      }
    });

    await createNotification({
      action: 'user_login',
      description: `User ${user.email} logged in via manual authentication`,
      metadata: {
        userId: user._id,
        userEmail: user.email,
        authProvider: 'manual',
        loginMethod: 'signup',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        additionalInfo: {
          loginTime: new Date().toISOString()
        }
      }
    });

    logger.info('✅ User signup successful', {
      userId: user._id,
      email: user.email,
      authProvider: 'manual'
    });

    // Return user data without password
    const userResponse = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      authProvider: user.authProvider,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: userResponse,
      token
    });

  } catch (error) {
    logger.error('❌ User signup error', {
      error: error.message,
      stack: error.stack,
      email: req.body?.email?.toLowerCase()
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during signup'
    });
  }
};

// User Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    logger.info('🚀 User login attempt', {
      email: email?.toLowerCase(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Validate required fields
    if (!email || !password) {
      logger.warn('❌ Login validation failed - missing credentials', {
        email: email?.toLowerCase(),
        hasPassword: !!password
      });

      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user and include password for verification
    const user = await User.findOne({ 
      email: email.toLowerCase() 
    }).select('+password');

    if (!user) {
      logger.warn('❌ Login failed - user not found', {
        email: email?.toLowerCase()
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('❌ Login failed - user account inactive', {
        email: email?.toLowerCase(),
        userId: user._id
      });

      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact support.'
      });
    }

    // For OAuth users without password
    if (!user.password && user.authProvider !== 'manual') {
      logger.warn('❌ Login failed - OAuth user attempting manual login', {
        email: email?.toLowerCase(),
        userId: user._id,
        authProvider: user.authProvider
      });

      return res.status(401).json({
        success: false,
        message: 'Please use Google login for this account'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn('❌ Login failed - invalid password', {
        email: email?.toLowerCase(),
        userId: user._id
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateUserToken(user._id);

    // Create login notification
    await createNotification({
      action: 'user_login',
      description: `User ${user.email} logged in via manual authentication`,
      metadata: {
        userId: user._id,
        userEmail: user.email,
        authProvider: 'manual',
        loginMethod: 'login',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        additionalInfo: {
          loginTime: new Date().toISOString()
        }
      }
    });

    logger.info('✅ User login successful', {
      userId: user._id,
      email: user.email,
      authProvider: user.authProvider
    });

    // Return user data without password
    const userResponse = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      authProvider: user.authProvider,
      isActive: user.isActive,
      lastLogin: user.lastLogin
    };

    res.json({
      success: true,
      message: 'Login successful',
      user: userResponse,
      token
    });

  } catch (error) {
    logger.error('❌ User login error', {
      error: error.message,
      stack: error.stack,
      email: req.body?.email?.toLowerCase()
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

// Change Password (for authenticated users)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    logger.info('🔒 Password change attempt', {
      userId,
      ip: req.ip
    });

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'New password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    // Find user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      logger.warn('❌ Password change failed - invalid current password', {
        userId
      });

      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    logger.info('✅ Password changed successfully', {
      userId,
      email: user.email
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('❌ Password change error', {
      error: error.message,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during password change'
    });
  }
};

// Logout (invalidate token on client side)
export const logout = async (req, res) => {
  try {
    const userId = req.user.userId;

    logger.info('👋 User logout', {
      userId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('❌ Logout error', {
      error: error.message,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};