// controllers/cleanup.controller.js
// Admin endpoints to manage orphaned transactions cleanup
import OrphanedTransactionsCleaner from '../jobs/orphaned-transactions-cleaner.job.js';
import logger from '../utils/logger.js';

// Create a singleton instance
const cleaner = new OrphanedTransactionsCleaner();

class CleanupController {
  /**
   * Manually trigger orphaned transactions cleanup
   */
  static async triggerCleanup(req, res) {
    try {
      logger.info('🔄 Admin triggered orphaned transactions cleanup', {
        adminUsername: req.admin?.username,
        adminId: req.admin?.id
      });

      const stats = await cleaner.triggerManualCleanup();

      res.json({
        success: true,
        message: 'Orphaned transactions cleanup completed',
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
      const status = cleaner.getStatus();

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