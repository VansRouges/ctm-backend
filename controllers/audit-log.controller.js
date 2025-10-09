import AuditLog from '../model/audit-log.model.js';
import redisClient from '../config/redis.js';
import logger from '../utils/logger.js';

const CACHE_KEY = 'audit_logs';
const CACHE_TTL = 60; // 60 seconds

class AuditLogController {
  // Get all audit logs (admin only) - with Redis caching
  static async getAllAuditLogs(req, res) {
    try {
      logger.info('📋 Fetching all audit logs', {
        adminId: req.admin?.id,
        adminUsername: req.admin?.username,
        query: req.query,
        endpoint: req.originalUrl
      });

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

      logger.debug('🔍 Checking Redis cache for audit logs', {
        cacheKey,
        redisConnected: redisClient.isConnected
      });

      // Check Redis cache
      if (redisClient.isConnected) {
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            logger.info('✅ Audit logs retrieved from cache', {
              totalCount: parsed.totalCount,
              cacheKey,
              adminUsername: req.admin?.username
            });
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
          logger.error('❌ Redis cache read error', {
            error: cacheError.message,
            cacheKey
          });
          console.error('Redis cache read error:', cacheError);
          // Continue to database query if cache fails
        }
      }

      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      logger.debug('🔍 Querying database for audit logs', {
        query,
        sort,
        adminUsername: req.admin?.username
      });

      // Execute query - fetch ALL audit logs
      const [auditLogs, totalCount] = await Promise.all([
        AuditLog.find(query)
          .sort(sort)
          .lean(),
        AuditLog.countDocuments(query)
      ]);

      logger.info('✅ Audit logs retrieved from database', {
        totalCount,
        resultsCount: auditLogs.length,
        adminUsername: req.admin?.username
      });

      // Cache the results in Redis
      if (redisClient.isConnected) {
        try {
          const cacheData = {
            auditLogs,
            totalCount
          };
          await redisClient.set(cacheKey, JSON.stringify(cacheData), CACHE_TTL);
          logger.debug('✅ Audit logs cached in Redis', {
            cacheKey,
            totalCount,
            ttl: CACHE_TTL
          });
        } catch (cacheError) {
          logger.error('❌ Redis cache write error', {
            error: cacheError.message,
            cacheKey
          });
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
      logger.error('❌ Get all audit logs error', {
        error: error.message,
        stack: error.stack,
        adminId: req.admin?.id,
        query: req.query
      });
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
      
      logger.info('📋 Fetching audit log by ID', {
        auditLogId: id,
        adminId: req.admin?.id,
        adminUsername: req.admin?.username,
        endpoint: req.originalUrl
      });

      const auditLog = await AuditLog.findById(id);

      if (!auditLog) {
        logger.warn('⚠️ Audit log not found', {
          auditLogId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({
          success: false,
          message: 'Audit log not found'
        });
      }

      logger.info('✅ Audit log retrieved successfully', {
        auditLogId: id,
        action: auditLog.action,
        resourceType: auditLog.resource?.type,
        adminUsername: req.admin?.username
      });

      res.json({
        success: true,
        message: 'Audit log retrieved successfully',
        data: auditLog
      });
    } catch (error) {
      logger.error('❌ Get audit log by ID error', {
        error: error.message,
        stack: error.stack,
        auditLogId: req.params.id,
        adminId: req.admin?.id
      });
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
      
      logger.info('📋 Fetching audit logs by admin', {
        targetAdminId: adminId,
        requestAdminId: req.admin?.id,
        requestAdminUsername: req.admin?.username,
        endpoint: req.originalUrl
      });

      const auditLogs = await AuditLog.find({ 'admin.id': adminId })
        .sort({ createdAt: -1 })
        .lean();

      logger.info('✅ Admin audit logs retrieved successfully', {
        targetAdminId: adminId,
        count: auditLogs.length,
        requestAdminUsername: req.admin?.username
      });

      res.json({
        success: true,
        message: 'Admin audit logs retrieved successfully',
        data: auditLogs,
        count: auditLogs.length
      });
    } catch (error) {
      logger.error('❌ Get audit logs by admin error', {
        error: error.message,
        stack: error.stack,
        targetAdminId: req.params.adminId,
        requestAdminId: req.admin?.id
      });
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
      logger.info('📊 Fetching audit statistics', {
        adminId: req.admin?.id,
        adminUsername: req.admin?.username,
        endpoint: req.originalUrl
      });

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

      logger.info('✅ Audit statistics retrieved successfully', {
        totalLogs,
        actionTypesCount: actionCounts.length,
        resourceTypesCount: resourceCounts.length,
        recentActivityCount: recentActivity.length,
        adminUsername: req.admin?.username
      });

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
      logger.error('❌ Get audit stats error', {
        error: error.message,
        stack: error.stack,
        adminId: req.admin?.id
      });
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
      logger.info('🔄 Invalidating audit cache');
      // Delete all cache keys that start with 'audit_logs:'
      const keys = await redisClient.client.keys(`${CACHE_KEY}:*`);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(key => redisClient.del(key)));
        logger.info('✅ Audit cache invalidated successfully', {
          clearedKeys: keys.length,
          keys
        });
        console.log(`📋 Audit cache invalidated (${keys.length} keys cleared)`);
      } else {
        logger.debug('📋 No audit cache keys to invalidate');
      }
    } catch (error) {
      logger.error('❌ Failed to invalidate audit cache', {
        error: error.message,
        stack: error.stack
      });
      console.error('Failed to invalidate audit cache:', error);
    }
  } else {
    logger.warn('⚠️ Redis not connected, cannot invalidate audit cache');
  }
};

export default AuditLogController;