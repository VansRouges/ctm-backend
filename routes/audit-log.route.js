import express from 'express';
import AuditLogController from '../controllers/audit-log.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All audit log routes require admin authentication

// Get all audit logs (with optional filters)
router.get('/', requireAdminAuth, AuditLogController.getAllAuditLogs);

// Get audit log statistics
router.get('/stats', requireAdminAuth, AuditLogController.getAuditStats);

// Get audit logs by admin ID
router.get('/admin/:adminId', requireAdminAuth, AuditLogController.getAuditLogsByAdmin);

// Get audit log by ID
router.get('/:id', requireAdminAuth, AuditLogController.getAuditLogById);

export default router;