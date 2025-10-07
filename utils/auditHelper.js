import AuditLog from '../model/audit-log.model.js';

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
      console.error('Missing required fields for audit log:', { action, resourceType, description });
      return null;
    }

    // Get admin info from request
    const admin = getAdminFromRequest(req);
    if (!admin) {
      console.error('No admin info found in request');
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

    console.log(`📋 Audit log created: ${admin.username} - ${action} - ${description}`);
    return auditLog;
  } catch (error) {
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
  if (req.admin) {
    return {
      id: req.admin.id,
      username: req.admin.username,
      email: req.admin.email
    };
  }
  return null;
};

/**
 * Extract metadata from request
 * @param {Object} req - Express request object
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Metadata object
 */
export const getMetadataFromRequest = (req, statusCode = 200) => {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    statusCode,
    method: req.method,
    endpoint: req.originalUrl || req.url
  };
};

export default {
  createAuditLog,
  getAdminFromRequest,
  getMetadataFromRequest
};