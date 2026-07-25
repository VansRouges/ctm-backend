// services/copytrade-trading.service.js
// Service for managing active copytrade purchases - hourly updates and completion
import mongoose from 'mongoose';
import CopytradePurchase from '../model/copytrade-purchase.model.js';
import User from '../model/user.model.js';
import PortfolioService from './portfolio.service.js';
import BalanceService from './balance.service.js';
import logger from '../utils/logger.js';
import { notifyCopytradeCompleted } from '../utils/emailService.js';

class CopytradeTradingService {
  /**
   * Calculate daily profit/loss change based on risk level and progress.
   * Sized so values trend toward target ROI over trade_duration days.
   * @param {Object} purchase - CopytradePurchase document
   * @returns {Number} - Daily change percentage
   */
  static calculateDailyChange(purchase) {
    const { trade_risk, trade_roi_min, trade_roi_max, trade_start_date, trade_end_date, trade_duration } = purchase;
    
    const now = new Date();
    const totalDuration = trade_end_date - trade_start_date;
    const elapsed = now - trade_start_date;
    const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1);

    let volatility;
    switch (trade_risk) {
      case 'low':
        volatility = 0.8;
        break;
      case 'medium':
        volatility = 1.5;
        break;
      case 'high':
        volatility = 2.5;
        break;
      default:
        volatility = 1.2;
    }

    const targetROI = trade_risk === 'medium' ? trade_roi_max : trade_roi_min;
    const days = Math.max(trade_duration || 1, 1);
    const targetDailyChange = (targetROI / 100) / days;

    const randomChange = (Math.random() * 2 - 1) * volatility;
    const trendComponent = targetDailyChange * 100 * (0.4 + progress * 0.6);
    
    const dailyChangePercent = randomChange + trendComponent;
    
    // Clamp to reasonable daily range (-3% to +5%)
    return Math.max(-3, Math.min(5, dailyChangePercent));
  }

  /** @deprecated Use calculateDailyChange */
  static calculateHourlyChange(purchase) {
    return this.calculateDailyChange(purchase);
  }

  /**
   * Update active trades with daily profit/loss changes
   * @returns {Object} - Update statistics
   */
  static async updateActiveTrades() {
    try {
      const now = new Date();
      
      // Find all active trades not yet expired
      const activeTrades = await CopytradePurchase.find({
        trade_status: 'active',
        trade_start_date: { $exists: true, $lte: now },
        trade_end_date: { $exists: true, $gt: now }
      });

      logger.info('📈 Updating active copytrade purchases (daily)', {
        activeTradesCount: activeTrades.length,
        timestamp: now.toISOString()
      });

      let updatedCount = 0;
      let errors = 0;

      for (const purchase of activeTrades) {
        try {
          const previousValue = purchase.trade_current_value;
          const dailyChangePercent = this.calculateDailyChange(purchase);
          
          const changeAmount = purchase.trade_current_value * (dailyChangePercent / 100);
          const newCurrentValue = Number(Math.max(0, purchase.trade_current_value + changeAmount).toFixed(8));
          
          purchase.trade_current_value = newCurrentValue;
          await purchase.save();

          updatedCount++;

          logger.debug('📊 Updated copytrade purchase (daily)', {
            purchaseId: purchase._id,
            userId: purchase.user,
            previousValue,
            newValue: newCurrentValue,
            dailyChange: dailyChangePercent.toFixed(4) + '%'
          });
        } catch (error) {
          logger.error('❌ Error updating copytrade purchase', {
            purchaseId: purchase._id,
            error: error.message
          });
          errors++;
        }
      }

      logger.info('✅ Completed daily copytrade updates', {
        totalTrades: activeTrades.length,
        updated: updatedCount,
        errors
      });

      return {
        totalTrades: activeTrades.length,
        updated: updatedCount,
        errors
      };
    } catch (error) {
      logger.error('❌ Error updating active trades', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Complete trades that have reached their end date
   * Calculate final ROI based on risk level and add to user balance
   * @returns {Object} - Completion statistics
   */
  static async completeExpiredTrades() {
    try {
      const now = new Date();
      
      // Find trades that have reached their end date
      const expiredTrades = await CopytradePurchase.find({
        trade_status: 'active',
        trade_end_date: { $exists: true, $lte: now }
      });

      logger.info('🏁 Completing expired copytrade purchases', {
        expiredTradesCount: expiredTrades.length,
        timestamp: now.toISOString()
      });

      if (expiredTrades.length === 0) {
        return {
          completed: 0,
          errors: 0,
          totalReturned: 0
        };
      }

      let completedCount = 0;
      let errors = 0;
      let totalReturned = 0;

      for (const purchase of expiredTrades) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          const userId = purchase.user;
          const { trade_risk, trade_roi_min, trade_roi_max, initial_investment } = purchase;

          // Calculate final ROI based on risk level
          let finalROIPercent;
          switch (trade_risk) {
            case 'low':
              finalROIPercent = trade_roi_min;
              break;
            case 'medium':
              finalROIPercent = trade_roi_max;
              break;
            case 'high':
              finalROIPercent = trade_roi_min;
              break;
            default:
              finalROIPercent = trade_roi_min;
          }

          // Calculate final value: initial_investment + (initial_investment * ROI%)
          const finalValue = Number((initial_investment * (1 + finalROIPercent / 100)).toFixed(8));

          // Update purchase with final value and status
          purchase.trade_current_value = finalValue;
          purchase.trade_status = 'completed';
          purchase.trade_profit_loss = Number((finalValue - initial_investment).toFixed(8));
          purchase.isProfit = purchase.trade_profit_loss >= 0;
          await purchase.save({ session });

          // Settle final value as USDT without inflating totalInvestment
          await BalanceService.settleTradeReturn(userId, finalValue, session);

          // Recalculate accountBalance from portfolio (to sync with portfolio value)
          await PortfolioService.recalculateAccountBalance(userId, session);

          await session.commitTransaction();

          completedCount++;
          totalReturned += finalValue;

          logger.info('✅ Completed copytrade purchase', {
            purchaseId: purchase._id,
            userId,
            initialInvestment: initial_investment,
            finalValue,
            roiPercent: finalROIPercent,
            profitLoss: purchase.trade_profit_loss,
            risk: trade_risk
          });

          notifyCopytradeCompleted(userId, purchase, {
            finalValue,
            roiPercent: finalROIPercent
          }).catch(() => {});
        } catch (error) {
          await session.abortTransaction();
          logger.error('❌ Error completing copytrade purchase', {
            purchaseId: purchase._id,
            error: error.message,
            stack: error.stack
          });
          errors++;
        } finally {
          await session.endSession();
        }
      }

      logger.info('🏁 Completed expired copytrade purchases', {
        totalExpired: expiredTrades.length,
        completed: completedCount,
        errors,
        totalReturned
      });

      return {
        completed: completedCount,
        errors,
        totalReturned
      };
    } catch (error) {
      logger.error('❌ Error completing expired trades', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Manually complete a single copytrade purchase (admin action)
   * Calculates final ROI based on risk level and adds to user balance
   * Updates trade_end_date to current date/time
   * @param {String} purchaseId - CopytradePurchase ID
   * @param {Object} session - MongoDB session for transaction (optional)
   * @returns {Object} - Completion result
   */
  static async completeSingleTrade(purchaseId, session = null) {
    const shouldCreateSession = !session;
    if (shouldCreateSession) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // Find the purchase
      const purchase = await CopytradePurchase.findById(purchaseId).session(session);
      
      if (!purchase) {
        const error = new Error('PURCHASE_NOT_FOUND');
        error.data = { purchaseId };
        throw error;
      }

      // Validate purchase is active
      if (purchase.trade_status !== 'active') {
        const error = new Error('PURCHASE_NOT_ACTIVE');
        error.data = { 
          purchaseId, 
          currentStatus: purchase.trade_status 
        };
        throw error;
      }

      const userId = purchase.user;
      const { trade_risk, trade_roi_min, trade_roi_max, initial_investment } = purchase;

      // Calculate final ROI based on risk level
      let finalROIPercent;
      switch (trade_risk) {
        case 'low':
          finalROIPercent = trade_roi_min;
          break;
        case 'medium':
          finalROIPercent = trade_roi_max;
          break;
        case 'high':
          finalROIPercent = trade_roi_min;
          break;
        default:
          finalROIPercent = trade_roi_min;
      }

      // Calculate final value: initial_investment + (initial_investment * ROI%)
      const finalValue = Number((initial_investment * (1 + finalROIPercent / 100)).toFixed(8));

      // Update purchase with final value, status, and end date
      const now = new Date();
      purchase.trade_current_value = finalValue;
      purchase.trade_status = 'completed';
      purchase.trade_profit_loss = Number((finalValue - initial_investment).toFixed(8));
      purchase.isProfit = purchase.trade_profit_loss >= 0;
      purchase.trade_end_date = now; // Update end date to current time
      await purchase.save({ session });

      // Settle final value as USDT without inflating totalInvestment
      await BalanceService.settleTradeReturn(userId, finalValue, session);

      // Recalculate accountBalance from portfolio (to sync with portfolio value)
      const newAccountBalance = await PortfolioService.recalculateAccountBalance(userId, session);

      if (shouldCreateSession) {
        await session.commitTransaction();
      }

      logger.info('✅ Manually completed copytrade purchase', {
        purchaseId: purchase._id,
        userId,
        initialInvestment: initial_investment,
        finalValue,
        roiPercent: finalROIPercent,
        profitLoss: purchase.trade_profit_loss,
        risk: trade_risk,
        newEndDate: now.toISOString(),
        newAccountBalance
      });

      notifyCopytradeCompleted(userId, purchase, {
        finalValue,
        roiPercent: finalROIPercent
      }).catch(() => {});

      return {
        purchase,
        finalValue,
        roiPercent: finalROIPercent,
        profitLoss: purchase.trade_profit_loss,
        newAccountBalance
      };
    } catch (error) {
      if (shouldCreateSession) {
        await session.abortTransaction();
      }
      logger.error('❌ Error manually completing copytrade purchase', {
        purchaseId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      if (shouldCreateSession) {
        session.endSession();
      }
    }
  }

  /**
   * Process all active trades (complete expired, then daily update)
   * Called by cron job at 3:00 AM WAT
   * @returns {Object} - Processing statistics
   */
  static async processTrades() {
    try {
      logger.info('🔄 Starting copytrade trading process (daily WAT)', {
        timestamp: new Date().toISOString()
      });

      // First, complete expired trades
      const completionStats = await this.completeExpiredTrades();

      // Then, update remaining active trades
      const updateStats = await this.updateActiveTrades();

      return {
        completion: completionStats,
        update: updateStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('❌ Error processing trades', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

export default CopytradeTradingService;

