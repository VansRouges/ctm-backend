// jobs/copytrade-trading.job.js
// Cron job to update active copytrade purchases hourly and complete expired trades
import cron from 'node-cron';
import CopytradeTradingService from '../services/copytrade-trading.service.js';
import logger from '../utils/logger.js';

class CopytradeTradingJob {
  constructor() {
    this.cronSchedule = '0 * * * *'; // Every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
    this.cronJob = null;
    this.isRunning = false;
    this.lastRunTime = null;
    this.stats = {
      totalRuns: 0,
      totalTradesUpdated: 0,
      totalTradesCompleted: 0,
      totalFundsReturned: 0,
      lastRunStats: null
    };
  }

  /**
   * Execute the trading process
   * @returns {Object} - Processing statistics
   */
  async execute() {
    if (this.isRunning) {
      logger.warn('⏸️ Copytrade trading job already running, skipping...');
      return null;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('🚀 Starting copytrade trading job', {
        timestamp: new Date().toISOString()
      });

      const result = await CopytradeTradingService.processTrades();

      const duration = Date.now() - startTime;
      this.lastRunTime = new Date();
      this.stats.totalRuns++;
      this.stats.totalTradesUpdated += result.update?.updated || 0;
      this.stats.totalTradesCompleted += result.completion?.completed || 0;
      this.stats.totalFundsReturned += result.completion?.totalReturned || 0;
      this.stats.lastRunStats = result;

      logger.info('✅ Copytrade trading job completed', {
        duration: `${duration}ms`,
        stats: result
      });

      return result;
    } catch (error) {
      logger.error('❌ Copytrade trading job failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the cron scheduler
   */
  startScheduler() {
    if (this.cronJob) {
      logger.warn('⚠️ Copytrade trading job scheduler already started');
      return;
    }

    this.cronJob = cron.schedule(this.cronSchedule, async () => {
      try {
        await this.execute();
      } catch (error) {
        logger.error('❌ Error in copytrade trading cron job', {
          error: error.message
        });
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('✅ Copytrade trading job scheduler started', {
      schedule: this.cronSchedule,
      description: 'Runs every hour to update active trades and complete expired trades'
    });

    // Run immediately on startup (optional - comment out if not desired)
    // this.execute();
  }

  /**
   * Stop the cron scheduler
   */
  stopScheduler() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('⏹️ Copytrade trading job scheduler stopped');
    }
  }

  /**
   * Get job statistics
   * @returns {Object} - Job statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      schedule: this.cronSchedule
    };
  }

  /**
   * Manually trigger the job (for testing/admin use)
   * @returns {Object} - Processing statistics
   */
  async runNow() {
    logger.info('🔧 Manually triggering copytrade trading job');
    return await this.execute();
  }
}

export default CopytradeTradingJob;

