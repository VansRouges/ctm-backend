// services/copytrade-trading.service.js
// Service for managing active copytrade purchases - hourly updates and completion
import mongoose from 'mongoose';
import CopytradePurchase from '../model/copytrade-purchase.model.js';
import User from '../model/user.model.js';
import PortfolioService from './portfolio.service.js';
import BalanceService from './balance.service.js';
import logger from '../utils/logger.js';

class CopytradeTradingService {
  /**
   * Calculate hourly profit/loss change based on risk level and progress
   * Simulates realistic trading fluctuations
   * @param {Object} purchase - CopytradePurchase document
   * @returns {Number} - Hourly change percentage (-1% to +1% range)
   */
  static calculateHourlyChange(purchase) {
    const { trade_risk, trade_roi_min, trade_roi_max, trade_start_date, trade_end_date } = purchase;
    
    // Calculate progress (0 to 1)
    const now = new Date();
    const totalDuration = trade_end_date - trade_start_date;
    const elapsed = now - trade_start_date;
    const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1);

    // Base volatility based on risk level
    let volatility;
    switch (trade_risk) {
      case 'low':
        volatility = 0.3; // Lower volatility
        break;
      case 'medium':
        volatility = 0.6; // Medium volatility
        break;
      case 'high':
        volatility = 1.0; // Higher volatility
        break;
      default:
        volatility = 0.5;
    }

    // Generate random change between -volatility% and +volatility%
    // As trade progresses, trend towards final ROI
    const targetROI = trade_risk === 'medium' ? trade_roi_max : trade_roi_min;
    const targetChange = (targetROI / 100) / (purchase.trade_duration * 24); // Average hourly change to reach target
    
    // Random fluctuation + trend towards target
    const randomChange = (Math.random() * 2 - 1) * volatility; // -volatility to +volatility
    const trendComponent = targetChange * progress * 0.5; // Gradually trend towards target
    
    const hourlyChangePercent = randomChange + trendComponent;
    
    // Clamp to reasonable range (-1% to +1%)
    return Math.max(-1, Math.min(1, hourlyChangePercent));
  }

  /**
   * Update active trades with hourly profit/loss changes
   * @returns {Object} - Update statistics
   */
  static async updateActiveTrades() {
    try {
      const now = new Date();
      
      // Find all active trades
      const activeTrades = await CopytradePurchase.find({
        trade_status: 'active',
        trade_start_date: { $exists: true, $lte: now },
        trade_end_date: { $exists: true, $gt: now } // Not yet completed
      });

      logger.info('📈 Updating active copytrade purchases', {
        activeTradesCount: activeTrades.length,
        timestamp: now.toISOString()
      });

      let updatedCount = 0;
      let errors = 0;

      for (const purchase of activeTrades) {
        try {
          // Calculate hourly change percentage
          const hourlyChangePercent = this.calculateHourlyChange(purchase);
          
          // Apply change to current value
          const changeAmount = purchase.trade_current_value * (hourlyChangePercent / 100);
          const newCurrentValue = Number(Math.max(0, purchase.trade_current_value + changeAmount).toFixed(8));
          
          // Update purchase (pre-save hook will recalculate trade_profit_loss and isProfit)
          purchase.trade_current_value = newCurrentValue;
          await purchase.save();

          updatedCount++;

          logger.debug('📊 Updated copytrade purchase', {
            purchaseId: purchase._id,
            userId: purchase.user,
            previousValue: purchase.trade_current_value - changeAmount,
            newValue: newCurrentValue,
            hourlyChange: hourlyChangePercent.toFixed(4) + '%'
          });
        } catch (error) {
          logger.error('❌ Error updating copytrade purchase', {
            purchaseId: purchase._id,
            error: error.message
          });
          errors++;
        }
      }

      logger.info('✅ Completed hourly copytrade updates', {
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

          // Add final value to user's accountBalance and portfolio as USDT
          // Convert USD value to USDT (assuming 1:1 for simplicity, or use current USDT price)
          const usdtAmount = finalValue; // Assuming USDT ≈ $1
          await BalanceService.addFunds(userId, finalValue, 'USDT', usdtAmount, session);

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

          // TODO: Create notification for user about trade completion
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

      // Add final value to user's accountBalance and portfolio as USDT
      const usdtAmount = finalValue; // Assuming USDT ≈ $1
      await BalanceService.addFunds(userId, finalValue, 'USDT', usdtAmount, session);

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
   * Process all active trades (update + complete)
   * Called by cron job every hour
   * @returns {Object} - Processing statistics
   */
  static async processTrades() {
    try {
      logger.info('🔄 Starting copytrade trading process', {
        timestamp: new Date().toISOString()
      });

      // First, complete expired trades
      const completionStats = await this.completeExpiredTrades();

      // Then, update active trades
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

