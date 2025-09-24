import express from 'express';
import AdminEmailController from '../controllers/admin-email.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const adminEmailRouter = express.Router();

// GET /api/admin-emails - Get all admin emails (admin only)
adminEmailRouter.get('/', requireAdminAuth, AdminEmailController.getAllAdminEmails);

// POST /api/admin-emails - Create new admin email (admin only)
adminEmailRouter.post('/', requireAdminAuth, AdminEmailController.createAdminEmail);

// GET /api/admin-emails/:id - Get admin email by ID (admin only)
adminEmailRouter.get('/:id', requireAdminAuth, AdminEmailController.getAdminEmailById);

// PUT /api/admin-emails/:id - Update admin email (admin only)
adminEmailRouter.put('/:id', requireAdminAuth, AdminEmailController.updateAdminEmail);

// DELETE /api/admin-emails/:id - Delete admin email (admin only)
adminEmailRouter.delete('/:id', requireAdminAuth, AdminEmailController.deleteAdminEmail);

// GET /api/admin-emails/email/:email_id - Get admin email by email_id (admin only)
adminEmailRouter.get('/email/:email_id', requireAdminAuth, AdminEmailController.getAdminEmailByEmailId);

// GET /api/admin-emails/status/:status - Get admin emails by status (admin only)
adminEmailRouter.get('/status/:status', requireAdminAuth, AdminEmailController.getAdminEmailsByStatus);

export default adminEmailRouter;