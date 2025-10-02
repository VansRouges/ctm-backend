import AuditLog from '../model/audit-log.model.js';

/**
 * Create an audit log entry
 * @param {Object} options - Audit log options
 * @param {Object} options.admin - Admin user info {id, username, email}
 * @param {string} options.action - Action performed
 * @param {Object} options.resource - Resource info {type, id, name}
 * @param {string} options.description - Human-readable description
 * @param {Object} options.changes - Before/after values
 * @param {Object} options.metadata - Additional metadata (IP, user agent, etc.)
 * @returns {Promise<AuditLog>} Created audit log
 */
export const createAuditLog = async (options) => {
  try {
    const {
      admin,
      action,
      resource,
      description,
      changes = {},
      metadata = {}
    } = options;

    // Validate required fields
    if (!admin || !action || !resource || !description) {
      console.error('Missing required fields for audit log');
      return null;
    }

    // Create audit log
    const auditLog = await AuditLog.create({
      admin,
      action,
      resource,
      description,
      changes,
      metadata
    });

    console.log(`📋 Audit log created: ${admin.username} - ${action}`);
    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
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
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
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