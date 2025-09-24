import express from 'express';
import AdminAuthController from '../controllers/admin-auth.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/login', AdminAuthController.adminLogin);
router.post('/logout', AdminAuthController.adminLogout);

// Protected routes (require admin authentication)
router.get('/verify', requireAdminAuth, AdminAuthController.verifyAdminSession);

// Utility routes (development/admin use)
router.post('/generate-hash', AdminAuthController.generatePasswordHash);
router.get('/redis-status', requireAdminAuth, AdminAuthController.getRedisStatus);

export default router;