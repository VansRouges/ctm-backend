import express from 'express';
import { signup, login, changePassword, logout } from '../controllers/user-auth.controller.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import arcjetMiddleware from '../middlewares/arcjet.middleware.js';

const router = express.Router();

// Apply rate limiting to all auth routes
router.use(arcjetMiddleware);

// Public routes (no authentication required)
/**
 * @route POST /api/v1/user-auth/signup
 * @desc Register a new user with email and password
 * @access Public
 * @body {string} email - User email address
 * @body {string} password - User password (min 8 chars, uppercase, lowercase, number, special char)
 * @body {string} firstName - User first name
 * @body {string} lastName - User last name
 * @body {string} [username] - Optional username (defaults to email prefix)
 */
router.post('/signup', signup);

/**
 * @route POST /api/v1/user-auth/login
 * @desc Login user with email and password
 * @access Public
 * @body {string} email - User email address
 * @body {string} password - User password
 */
router.post('/login', login);

// Protected routes (authentication required)
/**
 * @route POST /api/v1/user-auth/change-password
 * @desc Change user password
 * @access Private
 * @body {string} currentPassword - Current password
 * @body {string} newPassword - New password (min 8 chars, uppercase, lowercase, number, special char)
 */
router.post('/change-password', requireUserAuth, changePassword);

/**
 * @route POST /api/v1/user-auth/logout
 * @desc Logout user (client should remove token)
 * @access Private
 */
router.post('/logout', requireUserAuth, logout);

export default router;