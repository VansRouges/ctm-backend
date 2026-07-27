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
   * Admin: set accountBalance (available) and/or currentValue (total equity).
   *
   * Definitions:
   * - accountBalance = liquid portfolio mark-to-market
   * - currentValue = accountBalance + lockedValue (active copytrades/stocks)
   *
   * Persistence: adjusts USDT / holdings so FinancialSummary sync keeps the values.
   * totalInvestment is never changed here.
   *
   * @param {String} userId
   * @param {Object} fields
   * @param {Number} [fields.accountBalance]
   * @param {Number} [fields.currentValue]
   * @param {Object} [session]
   */
  static async adminUpdateFinancialMetrics(
    userId,
    { accountBalance, currentValue } = {},
    session = null
  ) {
    const hasBalance = accountBalance !== undefined && accountBalance !== null;
    const hasCurrent = currentValue !== undefined && currentValue !== null;

    if (!hasBalance && !hasCurrent) {
      const error = new Error('NO_FINANCIAL_FIELDS');
      error.data = {
        message: 'Provide accountBalance and/or currentValue'
      };
      throw error;
    }

    const parseNonNegative = (value, fieldName) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) {
        const error = new Error('INVALID_FINANCIAL_VALUE');
        error.data = {
          field: fieldName,
          value,
          message: `${fieldName} must be a non-negative number`
        };
        throw error;
      }
      return Number(n.toFixed(8));
    };

    const requestedBalance = hasBalance
      ? parseNonNegative(accountBalance, 'accountBalance')
      : undefined;
    const requestedCurrent = hasCurrent
      ? parseNonNegative(currentValue, 'currentValue')
      : undefined;

    const before = await FinancialSummaryService.computeSummary(userId, session);
    const lockedValue = before.lockedValue || 0;

    let targetAvailable;

    if (hasBalance && hasCurrent) {
      if (requestedCurrent < requestedBalance) {
        const error = new Error('CURRENT_VALUE_BELOW_BALANCE');
        error.data = {
          accountBalance: requestedBalance,
          currentValue: requestedCurrent,
          message: 'currentValue must be greater than or equal to accountBalance'
        };
        throw error;
      }

      const impliedLocked = Number(
        (requestedCurrent - requestedBalance).toFixed(8)
      );
      // Locked capital comes from active trades/stocks — admin cannot invent it here
      if (Math.abs(impliedLocked - lockedValue) > 0.01) {
        const error = new Error('CURRENT_VALUE_LOCKED_MISMATCH');
        error.data = {
          accountBalance: requestedBalance,
          currentValue: requestedCurrent,
          lockedValue,
          expectedCurrentValue: Number(
            (requestedBalance + lockedValue).toFixed(8)
          ),
          message:
            'currentValue must equal accountBalance + lockedValue. ' +
            'Update accountBalance alone, or set currentValue to accountBalance + lockedValue. ' +
            'To change locked capital, update active copytrade/stock values.'
        };
        throw error;
      }
      targetAvailable = requestedBalance;
    } else if (hasBalance) {
      targetAvailable = requestedBalance;
    } else {
      // currentValue only → available = currentValue - locked
      targetAvailable = Number((requestedCurrent - lockedValue).toFixed(8));
      if (targetAvailable < 0) {
        const error = new Error('CURRENT_VALUE_BELOW_LOCKED');
        error.data = {
          currentValue: requestedCurrent,
          lockedValue,
          message:
            'currentValue cannot be less than locked capital in active trades/stocks'
        };
        throw error;
      }
    }

    const { delta, adjustments } = await PortfolioService.adjustAvailableToTarget(
      userId,
      targetAvailable,
      before.accountBalance,
      session
    );

    const after = await FinancialSummaryService.syncUserFinancialMetrics(
      userId,
      session
    );

    logger.info('✏️ Admin updated user financial metrics', {
      userId,
      requested: { accountBalance: requestedBalance, currentValue: requestedCurrent },
      before: {
        accountBalance: before.accountBalance,
        currentValue: before.currentValue,
        lockedValue: before.lockedValue
      },
      after: {
        accountBalance: after.accountBalance,
        currentValue: after.currentValue,
        lockedValue: after.lockedValue,
        roi: after.roi
      },
      delta,
      adjustments
    });

    return {
      before: {
        accountBalance: before.accountBalance,
        currentValue: before.currentValue,
        lockedValue: before.lockedValue,
        roi: before.roi
      },
      after: {
        accountBalance: after.accountBalance,
        currentValue: after.currentValue,
        lockedValue: after.lockedValue,
        lifetimeWithdrawals: after.lifetimeWithdrawals,
        roi: after.roi,
        netGainLoss: after.netGainLoss,
        totalInvestment: after.totalInvestment
      },
      delta,
      adjustments,
      email: after.email
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
