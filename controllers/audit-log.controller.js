import AuditLog from '../model/audit-log.model.js';
import redisClient from '../config/redis.js';

const CACHE_KEY = 'audit_logs';
const CACHE_TTL = 60; // 60 seconds

class AuditLogController {
  // Get all audit logs (admin only) - with Redis caching
  static async getAllAuditLogs(req, res) {
    try {
      const {
        action,
        resourceType,
        adminId,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const query = {};

      // Filter by action
      if (action) {
        query.action = action;
      }

      // Filter by resource type
      if (resourceType) {
        query['resource.type'] = resourceType;
      }

      // Filter by admin ID
      if (adminId) {
        query['admin.id'] = adminId;
      }

      // Create cache key based on query parameters
      const cacheKey = `${CACHE_KEY}:${JSON.stringify({ action, resourceType, adminId, sortBy, sortOrder })}`;

      // Check Redis cache
      if (redisClient.isConnected) {
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            return res.set('X-Cache', 'HIT').json({
              success: true,
              message: 'Audit logs retrieved successfully (cached)',
              data: parsed.auditLogs,
              totalCount: parsed.totalCount,
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

      // Execute query - fetch ALL audit logs
      const [auditLogs, totalCount] = await Promise.all([
        AuditLog.find(query)
          .sort(sort)
          .lean(),
        AuditLog.countDocuments(query)
      ]);

      // Cache the results in Redis
      if (redisClient.isConnected) {
        try {
          const cacheData = {
            auditLogs,
            totalCount
          };
          await redisClient.set(cacheKey, JSON.stringify(cacheData), CACHE_TTL);
        } catch (cacheError) {
          console.error('Redis cache write error:', cacheError);
          // Continue even if caching fails
        }
      }

      res.set('X-Cache', 'MISS').json({
        success: true,
        message: 'Audit logs retrieved successfully',
        data: auditLogs,
        totalCount,
        cached: false,
        source: 'database'
      });
    } catch (error) {
      console.error('Get all audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit logs',
        error: error.message
      });
    }
  }

  // Get audit log by ID (admin only)
  static async getAuditLogById(req, res) {
    try {
      const { id } = req.params;

      const auditLog = await AuditLog.findById(id);

      if (!auditLog) {
        return res.status(404).json({
          success: false,
          message: 'Audit log not found'
        });
      }

      res.json({
        success: true,
        message: 'Audit log retrieved successfully',
        data: auditLog
      });
    } catch (error) {
      console.error('Get audit log by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit log',
        error: error.message
      });
    }
  }

  // Get audit logs by admin (admin only)
  static async getAuditLogsByAdmin(req, res) {
    try {
      const { adminId } = req.params;

      const auditLogs = await AuditLog.find({ 'admin.id': adminId })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        message: 'Admin audit logs retrieved successfully',
        data: auditLogs,
        count: auditLogs.length
      });
    } catch (error) {
      console.error('Get audit logs by admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve admin audit logs',
        error: error.message
      });
    }
  }

  // Get audit log statistics (admin only)
  static async getAuditStats(req, res) {
    try {
      const [
        totalLogs,
        actionCounts,
        resourceCounts,
        recentActivity
      ] = await Promise.all([
        AuditLog.countDocuments(),
        AuditLog.aggregate([
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        AuditLog.aggregate([
          { $group: { _id: '$resource.type', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        AuditLog.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()
      ]);

      res.json({
        success: true,
        message: 'Audit statistics retrieved successfully',
        data: {
          totalLogs,
          topActions: actionCounts,
          resourceBreakdown: resourceCounts,
          recentActivity
        }
      });
    } catch (error) {
      console.error('Get audit stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit statistics',
        error: error.message
      });
    }
  }
}

// Helper function to invalidate audit cache
export const invalidateAuditCache = async () => {
  if (redisClient.isConnected) {
    try {
      // Delete all cache keys that start with 'audit_logs:'
      const keys = await redisClient.client.keys(`${CACHE_KEY}:*`);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(key => redisClient.del(key)));
        console.log(`📋 Audit cache invalidated (${keys.length} keys cleared)`);
      }
    } catch (error) {
      console.error('Failed to invalidate audit cache:', error);
    }
  }
};

export default AuditLogController;