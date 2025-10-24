// services/balance.service.js
// Centralized balance management service
import mongoose from 'mongoose';
import User from '../model/user.model.js';
import PortfolioService from './portfolio.service.js';
import logger from '../utils/logger.js';

class BalanceService {
 /**
   * Add funds to user account (for deposits)
   * Updates totalInvestment, accountBalance, AND portfolio
   * @param {String} userId - User ID
   * @param {Number} usdValue - Amount to add in USD
   * @param {String} tokenName - Token being deposited
   * @param {Number} tokenAmount - Amount of tokens
   * @param {Object} session - MongoDB session for transaction
   */
 static async addFunds(userId, usdValue, tokenName, tokenAmount, session = null) {
    const userDoc = await User.findById(userId)
      .select('email totalInvestment accountBalance')
      .session(session);

    if (!userDoc) {
      throw new Error('USER_NOT_FOUND');
    }

    // Ensure accountBalance is initialized
    if (userDoc.accountBalance === undefined) {
      userDoc.accountBalance = userDoc.totalInvestment || 0;
    }

    const previousTotalInvestment = userDoc.totalInvestment || 0;
    const previousAccountBalance = userDoc.accountBalance || 0;

    // Add to both balances
    const newTotalInvestment = Number((previousTotalInvestment + usdValue).toFixed(8));
    const newAccountBalance = Number((previousAccountBalance + usdValue).toFixed(8));

    userDoc.totalInvestment = newTotalInvestment;
    userDoc.accountBalance = newAccountBalance;

    // Add to portfolio
    await PortfolioService.addToPortfolio(
      userId,
      tokenName,
      tokenAmount,
      usdValue,
      session
    );

    await userDoc.save({ session });

    logger.info('💰 Funds added to user account and portfolio', {
      userId: userDoc._id,
      userEmail: userDoc.email,
      tokenName,
      tokenAmount,
      usdValueAdded: usdValue,
      totalInvestment: { previous: previousTotalInvestment, new: newTotalInvestment },
      accountBalance: { previous: previousAccountBalance, new: newAccountBalance }
    });

    return {
      userEmail: userDoc.email,
      previousTotalInvestment,
      newTotalInvestment,
      previousAccountBalance,
      newAccountBalance,
      tokenAdded: {
        name: tokenName,
        amount: tokenAmount
      }
    };
  }

  /**
   * Deduct funds from user account (for withdrawals)
   * Updates accountBalance AND portfolio
   * @param {String} userId - User ID
   * @param {Number} usdValue - Amount to deduct in USD
   * @param {String} tokenName - Token being withdrawn
   * @param {Number} tokenAmount - Amount of tokens
   * @param {Object} session - MongoDB session for transaction
   */
  static async deductFunds(userId, usdValue, tokenName, tokenAmount, session = null) {
    const userDoc = await User.findById(userId)
      .select('email totalInvestment accountBalance')
      .session(session);

    if (!userDoc) {
      throw new Error('USER_NOT_FOUND');
    }

    // Ensure accountBalance is initialized
    if (userDoc.accountBalance === undefined) {
      userDoc.accountBalance = userDoc.totalInvestment || 0;
    }

    const currentAccountBalance = userDoc.accountBalance || 0;
    const totalInvestment = userDoc.totalInvestment || 0;

    // Validate sufficient balance
    if (currentAccountBalance < usdValue) {
      const error = new Error('INSUFFICIENT_FUNDS');
      error.data = {
        required: usdValue,
        available: currentAccountBalance,
        deficit: usdValue - currentAccountBalance
      };
      throw error;
    }

    // Deduct from portfolio first (this validates token balance)
    const portfolioResult = await PortfolioService.deductFromPortfolio(
      userId,
      tokenName,
      tokenAmount,
      session
    );

    const newAccountBalance = Number((currentAccountBalance - usdValue).toFixed(8));
    userDoc.accountBalance = newAccountBalance;

    await userDoc.save({ session });

    logger.info('💸 Funds deducted from user account and portfolio', {
      userId: userDoc._id,
      userEmail: userDoc.email,
      tokenName,
      tokenAmount,
      usdValueDeducted: usdValue,
      accountBalance: { previous: currentAccountBalance, new: newAccountBalance },
      totalInvestment: totalInvestment
    });

    return {
      userEmail: userDoc.email,
      previousAccountBalance: currentAccountBalance,
      newAccountBalance,
      totalInvestment,
      tokenDeducted: {
        name: tokenName,
        amount: tokenAmount
      }
    };
  }

  /**
   * Get user balance information
   * @param {String} userId - User ID
   * @returns {Object} - { totalInvestment, accountBalance, email }
   */
  static async getBalance(userId) {
    const userDoc = await User.findById(userId)
      .select('email totalInvestment accountBalance');

    if (!userDoc) {
      throw new Error('USER_NOT_FOUND');
    }

    // Ensure accountBalance is initialized (for existing users)
    if (userDoc.accountBalance === undefined) {
      userDoc.accountBalance = userDoc.totalInvestment || 0;
      await userDoc.save();
    }

    return {
      email: userDoc.email,
      totalInvestment: userDoc.totalInvestment || 0,
      accountBalance: userDoc.accountBalance || 0
    };
  }

  /**
   * Check if user has sufficient balance for withdrawal
   * @param {String} userId - User ID
   * @param {Number} requiredAmount - Required amount in USD
   * @returns {Object} - { hasSufficientFunds, accountBalance, deficit }
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