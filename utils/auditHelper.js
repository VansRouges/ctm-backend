import AuditLog from '../model/audit-log.model.js';
import logger from './logger.js';

/**
 * Create an audit log entry
 * @param {Object} req - Express request object (with admin info)
 * @param {Object} res - Express response object
 * @param {Object} options - Audit log options
 * @param {string} options.action - Action performed
 * @param {string} options.resourceType - Resource type
 * @param {string} options.resourceId - Resource ID (optional)
 * @param {string} options.resourceName - Resource name (optional)
 * @param {string} options.description - Human-readable description
 * @param {Object} options.changes - Before/after values (optional)
 * @returns {Promise<AuditLog>} Created audit log
 */
export const createAuditLog = async (req, res, options) => {
  try {
    // logger.info('📋 Creating audit log', {
    //   action: options?.action,
    //   resourceType: options?.resourceType,
    //   endpoint: req.originalUrl || req.url,
    //   method: req.method,
    //   adminId: req.admin?.id,
    //   adminUsername: req.admin?.username
    // });

    const {
      action,
      resourceType,
      resourceId,
      resourceName,
      description,
      changes = {}
    } = options;

    // Validate required fields
    if (!action || !resourceType || !description) {
      logger.error('❌ Missing required fields for audit log', { 
        action, 
        resourceType, 
        description,
        endpoint: req.originalUrl || req.url
      });
      return null;
    }

    // Get admin info from request
    const admin = getAdminFromRequest(req);
    if (!admin) {
      // For logout scenarios, try to create a basic admin entry from IP and metadata
      if (action === 'admin_logout_anonymous') {
        logger.warn('⚠️ Creating anonymous logout audit log');
        const anonymousAdmin = {
          id: 'anonymous',
          username: 'unknown_admin',
          email: 'unknown@ctm.com'
        };
        
        // Get metadata from request
        const metadata = getMetadataFromRequest(req, res.statusCode || 200);

        // Build resource object
        const resource = {
          type: resourceType,
          ...(resourceId && { id: resourceId }),
          ...(resourceName && { name: resourceName })
        };

        // Create audit log with anonymous admin
        const auditLog = await AuditLog.create({
          admin: anonymousAdmin,
          action,
          resource,
          description,
          ...(Object.keys(changes).length > 0 && { changes }),
          metadata
        });

        logger.info('✅ Anonymous audit log created', {
          auditLogId: auditLog._id,
          action,
          ipAddress: metadata.ipAddress
        });

        console.log(`📋 Audit log created: ${anonymousAdmin.username} - ${action} - ${description}`);
        return auditLog;
      }

      logger.error('❌ No admin info found in request', {
        endpoint: req.originalUrl || req.url,
        hasAdmin: !!req.admin,
        adminKeys: req.admin ? Object.keys(req.admin) : []
      });
      return null;
    }

    // Get metadata from request
    const metadata = getMetadataFromRequest(req, res.statusCode || 200);

    // Build resource object
    const resource = {
      type: resourceType,
      ...(resourceId && { id: resourceId }),
      ...(resourceName && { name: resourceName })
    };

    // Create audit log
    const auditLog = await AuditLog.create({
      admin,
      action,
      resource,
      description,
      ...(Object.keys(changes).length > 0 && { changes }),
      metadata
    });

    // logger.info('✅ Audit log created successfully', {
    //   auditLogId: auditLog._id,
    //   admin: admin.username,
    //   action,
    //   resourceType,
    //   description,
    //   endpoint: req.originalUrl || req.url
    // });

    console.log(`📋 Audit log created: ${admin.username} - ${action} - ${description}`);
    return auditLog;
  } catch (error) {
    logger.error('❌ Failed to create audit log', {
      error: error.message,
      stack: error.stack,
      endpoint: req.originalUrl || req.url,
      adminId: req.admin?.id,
      options
    });
    console.error('Failed to create audit log:', error);
    console.error('Request admin:', req.admin);
    console.error('Options:', options);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
};

/**
 * Extract admin info from request
 * @param {Object} req - Express request object
 * @returns {Object} Admin info {id, username, email}
 */
export const getAdminFromRequest = (req) => {
  // logger.debug('🔍 Extracting admin from request', {
  //   endpoint: req.originalUrl || req.url,
  //   hasAdmin: !!req.admin,
  //   adminId: req.admin?.id,
  //   adminUsername: req.admin?.username
  // });

  if (req.admin) {
    const adminInfo = {
      id: req.admin.id,
      username: req.admin.username,
      email: req.admin.email
    };
    
    // logger.debug('✅ Admin extracted successfully', {
    //   adminInfo,
    //   endpoint: req.originalUrl || req.url
    // });
    
    return adminInfo;
  }
  
  logger.warn('⚠️ No admin found in request', {
    endpoint: req.originalUrl || req.url,
    reqKeys: Object.keys(req)
  });
  
  return null;
};

/**
 * Extract metadata from request
 * @param {Object} req - Express request object
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Metadata object
 */
export const getMetadataFromRequest = (req, statusCode = 200) => {
  const metadata = {
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    statusCode,
    method: req.method,
    endpoint: req.originalUrl || req.url
  };

  // logger.debug('📊 Metadata extracted from request', {
  //   metadata,
  //   endpoint: req.originalUrl || req.url
  // });

  return metadata;
};

export default {
  createAuditLog,
  getAdminFromRequest,
  getMetadataFromRequest
};