// jobs/orphaned-transactions-cleaner.job.js
// Cron job to clean up orphaned transactions (transactions with non-existent users)
import cron from 'node-cron';
import Transaction from '../model/transaction.model.js';
import User from '../model/user.model.js';
import logger from '../utils/logger.js';

class OrphanedTransactionsCleaner {
  constructor() {
    this.cronSchedule = '0 0 * * 0'; // Every Sunday at midnight (00:00) - runs weekly
    this.cronJob = null;
    this.isRunning = false;
    this.lastCleanupTime = null;
    this.cleanupStats = {
      totalRuns: 0,
      totalOrphansFound: 0,
      totalOrphansDeleted: 0,
      lastRunStats: null
    };
  }

  /**
   * Find and delete orphaned transactions
   * @returns {Object} - Cleanup statistics
   */
  async cleanupOrphanedTransactions() {
    if (this.isRunning) {
      logger.warn('🧹 Orphaned transactions cleanup already in progress, skipping...');
      return null;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('🧹 Starting orphaned transactions cleanup', {
        timestamp: new Date().toISOString()
      });

      // Step 1: Get all unique user IDs from transactions
      const allTransactionUserIds = await Transaction.distinct('user');
      
      logger.info(`📊 Found ${allTransactionUserIds.length} unique user IDs in transactions`);

      // Step 2: Check which user IDs don't exist in the User collection
      const existingUserIds = await User.find({
        _id: { $in: allTransactionUserIds }
      }).distinct('_id');

      // Convert to Set for faster lookup
      const existingUserIdSet = new Set(existingUserIds.map(id => id.toString()));

      // Find orphaned user IDs (user IDs that don't exist in User collection)
      const orphanedUserIds = allTransactionUserIds.filter(
        userId => !existingUserIdSet.has(userId.toString())
      );

      logger.info(`🔍 Found ${orphanedUserIds.length} orphaned user IDs`);

      if (orphanedUserIds.length === 0) {
        logger.info('✅ No orphaned transactions found. Database is clean!');
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const stats = {
          orphanedUserIds: 0,
          depositsDeleted: 0,
          withdrawalsDeleted: 0,
          totalDeleted: 0,
          duration: `${duration}s`,
          timestamp: new Date()
        };

        this.updateStats(stats);
        return stats;
      }

      // Step 3: Find all orphaned transactions
      const orphanedTransactions = await Transaction.find({
        user: { $in: orphanedUserIds }
      });

      logger.info(`🗑️ Found ${orphanedTransactions.length} orphaned transactions to delete`, {
        orphanedUserIds: orphanedUserIds.length,
        totalTransactions: orphanedTransactions.length
      });

      // Categorize transactions
      const orphanedDeposits = orphanedTransactions.filter(t => t.isDeposit);
      const orphanedWithdrawals = orphanedTransactions.filter(t => t.isWithdraw);

      logger.info('📋 Orphaned transactions breakdown', {
        deposits: orphanedDeposits.length,
        withdrawals: orphanedWithdrawals.length,
        userIds: orphanedUserIds.map(id => id.toString())
      });

      // Step 4: Delete orphaned transactions
      const deleteResult = await Transaction.deleteMany({
        user: { $in: orphanedUserIds }
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      const stats = {
        orphanedUserIds: orphanedUserIds.length,
        depositsDeleted: orphanedDeposits.length,
        withdrawalsDeleted: orphanedWithdrawals.length,
        totalDeleted: deleteResult.deletedCount,
        duration: `${duration}s`,
        timestamp: new Date(),
        orphanedUserIdsList: orphanedUserIds.map(id => id.toString())
      };

      logger.info('✅ Orphaned transactions cleanup completed', stats);

      this.updateStats(stats);
      return stats;

    } catch (error) {
      logger.error('❌ Orphaned transactions cleanup failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      this.isRunning = false;
      this.lastCleanupTime = new Date();
    }
  }

  /**
   * Update internal statistics
   * @param {Object} runStats - Statistics from the current run
   */
  updateStats(runStats) {
    this.cleanupStats.totalRuns++;
    this.cleanupStats.totalOrphansFound += runStats.orphanedUserIds;
    this.cleanupStats.totalOrphansDeleted += runStats.totalDeleted;
    this.cleanupStats.lastRunStats = runStats;
  }

  /**
   * Start the cron job scheduler
   * Runs every Sunday at midnight (weekly)
   */
  startScheduler() {
    if (this.cronJob) {
      logger.warn('⚠️ Orphaned transactions cleaner cron job is already running');
      return;
    }

    // Cron schedule explanation:
    // '0 0 * * 0' = At 00:00 (midnight) on Sunday
    // Format: second minute hour day-of-month month day-of-week
    // You can customize this. Examples:
    // - '0 0 * * 0' = Every Sunday at midnight
    // - '0 2 * * 0' = Every Sunday at 2:00 AM
    // - '0 0 */7 * *' = Every 7 days at midnight
    
    this.cronJob = cron.schedule(this.cronSchedule, async () => {
      logger.info('⏰ Cron job triggered: Running orphaned transactions cleanup');
      try {
        await this.cleanupOrphanedTransactions();
      } catch (error) {
        logger.error('❌ Cron job error:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York" // Change to your timezone
    });

    logger.info('✅ Orphaned transactions cleaner cron job started', {
      schedule: this.cronSchedule,
      description: 'Runs every Sunday at midnight',
      timezone: 'America/New_York'
    });

    // Optional: Run initial cleanup on startup
    // Uncomment the line below if you want to run cleanup immediately on server start
    // this.cleanupOrphanedTransactions();
  }

  /**
   * Stop the cron job scheduler
   */
  stopScheduler() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('🛑 Orphaned transactions cleaner cron job stopped');
    } else {
      logger.warn('⚠️ No cron job to stop');
    }
  }

  /**
   * Manually trigger cleanup (useful for testing or admin triggers)
   * @returns {Object} - Cleanup statistics
   */
  async triggerManualCleanup() {
    logger.info('🔄 Manual orphaned transactions cleanup triggered');
    return await this.cleanupOrphanedTransactions();
  }

  /**
   * Get current status and statistics
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCleanupTime: this.lastCleanupTime,
      cronSchedule: this.cronSchedule,
      cronScheduleDescription: 'Every Sunday at midnight',
      isSchedulerActive: this.cronJob !== null,
      statistics: this.cleanupStats
    };
  }

  /**
   * Update cron schedule (useful for dynamic scheduling)
   * @param {String} newSchedule - New cron schedule string
   */
  updateSchedule(newSchedule) {
    if (!cron.validate(newSchedule)) {
      throw new Error(`Invalid cron schedule: ${newSchedule}`);
    }

    this.stopScheduler();
    this.cronSchedule = newSchedule;
    this.startScheduler();

    logger.info('✅ Cron schedule updated', {
      newSchedule: this.cronSchedule
    });
  }
}

export default OrphanedTransactionsCleaner;