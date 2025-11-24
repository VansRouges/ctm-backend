// services/copytrade-purchase.service.js
// Service for copytrade purchase operations
import mongoose from 'mongoose';
import CopytradePurchase from '../model/copytrade-purchase.model.js';
import CopytradingOption from '../model/copytrading-option.model.js';
import User from '../model/user.model.js';
import Portfolio from '../model/portfolio.model.js';
import PortfolioService from './portfolio.service.js';
import BalanceService from './balance.service.js';
import { getTokenPrice } from '../utils/priceService.js';
import logger from '../utils/logger.js';

class CopytradePurchaseService {
  /**
   * Create a copytrade purchase (status: pending, no balance deduction)
   * @param {Object} purchaseData - Purchase data
   * @param {String} purchaseData.user - User ID
   * @param {String} purchaseData.copytradeOptionId - Copytrade option ID (to fetch option details)
   * @param {Number} purchaseData.initial_investment - Investment amount
   * @param {Object} session - MongoDB session for transaction
   * @returns {Object} - Created purchase
   */
  static async createPurchase(purchaseData, session = null) {
    const {
      user,
      copytradeOptionId,
      initial_investment
    } = purchaseData;

    // Fetch copytrade option details
    const copytradeOption = await CopytradingOption.findById(copytradeOptionId).session(session);
    
    if (!copytradeOption) {
      const error = new Error('COPYTRADE_OPTION_NOT_FOUND');
      error.data = { copytradeOptionId };
      throw error;
    }

    const {
      trade_title,
      trade_min,
      trade_max,
      trade_risk,
      trade_roi_min,
      trade_roi_max,
      trade_duration
    } = copytradeOption;

    // Validate initial_investment is within range
    if (initial_investment < trade_min) {
      const error = new Error('INVESTMENT_BELOW_MINIMUM');
      error.data = {
        investment: initial_investment,
        minimum: trade_min,
        tradeTitle: trade_title
      };
      throw error;
    }

    // Validate user exists and has sufficient balance (must be >= trade_min)
    const userDoc = await User.findById(user)
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

    // Validate user has sufficient balance (must be >= trade_min)
    if (currentAccountBalance < trade_min) {
      const error = new Error('INSUFFICIENT_BALANCE_FOR_PURCHASE');
      error.data = {
        required: trade_min,
        available: currentAccountBalance,
        deficit: trade_min - currentAccountBalance,
        tradeTitle: trade_title
      };
      throw error;
    }

    // Check if user has sufficient balance for the investment
    if (currentAccountBalance < initial_investment) {
      const error = new Error('INSUFFICIENT_FUNDS');
      error.data = {
        required: initial_investment,
        available: currentAccountBalance,
        deficit: initial_investment - currentAccountBalance,
        tradeTitle: trade_title
      };
      throw error;
    }

    // Create purchase record with status 'pending' (no balance deduction yet)
    // Set trade_current_value to initial_investment initially (will update as trade progresses)
    const trade_current_value = purchaseData.trade_current_value !== undefined 
      ? purchaseData.trade_current_value 
      : initial_investment;

    const purchase = new CopytradePurchase({
      user,
      copytradeOption: copytradeOptionId,
      trade_title,
      trade_max,
      trade_min,
      trade_risk,
      trade_roi_min,
      trade_roi_max,
      trade_duration,
      initial_investment,
      trade_current_value,
      trade_profit_loss: purchaseData.trade_profit_loss !== undefined 
        ? purchaseData.trade_profit_loss 
        : trade_current_value - initial_investment,
      trade_status: 'pending', // Always pending on creation
      trade_win_rate: purchaseData.trade_win_rate || null,
      trade_approval_date: purchaseData.trade_approval_date || null,
      trade_end_date: purchaseData.trade_end_date || null
    });

    const savedPurchase = await purchase.save({ session });

    logger.info('📝 Copytrade purchase created (pending approval)', {
      purchaseId: savedPurchase._id,
      userId: user,
      userEmail: userDoc.email,
      tradeTitle: trade_title,
      initialInvestment: initial_investment,
      status: 'pending'
    });

    return {
      purchase: savedPurchase
    };
  }

  /**
   * Approve copytrade purchase and deduct from portfolio (highest value token first)
   * @param {Object} purchase - CopytradePurchase document
   * @param {String} adminUsername - Admin who approved
   * @param {Object} session - MongoDB session for transaction
   * @returns {Object} - Approval result with deduction details
   */
  static async approvePurchase(purchase, adminUsername, session = null) {
    const userId = purchase.user;
    const usdAmountToDeduct = purchase.initial_investment;

    // Get user's portfolio entries with live prices
    const portfolioEntries = await Portfolio.find({ user: userId }).session(session);
    
    if (portfolioEntries.length === 0) {
      const error = new Error('NO_PORTFOLIO_ENTRIES');
      error.data = { userId };
      throw error;
    }

    // Fetch live prices and calculate current values, then sort by value (highest first)
    const entriesWithValues = await Promise.all(
      portfolioEntries.map(async (entry) => {
        try {
          const livePrice = await getTokenPrice(entry.token_name);
          const currentValue = Number((entry.amount * livePrice).toFixed(8));
          return {
            entry,
            livePrice,
            currentValue
          };
        } catch (error) {
          logger.error(`Failed to get price for ${entry.token_name}`, error);
          return {
            entry,
            livePrice: null,
            currentValue: 0
          };
        }
      })
    );

    // Sort by current value (highest first)
    entriesWithValues.sort((a, b) => b.currentValue - a.currentValue);

    // Calculate total portfolio value
    const totalPortfolioValue = entriesWithValues.reduce(
      (sum, item) => sum + item.currentValue,
      0
    );

    // Validate user has sufficient portfolio value
    if (totalPortfolioValue < usdAmountToDeduct) {
      const error = new Error('INSUFFICIENT_PORTFOLIO_VALUE');
      error.data = {
        required: usdAmountToDeduct,
        available: totalPortfolioValue,
        deficit: usdAmountToDeduct - totalPortfolioValue
      };
      throw error;
    }

    // Deduct from portfolio starting with highest value token first
    let remainingToDeduct = usdAmountToDeduct;
    const deductions = [];

    for (const { entry, livePrice, currentValue } of entriesWithValues) {
      if (remainingToDeduct <= 0) break;
      if (!livePrice || currentValue <= 0) continue;

      if (currentValue <= remainingToDeduct) {
        // Deduct entire token value
        const tokenAmountToDeduct = entry.amount;
        await PortfolioService.deductFromPortfolio(
          userId,
          entry.token_name,
          tokenAmountToDeduct,
          session
        );
        deductions.push({
          tokenName: entry.token_name,
          tokenAmount: tokenAmountToDeduct,
          usdValue: currentValue
        });
        remainingToDeduct -= currentValue;
      } else {
        // Deduct partial token value
        const tokenAmountToDeduct = Number((remainingToDeduct / livePrice).toFixed(8));
        await PortfolioService.deductFromPortfolio(
          userId,
          entry.token_name,
          tokenAmountToDeduct,
          session
        );
        deductions.push({
          tokenName: entry.token_name,
          tokenAmount: tokenAmountToDeduct,
          usdValue: remainingToDeduct
        });
        remainingToDeduct = 0;
      }
    }

    // Recalculate accountBalance from remaining portfolio values
    const newAccountBalance = await PortfolioService.recalculateAccountBalance(userId, session);

    // Set trade start date and calculate end date (duration in days)
    const tradeStartDate = new Date();
    const tradeEndDate = new Date(tradeStartDate);
    tradeEndDate.setDate(tradeEndDate.getDate() + purchase.trade_duration);

    // Update purchase status to 'active' and set trading dates
    purchase.trade_status = 'active';
    purchase.trade_approval_date = tradeStartDate.toISOString();
    purchase.trade_start_date = tradeStartDate;
    purchase.trade_end_date = tradeEndDate;
    await purchase.save({ session });

    logger.info('✅ Copytrade purchase approved with portfolio deduction', {
      purchaseId: purchase._id,
      userId,
      initialInvestment: usdAmountToDeduct,
      deductions,
      newAccountBalance,
      adminUsername
    });

    return {
      purchase,
      deductions,
      newAccountBalance,
      totalDeducted: usdAmountToDeduct
    };
  }

  /**
   * Validate if user can purchase a copytrade option
   * @param {String} userId - User ID
   * @param {Number} tradeMin - Minimum trade amount
   * @param {Number} tradeMax - Maximum trade amount
   * @param {Number} investmentAmount - Desired investment amount
   * @returns {Object} - Validation result
   */
  static async validatePurchase(userId, tradeMin, tradeMax, investmentAmount) {
    const balanceInfo = await BalanceService.getBalance(userId);

    const canPurchase = balanceInfo.accountBalance >= tradeMin;
    const hasSufficientFunds = balanceInfo.accountBalance >= investmentAmount;
    const investmentWithinRange = investmentAmount >= tradeMin;

    return {
      canPurchase,
      hasSufficientFunds,
      investmentWithinRange,
      accountBalance: balanceInfo.accountBalance,
      tradeMin,
      tradeMax,
      investmentAmount,
      deficit: canPurchase ? 0 : tradeMin - balanceInfo.accountBalance,
      fundsDeficit: hasSufficientFunds ? 0 : investmentAmount - balanceInfo.accountBalance
    };
  }
}

export default CopytradePurchaseService;

