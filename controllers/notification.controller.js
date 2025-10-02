import Notification from '../model/notification.model.js';
import redisClient from '../config/redis.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';

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
          console.error('Redis cache write error:', cacheError);
          // Continue even if caching fails
        }
      }

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

      const notification = await Notification.findById(id)
        .populate('metadata.userId', 'email username firstName lastName');

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification retrieved successfully',
        data: notification
      });
    } catch (error) {
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

      // Validate status
      if (!status || !['unread', 'read'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be "unread" or "read"'
        });
      }

      const notification = await Notification.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: true }
      ).populate('metadata.userId', 'email username firstName lastName');

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      // Invalidate cache after update
      invalidateCache();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notification_update',
        resourceType: 'notification',
        resourceId: notification._id.toString(),
        resourceName: notification.action,
        changes: {
          before: { status: id.status },
          after: { status: notification.status }
        },
        description: `Updated notification status to ${status}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'Notification status updated successfully',
        data: notification
      });
    } catch (error) {
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
      const result = await Notification.updateMany(
        { status: 'unread' },
        { status: 'read' }
      );

      // Invalidate cache after bulk update
      invalidateCache();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notification_bulk_update',
        resourceType: 'notification',
        description: `Marked ${result.modifiedCount} notifications as read`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'All notifications marked as read',
        data: {
          modifiedCount: result.modifiedCount
        }
      });
    } catch (error) {
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

      const notification = await Notification.findByIdAndDelete(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      // Invalidate cache after delete
      invalidateCache();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notification_delete',
        resourceType: 'notification',
        resourceId: notification._id.toString(),
        resourceName: notification.action,
        description: `Deleted notification: ${notification.action}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'Notification deleted successfully',
        data: notification
      });
    } catch (error) {
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
      const result = await Notification.deleteMany({ status: 'read' });

      // Invalidate cache after bulk delete
      invalidateCache();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'notification_bulk_delete',
        resourceType: 'notification',
        description: `Deleted ${result.deletedCount} read notifications`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'All read notifications deleted',
        data: {
          deletedCount: result.deletedCount
        }
      });
    } catch (error) {
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
      const unreadCount = await Notification.countDocuments({ status: 'unread' });

      res.json({
        success: true,
        message: 'Unread count retrieved successfully',
        data: {
          unreadCount
        }
      });
    } catch (error) {
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