import Notification from '../model/notification.model.js';
import redisClient from '../config/redis.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
import logger from '../utils/logger.js';

const CACHE_KEY = 'notifications';
const CACHE_TTL = 60; // 60 seconds

// Helper function to invalidate cache (Redis-based)
const invalidateCache = async () => {
  if (redisClient.isConnected) {
    try {
      // Delete all cache keys that start with 'notifications:'
      const keys = await redisClient.client.keys(`${CACHE_KEY}:*`);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(key => redisClient.del(key)));
        console.log(`📦 Notification cache invalidated (${keys.length} keys cleared)`);
      }
    } catch (error) {
      console.error('Failed to invalidate notification cache:', error);
    }
  }
};

// Export invalidate function for use by notification helper
export { invalidateCache };

class NotificationController {
  // Get all notifications (admin only) - with Redis caching
  static async getAllNotifications(req, res) {
    try {
      const { 
        status, 
        action, 
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      logger.info('🔔 Fetching all notifications', {
        adminUsername: req.admin?.username,
        filters: { status, action, sortBy, sortOrder }
      });

      const query = {};

      // Filter by status
      if (status && ['unread', 'read'].includes(status)) {
        query.status = status;
      }

      // Filter by action
      if (action) {
        query.action = action;
      }

      // Create cache key based on query parameters
      const cacheKey = `${CACHE_KEY}:${JSON.stringify({ status, action, sortBy, sortOrder })}`;

      // Check Redis cache
      if (redisClient.isConnected) {
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);

            logger.info('📦 Notifications retrieved from cache', {
              adminUsername: req.admin?.username,
              count: parsed.notifications.length,
              source: 'redis'
            });

            // Create audit log for cache hit
            await createAuditLog(req, res, {
              action: 'notifications_view_all',
              resourceType: 'notification',
              description: `Admin ${req.admin?.username || 'unknown'} viewed all notifications (${parsed.notifications.length} notifications) - from cache`
            });

            // Invalidate audit cache
            await invalidateAuditCache();

            return res.set('X-Cache', 'HIT').json({
              success: true,
              message: 'Notifications retrieved successfully (cached)',
              data: parsed.notifications,
              totalCount: parsed.totalCount,
              unreadCount: parsed.unreadCount,
              cached: true,
              source: 'redis'
            });
          }
        } catch (cacheError) {
          logger.warn('⚠️ Redis cache read error', {
            error: cacheError.message,
            adminUsername: req.admin?.username
          });
          console.error('Redis cache read error:', cacheError);
          // Continue to database query if cache fails
        }
      }

      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      // Execute query - fetch ALL notifications
      const [notifications, totalCount, unreadCount] = await Promise.all([
        Notification.find(query)
          .populate('metadata.userId', 'email username firstName lastName')
          .sort(sort)
          .lean(),
        Notification.countDocuments(query),
        Notification.countDocuments({ status: 'unread' })
      ]);

      // Cache the results in Redis
      if (redisClient.isConnected) {
        try {
          const cacheData = {
            notifications,
            totalCount,
            unreadCount
          };
          await redisClient.set(cacheKey, JSON.stringify(cacheData), CACHE_TTL);
        } catch (cacheError) {
          logger.warn('⚠️ Redis cache write error', {
            error: cacheError.message,
            adminUsername: req.admin?.username
          });
          console.error('Redis cache write error:', cacheError);
          // Continue even if caching fails
        }
      }

      // Create audit log for database fetch
      await createAuditLog(req, res, {
        action: 'notifications_view_all',
        resourceType: 'notification',
        description: `Admin ${req.admin?.username || 'unknown'} viewed all notifications (${notifications.length} notifications) - from database`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Notifications retrieved successfully from database', {
        adminUsername: req.admin?.username,
        count: notifications.length,
        totalCount,
        unreadCount,
        source: 'database'
      });

      res.set('X-Cache', 'MISS').json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: notifications,
        totalCount,
        unreadCount,
        cached: false,
        source: 'database'
      });
    } catch (error) {
      logger.error('❌ Error fetching notifications', {
        error: error.message,
        adminId: req.admin?.id
      });
      console.error('Get all notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notifications',
        error: error.message
      });
    }
  }

  // Get notification by ID (admin only)
  static async getNotificationById(req, res) {
    try {
      const { id } = req.params;

      logger.info('🔍 Fetching notification by ID', {
        notificationId: id,
        adminUsername: req.admin?.username
      });

      const notification = await Notification.findById(id)
        .populate('metadata.userId', 'email username firstName lastName');

      if (!notification) {
        logger.warn('⚠️ Notification not found', {
          notificationId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notification_view',
        resourceType: 'notification',
        resourceId: notification._id.toString(),
        resourceName: notification.action,
        description: `Viewed notification: ${notification.action}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Notification retrieved successfully', {
        notificationId: id,
        adminUsername: req.admin?.username,
        action: notification.action,
        status: notification.status
      });

      res.json({
        success: true,
        message: 'Notification retrieved successfully',
        data: notification
      });
    } catch (error) {
      logger.error('❌ Error fetching notification', {
        error: error.message,
        notificationId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Get notification by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification',
        error: error.message
      });
    }
  }

  // Update notification status (admin only)
  static async updateNotificationStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      logger.info('📝 Updating notification status', {
        notificationId: id,
        newStatus: status,
        adminUsername: req.admin?.username
      });

      // Validate status
      if (!status || !['unread', 'read'].includes(status)) {
        logger.warn('⚠️ Invalid status provided', {
          providedStatus: status,
          validStatuses: ['unread', 'read'],
          adminUsername: req.admin?.username
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be "unread" or "read"'
        });
      }

      // Get old status before update
      const oldNotification = await Notification.findById(id);
      if (!oldNotification) {
        logger.warn('⚠️ Notification not found for status update', {
          notificationId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      const oldStatus = oldNotification.status;

      const notification = await Notification.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: true }
      ).populate('metadata.userId', 'email username firstName lastName');

      // Invalidate cache after update
      invalidateCache();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notification_status_updated',
        resourceType: 'notification',
        resourceId: notification._id.toString(),
        resourceName: notification.action,
        changes: {
          before: { status: oldStatus },
          after: { status: notification.status }
        },
        description: `Updated notification status from ${oldStatus} to ${status}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Notification status updated successfully', {
        notificationId: id,
        adminUsername: req.admin?.username,
        oldStatus,
        newStatus: status,
        action: notification.action
      });

      res.json({
        success: true,
        message: 'Notification status updated successfully',
        data: notification
      });
    } catch (error) {
      logger.error('❌ Error updating notification status', {
        error: error.message,
        notificationId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Update notification status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification status',
        error: error.message
      });
    }
  }

  // Mark all as read (admin only)
  static async markAllAsRead(req, res) {
    try {
      logger.info('📖 Marking all notifications as read', {
        adminUsername: req.admin?.username
      });

      const result = await Notification.updateMany(
        { status: 'unread' },
        { status: 'read' }
      );

      // Invalidate cache after bulk update
      invalidateCache();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notifications_marked_all_read',
        resourceType: 'notification',
        description: `Marked ${result.modifiedCount} notifications as read`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ All notifications marked as read successfully', {
        adminUsername: req.admin?.username,
        modifiedCount: result.modifiedCount
      });

      res.json({
        success: true,
        message: 'All notifications marked as read',
        data: {
          modifiedCount: result.modifiedCount
        }
      });
    } catch (error) {
      logger.error('❌ Error marking all notifications as read', {
        error: error.message,
        adminId: req.admin?.id
      });
      console.error('Mark all as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: error.message
      });
    }
  }

  // Delete notification (admin only)
  static async deleteNotification(req, res) {
    try {
      const { id } = req.params;

      logger.info('🗑️ Deleting notification', {
        notificationId: id,
        adminUsername: req.admin?.username
      });

      // Get notification data before deletion for audit
      const notificationToDelete = await Notification.findById(id);

      if (!notificationToDelete) {
        logger.warn('⚠️ Notification not found for deletion', {
          notificationId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      const notification = await Notification.findByIdAndDelete(id);

      // Invalidate cache after delete
      invalidateCache();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notification_deleted',
        resourceType: 'notification',
        resourceId: notification._id.toString(),
        resourceName: notification.action,
        deletedData: notificationToDelete.toObject(),
        description: `Deleted notification: ${notification.action}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Notification deleted successfully', {
        notificationId: id,
        adminUsername: req.admin?.username,
        action: notification.action,
        status: notification.status
      });

      res.json({
        success: true,
        message: 'Notification deleted successfully',
        data: notification
      });
    } catch (error) {
      logger.error('❌ Error deleting notification', {
        error: error.message,
        notificationId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error.message
      });
    }
  }

  // Delete all read notifications (admin only)
  static async deleteAllRead(req, res) {
    try {
      logger.info('🗑️ Deleting all read notifications', {
        adminUsername: req.admin?.username
      });

      const result = await Notification.deleteMany({ status: 'read' });

      // Invalidate cache after bulk delete
      invalidateCache();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notifications_deleted_all_read',
        resourceType: 'notification',
        description: `Deleted ${result.deletedCount} read notifications`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ All read notifications deleted successfully', {
        adminUsername: req.admin?.username,
        deletedCount: result.deletedCount
      });

      res.json({
        success: true,
        message: 'All read notifications deleted',
        data: {
          deletedCount: result.deletedCount
        }
      });
    } catch (error) {
      logger.error('❌ Error deleting all read notifications', {
        error: error.message,
        adminId: req.admin?.id
      });
      console.error('Delete all read notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete read notifications',
        error: error.message
      });
    }
  }

  // Get unread count (admin only)
  static async getUnreadCount(req, res) {
    try {
      logger.info('📊 Fetching unread notification count', {
        adminUsername: req.admin?.username
      });

      const unreadCount = await Notification.countDocuments({ status: 'unread' });

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notifications_unread_count_viewed',
        resourceType: 'notification',
        description: `Admin ${req.admin?.username || 'unknown'} viewed unread notification count (${unreadCount} unread)`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Unread count retrieved successfully', {
        adminUsername: req.admin?.username,
        unreadCount
      });

      res.json({
        success: true,
        message: 'Unread count retrieved successfully',
        data: {
          unreadCount
        }
      });
    } catch (error) {
      logger.error('❌ Error fetching unread count', {
        error: error.message,
        adminId: req.admin?.id
      });
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count',
        error: error.message
      });
    }
  }
}

export default NotificationController;