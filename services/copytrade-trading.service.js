// services/copytrade-trading.service.js
// Service for managing active copytrade purchases - daily updates and completion
import mongoose from 'mongoose';
import CopytradePurchase from '../model/copytrade-purchase.model.js';
import BalanceService from './balance.service.js';
import FinancialSummaryService from './financial-summary.service.js';
import logger from '../utils/logger.js';
import { notifyCopytradeCompleted } from '../utils/emailService.js';

class CopytradeTradingService {
  /**
   * Calculate daily profit/loss change based on risk level and progress.
   * Sized so values trend toward target ROI over trade_duration days.
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
   */
  static async updateActiveTrades() {
    try {
      const now = new Date();
      
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
      const affectedUserIds = [];

      for (const purchase of activeTrades) {
        try {
          const previousValue = purchase.trade_current_value;
          const dailyChangePercent = this.calculateDailyChange(purchase);
          
          const changeAmount = purchase.trade_current_value * (dailyChangePercent / 100);
          const newCurrentValue = Number(Math.max(0, purchase.trade_current_value + changeAmount).toFixed(8));
          
          purchase.trade_current_value = newCurrentValue;
          await purchase.save();

          affectedUserIds.push(purchase.user);
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

      // Refresh currentValue / ROI so locked capital + unrealized P/L are reflected
      const metricsSync = await FinancialSummaryService.syncUsers(affectedUserIds);

      logger.info('✅ Completed daily copytrade updates', {
        totalTrades: activeTrades.length,
        updated: updatedCount,
        errors,
        metricsSynced: metricsSync.synced
      });

      return {
        totalTrades: activeTrades.length,
        updated: updatedCount,
        errors,
        metricsSync
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
   * Resolve final settlement from the live trade path (win or loss).
   */
  static resolveFinalSettlement(purchase) {
    const initial = Number(purchase.initial_investment) || 0;
    const current = Number(purchase.trade_current_value);
    const finalValue = Number(
      Math.max(0, Number.isFinite(current) ? current : initial).toFixed(8)
    );
    const profitLoss = Number((finalValue - initial).toFixed(8));
    const roiPercent =
      initial > 0 ? Number(((profitLoss / initial) * 100).toFixed(4)) : 0;

    return { finalValue, profitLoss, roiPercent, isProfit: profitLoss >= 0 };
  }

  /**
   * Complete trades that have reached their end date.
   * Settles simulated trade_current_value (successful or unsuccessful).
   */
  static async completeExpiredTrades() {
    try {
      const now = new Date();
      
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
          const { initial_investment } = purchase;
          const { finalValue, profitLoss, roiPercent, isProfit } =
            this.resolveFinalSettlement(purchase);

          // Mark completed before settlement so locked capital excludes this trade
          purchase.trade_current_value = finalValue;
          purchase.trade_status = 'completed';
          purchase.trade_profit_loss = profitLoss;
          purchase.isProfit = isProfit;
          await purchase.save({ session });

          await BalanceService.settleTradeReturn(userId, finalValue, session, {
            investedUsd: initial_investment
          });

          await session.commitTransaction();

          completedCount++;
          totalReturned += finalValue;

          logger.info('✅ Completed copytrade purchase', {
            purchaseId: purchase._id,
            userId,
            initialInvestment: initial_investment,
            finalValue,
            roiPercent,
            profitLoss,
            isProfit,
            risk: purchase.trade_risk
          });

          notifyCopytradeCompleted(userId, purchase, {
            finalValue,
            roiPercent
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
          session.endSession();
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
   * Manually complete a single copytrade purchase (admin action).
   * Settles current simulated value unless options.finalValue is provided.
   */
  static async completeSingleTrade(purchaseId, session = null, options = {}) {
    const shouldCreateSession = !session;
    if (shouldCreateSession) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      const purchase = await CopytradePurchase.findById(purchaseId).session(session);
      
      if (!purchase) {
        const error = new Error('PURCHASE_NOT_FOUND');
        error.data = { purchaseId };
        throw error;
      }

      if (purchase.trade_status !== 'active') {
        const error = new Error('PURCHASE_NOT_ACTIVE');
        error.data = { 
          purchaseId, 
          currentStatus: purchase.trade_status 
        };
        throw error;
      }

      const userId = purchase.user;
      const { initial_investment } = purchase;

      let finalValue;
      let profitLoss;
      let roiPercent;
      let isProfit;

      if (options.finalValue != null) {
        finalValue = Number(Math.max(0, Number(options.finalValue)).toFixed(8));
        profitLoss = Number((finalValue - initial_investment).toFixed(8));
        roiPercent =
          initial_investment > 0
            ? Number(((profitLoss / initial_investment) * 100).toFixed(4))
            : 0;
        isProfit = profitLoss >= 0;
      } else {
        ({ finalValue, profitLoss, roiPercent, isProfit } =
          this.resolveFinalSettlement(purchase));
      }

      const now = new Date();
      purchase.trade_current_value = finalValue;
      purchase.trade_status = 'completed';
      purchase.trade_profit_loss = profitLoss;
      purchase.isProfit = isProfit;
      purchase.trade_end_date = now;
      await purchase.save({ session });

      const settleResult = await BalanceService.settleTradeReturn(
        userId,
        finalValue,
        session,
        { investedUsd: initial_investment }
      );

      if (shouldCreateSession) {
        await session.commitTransaction();
      }

      logger.info('✅ Manually completed copytrade purchase', {
        purchaseId: purchase._id,
        userId,
        initialInvestment: initial_investment,
        finalValue,
        roiPercent,
        profitLoss,
        isProfit,
        risk: purchase.trade_risk,
        newEndDate: now.toISOString(),
        newAccountBalance: settleResult.newAccountBalance,
        roi: settleResult.roi
      });

      notifyCopytradeCompleted(userId, purchase, {
        finalValue,
        roiPercent
      }).catch(() => {});

      return {
        purchase,
        finalValue,
        roiPercent,
        profitLoss,
        newAccountBalance: settleResult.newAccountBalance,
        currentValue: settleResult.currentValue,
        roi: settleResult.roi
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
   */
  static async processTrades() {
    try {
      logger.info('🔄 Starting copytrade trading process (daily WAT)', {
        timestamp: new Date().toISOString()
      });

      const completionStats = await this.completeExpiredTrades();
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
