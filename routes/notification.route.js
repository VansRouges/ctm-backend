import express from 'express';
import NotificationController from '../controllers/notification.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const notificationRouter = express.Router();

// All notification routes require admin authentication

// GET /api/v1/notifications - Get all notifications (with filters and pagination)
notificationRouter.get('/', requireAdminAuth, NotificationController.getAllNotifications);

// GET /api/v1/notifications/unread-count - Get unread count
notificationRouter.get('/unread-count', requireAdminAuth, NotificationController.getUnreadCount);

// PUT /api/v1/notifications/mark-all-read - Mark all as read
notificationRouter.put('/mark-all-read', requireAdminAuth, NotificationController.markAllAsRead);

// DELETE /api/v1/notifications/delete-all-read - Delete all read notifications
notificationRouter.delete('/delete-all-read', requireAdminAuth, NotificationController.deleteAllRead);

// GET /api/v1/notifications/:id - Get notification by ID
notificationRouter.get('/:id', requireAdminAuth, NotificationController.getNotificationById);

// PUT /api/v1/notifications/:id/status - Update notification status
notificationRouter.put('/:id/status', requireAdminAuth, NotificationController.updateNotificationStatus);

// DELETE /api/v1/notifications/:id - Delete notification
notificationRouter.delete('/:id', requireAdminAuth, NotificationController.deleteNotification);

export default notificationRouter;