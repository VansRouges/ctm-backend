// jobs/orphaned-data-cleaner.job.js
// Cron job to clean up orphaned data entries (entries with non-existent users)
// Handles: Transaction, Portfolio, CryptoOption, CopyTradingOption, CopyTradePurchase, UserSupport, KYC
import cron from 'node-cron';
import Transaction from '../model/transaction.model.js';
import Portfolio from '../model/portfolio.model.js';
import CryptoOption from '../model/crypto-option.model.js';
import CopyTradingOption from '../model/copytrading-option.model.js';
import CopyTradePurchase from '../model/copytrade-purchase.model.js';
import UserSupport from '../model/user-support.model.js';
import KYC from '../model/kyc.model.js';
import User from '../model/user.model.js';
import logger from '../utils/logger.js';

class OrphanedDataCleaner {
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
   * Find and delete orphaned data entries across all models
   * @returns {Object} - Cleanup statistics
   */
  async cleanupOrphanedData() {
    if (this.isRunning) {
      logger.warn('🧹 Orphaned data cleanup already in progress, skipping...');
      return null;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('🧹 Starting orphaned data cleanup', {
        timestamp: new Date().toISOString()
      });

      // Step 1: Get all unique user IDs from all models that reference users
      const [
        transactionUserIds,
        portfolioUserIds,
        cryptoOptionUserIds,
        copytradingOptionUserIds,
        copytradePurchaseUserIds,
        userSupportUserIds,
        kycUserIds
      ] = await Promise.all([
        Transaction.distinct('user'),
        Portfolio.distinct('user'),
        CryptoOption.distinct('user'),
        CopyTradingOption.distinct('user'),
        CopyTradePurchase.distinct('user'),
        UserSupport.distinct('user'),
        KYC.distinct('userId') // Note: KYC uses 'userId' instead of 'user'
      ]);

      // Combine all user IDs
      const allUserIds = [
        ...transactionUserIds,
        ...portfolioUserIds,
        ...cryptoOptionUserIds,
        ...copytradingOptionUserIds,
        ...copytradePurchaseUserIds,
        ...userSupportUserIds,
        ...kycUserIds
      ];

      // Remove duplicates
      const uniqueUserIds = [...new Set(allUserIds.map(id => id.toString()))];

      logger.info(`📊 Found ${uniqueUserIds.length} unique user IDs across all models`, {
        transactions: transactionUserIds.length,
        portfolio: portfolioUserIds.length,
        cryptoOption: cryptoOptionUserIds.length,
        copytradingOption: copytradingOptionUserIds.length,
        copytradePurchase: copytradePurchaseUserIds.length,
        userSupport: userSupportUserIds.length,
        kyc: kycUserIds.length
      });

      // Step 2: Check which user IDs don't exist in the User collection
      const existingUserIds = await User.find({
        _id: { $in: uniqueUserIds }
      }).distinct('_id');

      // Convert to Set for faster lookup
      const existingUserIdSet = new Set(existingUserIds.map(id => id.toString()));

      // Find orphaned user IDs (user IDs that don't exist in User collection)
      const orphanedUserIds = uniqueUserIds.filter(
        userId => !existingUserIdSet.has(userId)
      );

      logger.info(`🔍 Found ${orphanedUserIds.length} orphaned user IDs`);

      if (orphanedUserIds.length === 0) {
        logger.info('✅ No orphaned data found. Database is clean!');
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const stats = {
          orphanedUserIds: 0,
          depositsDeleted: 0,
          withdrawalsDeleted: 0,
          transactionsDeleted: 0,
          portfolioDeleted: 0,
          cryptoOptionDeleted: 0,
          copytradingOptionDeleted: 0,
          copytradePurchaseDeleted: 0,
          userSupportDeleted: 0,
          kycDeleted: 0,
          totalDeleted: 0,
          duration: `${duration}s`,
          timestamp: new Date()
        };

        this.updateStats(stats);
        return stats;
      }

      // Step 3: Find orphaned transactions first to categorize them
      const orphanedTransactions = await Transaction.find({
        user: { $in: orphanedUserIds }
      });

      // Categorize transactions
      const orphanedDeposits = orphanedTransactions.filter(t => t.isDeposit);
      const orphanedWithdrawals = orphanedTransactions.filter(t => t.isWithdraw);

      // Step 4: Delete orphaned entries from each model
      const [
        transactionResult,
        portfolioResult,
        cryptoOptionResult,
        copytradingOptionResult,
        copytradePurchaseResult,
        userSupportResult,
        kycResult
      ] = await Promise.all([
        Transaction.deleteMany({ user: { $in: orphanedUserIds } }),
        Portfolio.deleteMany({ user: { $in: orphanedUserIds } }),
        CryptoOption.deleteMany({ user: { $in: orphanedUserIds } }),
        CopyTradingOption.deleteMany({ user: { $in: orphanedUserIds } }),
        CopyTradePurchase.deleteMany({ user: { $in: orphanedUserIds } }),
        UserSupport.deleteMany({ user: { $in: orphanedUserIds } }),
        KYC.deleteMany({ userId: { $in: orphanedUserIds } }) // Note: KYC uses 'userId'
      ]);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      const stats = {
        orphanedUserIds: orphanedUserIds.length,
        depositsDeleted: orphanedDeposits.length,
        withdrawalsDeleted: orphanedWithdrawals.length,
        transactionsDeleted: transactionResult.deletedCount,
        portfolioDeleted: portfolioResult.deletedCount,
        cryptoOptionDeleted: cryptoOptionResult.deletedCount,
        copytradingOptionDeleted: copytradingOptionResult.deletedCount,
        copytradePurchaseDeleted: copytradePurchaseResult.deletedCount,
        userSupportDeleted: userSupportResult.deletedCount,
        kycDeleted: kycResult.deletedCount,
        totalDeleted: 
          transactionResult.deletedCount +
          portfolioResult.deletedCount +
          cryptoOptionResult.deletedCount +
          copytradingOptionResult.deletedCount +
          copytradePurchaseResult.deletedCount +
          userSupportResult.deletedCount +
          kycResult.deletedCount,
        duration: `${duration}s`,
        timestamp: new Date(),
        orphanedUserIdsList: orphanedUserIds
      };

      logger.info('✅ Orphaned data cleanup completed', stats);
      logger.info('📋 Orphaned data breakdown', {
        transactions: {
          deposits: orphanedDeposits.length,
          withdrawals: orphanedWithdrawals.length,
          total: transactionResult.deletedCount
        },
        portfolio: portfolioResult.deletedCount,
        cryptoOption: cryptoOptionResult.deletedCount,
        copytradingOption: copytradingOptionResult.deletedCount,
        copytradePurchase: copytradePurchaseResult.deletedCount,
        userSupport: userSupportResult.deletedCount,
        kyc: kycResult.deletedCount,
        userIds: orphanedUserIds
      });

      this.updateStats(stats);
      return stats;

    } catch (error) {
      logger.error('❌ Orphaned data cleanup failed', {
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
      logger.warn('⚠️ Orphaned data cleaner cron job is already running');
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
      logger.info('⏰ Cron job triggered: Running orphaned data cleanup');
      try {
        await this.cleanupOrphanedData();
      } catch (error) {
        logger.error('❌ Cron job error:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York" // Change to your timezone
    });

    logger.info('✅ Orphaned data cleaner cron job started', {
      schedule: this.cronSchedule,
      description: 'Runs every Sunday at midnight',
      timezone: 'America/New_York'
    });

    // Optional: Run initial cleanup on startup
    // Uncomment the line below if you want to run cleanup immediately on server start
    // this.cleanupOrphanedData();
  }

  /**
   * Stop the cron job scheduler
   */
  stopScheduler() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('🛑 Orphaned data cleaner cron job stopped');
    } else {
      logger.warn('⚠️ No cron job to stop');
    }
  }

  /**
   * Manually trigger cleanup (useful for testing or admin triggers)
   * @returns {Object} - Cleanup statistics
   */
  async triggerManualCleanup() {
    logger.info('🔄 Manual orphaned data cleanup triggered');
    return await this.cleanupOrphanedData();
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

export default OrphanedDataCleaner;

