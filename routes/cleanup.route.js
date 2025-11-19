// routes/cleanup.route.js
import express from 'express';
import CleanupController from '../controllers/cleanup.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const cleanupRouter = express.Router();

// POST /api/v1/cleanup/trigger - Manually trigger orphaned data cleanup (admin only)
cleanupRouter.post('/trigger', requireAdminAuth, CleanupController.triggerCleanup);

// GET /api/v1/cleanup/status - Get orphaned data cleanup status (admin only)
cleanupRouter.get('/status', requireAdminAuth, CleanupController.getStatus);

export default cleanupRouter;