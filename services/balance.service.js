// services/balance.service.js
// Centralized balance management service
import User from '../model/user.model.js';
import PortfolioService from './portfolio.service.js';
import FinancialSummaryService from './financial-summary.service.js';
import logger from '../utils/logger.js';

class BalanceService {
  /**
   * Add funds to user account (for deposits)
   * Updates totalInvestment AND portfolio, then syncs metrics
   */
  static async addFunds(userId, usdValue, tokenName, tokenAmount, session = null) {
    const userDoc = await User.findById(userId)
      .select('email totalInvestment accountBalance')
      .session(session);

    if (!userDoc) {
      throw new Error('USER_NOT_FOUND');
    }

    if (userDoc.accountBalance === undefined) {
      userDoc.accountBalance = userDoc.totalInvestment || 0;
    }

    const previousTotalInvestment = userDoc.totalInvestment || 0;
    const previousAccountBalance = userDoc.accountBalance || 0;

    const newTotalInvestment = Number((previousTotalInvestment + usdValue).toFixed(8));
    userDoc.totalInvestment = newTotalInvestment;

    await PortfolioService.addToPortfolio(
      userId,
      tokenName,
      tokenAmount,
      usdValue,
      session
    );

    await userDoc.save({ session });

    const summary = await FinancialSummaryService.syncUserFinancialMetrics(userId, session);

    logger.info('💰 Funds added to user account and portfolio', {
      userId: userDoc._id,
      userEmail: userDoc.email,
      tokenName,
      tokenAmount,
      usdValueAdded: usdValue,
      totalInvestment: { previous: previousTotalInvestment, new: newTotalInvestment },
      accountBalance: { previous: previousAccountBalance, new: summary.accountBalance },
      currentValue: summary.currentValue,
      roi: summary.roi
    });

    return {
      userEmail: userDoc.email,
      previousTotalInvestment,
      newTotalInvestment,
      previousAccountBalance,
      newAccountBalance: summary.accountBalance,
      currentValue: summary.currentValue,
      roi: summary.roi,
      tokenAdded: {
        name: tokenName,
        amount: tokenAmount
      }
    };
  }

  /**
   * Deduct funds from user account (for withdrawals)
   * Updates portfolio only; totalInvestment unchanged; metrics sync refreshes ROI
   */
  static async deductFunds(userId, usdValue, tokenName, tokenAmount, session = null) {
    const userDoc = await User.findById(userId)
      .select('email totalInvestment accountBalance')
      .session(session);

    if (!userDoc) {
      throw new Error('USER_NOT_FOUND');
    }

    if (userDoc.accountBalance === undefined) {
      userDoc.accountBalance = userDoc.totalInvestment || 0;
    }

    const currentAccountBalance = userDoc.accountBalance || 0;
    const totalInvestment = userDoc.totalInvestment || 0;

    if (currentAccountBalance < usdValue) {
      const error = new Error('INSUFFICIENT_FUNDS');
      error.data = {
        required: usdValue,
        available: currentAccountBalance,
        deficit: usdValue - currentAccountBalance
      };
      throw error;
    }

    await PortfolioService.deductFromPortfolio(
      userId,
      tokenName,
      tokenAmount,
      session
    );

    const summary = await FinancialSummaryService.syncUserFinancialMetrics(userId, session);

    logger.info('💸 Funds deducted from user account and portfolio', {
      userId: userDoc._id,
      userEmail: userDoc.email,
      tokenName,
      tokenAmount,
      usdValueDeducted: usdValue,
      accountBalance: { previous: currentAccountBalance, new: summary.accountBalance },
      lifetimeWithdrawals: summary.lifetimeWithdrawals,
      currentValue: summary.currentValue,
      roi: summary.roi,
      totalInvestment
    });

    return {
      userEmail: userDoc.email,
      previousAccountBalance: currentAccountBalance,
      newAccountBalance: summary.accountBalance,
      totalInvestment,
      currentValue: summary.currentValue,
      roi: summary.roi,
      tokenDeducted: {
        name: tokenName,
        amount: tokenAmount
      }
    };
  }

  /**
   * Settle trade/stock returns as USDT.
   * Does NOT inflate totalInvestment.
   * @param {String} userId
   * @param {Number} usdValue - Final settlement value in USD (USDT amount 1:1)
   * @param {Object} session
   * @param {Object} options
   * @param {Number} [options.investedUsd] - Cost basis for USDT (defaults to usdValue).
   *   Pass the trade's initial_investment so profit/loss is reflected in portfolio MTM.
   */
  static async settleTradeReturn(userId, usdValue, session = null, options = {}) {
    const userDoc = await User.findById(userId)
      .select('email totalInvestment accountBalance')
      .session(session);

    if (!userDoc) {
      throw new Error('USER_NOT_FOUND');
    }

    const settledValue = Number(Number(usdValue).toFixed(8));
    if (settledValue < 0) {
      throw new Error('INVALID_SETTLEMENT_VALUE');
    }

    const investedUsd =
      options.investedUsd != null
        ? Number(Number(options.investedUsd).toFixed(8))
        : settledValue;

    const previousAccountBalance = userDoc.accountBalance || 0;
    const usdtAmount = settledValue;

    await PortfolioService.addToPortfolio(
      userId,
      'USDT',
      usdtAmount,
      investedUsd,
      session
    );

    const summary = await FinancialSummaryService.syncUserFinancialMetrics(userId, session);

    logger.info('💵 Trade return settled as USDT (no totalInvestment change)', {
      userId: userDoc._id,
      userEmail: userDoc.email,
      usdValue: settledValue,
      investedUsd,
      usdtAmount,
      accountBalance: { previous: previousAccountBalance, new: summary.accountBalance },
      currentValue: summary.currentValue,
      roi: summary.roi,
      totalInvestment: userDoc.totalInvestment
    });

    return {
      userEmail: userDoc.email,
      previousAccountBalance,
      newAccountBalance: summary.accountBalance,
      totalInvestment: userDoc.totalInvestment || 0,
      currentValue: summary.currentValue,
      roi: summary.roi,
      tokenAdded: { name: 'USDT', amount: usdtAmount }
    };
  }

  /**
   * Get user balance information
   */
  static async getBalance(userId) {
    const summary = await FinancialSummaryService.syncUserFinancialMetrics(userId);

    return {
      email: summary.email,
      totalInvestment: summary.totalInvestment,
      accountBalance: summary.accountBalance,
      currentValue: summary.currentValue,
      lockedValue: summary.lockedValue,
      lifetimeWithdrawals: summary.lifetimeWithdrawals,
      roi: summary.roi,
      netGainLoss: summary.netGainLoss
    };
  }

  /**
   * Check if user has sufficient available balance for withdrawal
   */
  static async hasSufficientBalance(userId, requiredAmount) {
    const balance = await this.getBalance(userId);
    const hasSufficientFunds = balance.accountBalance >= requiredAmount;

    return {
      hasSufficientFunds,
      accountBalance: balance.accountBalance,
      totalInvestment: balance.totalInvestment,
      deficit: hasSufficientFunds ? 0 : requiredAmount - balance.accountBalance,
      userEmail: balance.email
    };
  }
}

export default BalanceService;
