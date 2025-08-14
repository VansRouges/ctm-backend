import express from 'express';
import AdminEmailController from '../controllers/admin-email.controller.js';

const adminEmailRouter = express.Router();

// GET /api/admin-emails - Get all admin emails
adminEmailRouter.get('/', AdminEmailController.getAllAdminEmails);

// POST /api/admin-emails - Create new admin email
adminEmailRouter.post('/', AdminEmailController.createAdminEmail);

// GET /api/admin-emails/:id - Get admin email by ID
adminEmailRouter.get('/:id', AdminEmailController.getAdminEmailById);

// PUT /api/admin-emails/:id - Update admin email
adminEmailRouter.put('/:id', AdminEmailController.updateAdminEmail);

// DELETE /api/admin-emails/:id - Delete admin email
adminEmailRouter.delete('/:id', AdminEmailController.deleteAdminEmail);

// GET /api/admin-emails/email/:email_id - Get admin email by email_id
adminEmailRouter.get('/email/:email_id', AdminEmailController.getAdminEmailByEmailId);

// GET /api/admin-emails/status/:status - Get admin emails by status
adminEmailRouter.get('/status/:status', AdminEmailController.getAdminEmailsByStatus);

export default adminEmailRouter;