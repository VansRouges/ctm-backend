// controllers/cleanup.controller.js
// Admin endpoints to manage orphaned data cleanup
import OrphanedDataCleaner from '../jobs/orphaned-data-cleaner.job.js';
import logger from '../utils/logger.js';

// Create singleton instance
const orphanedDataCleaner = new OrphanedDataCleaner();

class CleanupController {
  /**
   * Manually trigger orphaned data cleanup (Transactions, Portfolio, CryptoOption, etc.)
   */
  static async triggerCleanup(req, res) {
    try {
      logger.info('🔄 Admin triggered orphaned data cleanup', {
        adminUsername: req.admin?.username,
        adminId: req.admin?.id
      });

      const stats = await orphanedDataCleaner.triggerManualCleanup();

      res.json({
        success: true,
        message: 'Orphaned data cleanup completed',
        data: stats
      });
    } catch (error) {
      logger.error('❌ Error triggering cleanup', {
        error: error.message,
        adminId: req.admin?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to trigger cleanup',
        error: error.message
      });
    }
  }

  /**
   * Get cleanup job status and statistics
   */
  static async getStatus(req, res) {
    try {
      const status = orphanedDataCleaner.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('❌ Error getting cleanup status', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get status',
        error: error.message
      });
    }
  }
}

export default CleanupController;