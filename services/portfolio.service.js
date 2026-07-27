// services/portfolio.service.js
// Handles all portfolio operations
import mongoose from 'mongoose';
import Portfolio from '../model/portfolio.model.js';
import User from '../model/user.model.js';
import { getTokenPrice } from '../utils/priceService.js';
import logger from '../utils/logger.js';

class PortfolioService {
  /**
   * Add tokens to user's portfolio (after deposit approval)
   * @param {String} userId - User ID
   * @param {String} tokenName - Token symbol/name
   * @param {Number} tokenAmount - Amount of tokens
   * @param {Number} usdValue - USD value at time of deposit
   * @param {Object} session - MongoDB session for transaction
   */
  static async addToPortfolio(userId, tokenName, tokenAmount, usdValue, session = null) {
    try {
      const tokenSymbol = tokenName.toUpperCase();

      // Find or create portfolio entry for this token
      let portfolioEntry = await Portfolio.findOne({
        user: userId,
        token_name: tokenSymbol
      }).session(session);

      if (portfolioEntry) {
        // Update existing portfolio entry
        const newTotalAmount = portfolioEntry.amount + tokenAmount;
        const newTotalInvestedUsd = portfolioEntry.totalInvestedUsd + usdValue;
        
        // Calculate new average acquisition price
        const newAveragePrice = newTotalAmount > 0 
          ? newTotalInvestedUsd / newTotalAmount 
          : 0;

        portfolioEntry.amount = Number(newTotalAmount.toFixed(8));
        portfolioEntry.totalInvestedUsd = Number(newTotalInvestedUsd.toFixed(8));
        portfolioEntry.averageAcquisitionPrice = Number(newAveragePrice.toFixed(8));
        portfolioEntry.lastUpdated = new Date();

        await portfolioEntry.save({ session });

        logger.info('📊 Updated portfolio entry', {
          userId,
          tokenName: tokenSymbol,
          previousAmount: portfolioEntry.amount - tokenAmount,
          newAmount: portfolioEntry.amount,
          amountAdded: tokenAmount,
          usdValueAdded: usdValue
        });
      } else {
        // Create new portfolio entry
        const averagePrice = tokenAmount > 0 ? usdValue / tokenAmount : 0;

        portfolioEntry = new Portfolio({
          user: userId,
          token_name: tokenSymbol,
          amount: Number(tokenAmount.toFixed(8)),
          averageAcquisitionPrice: Number(averagePrice.toFixed(8)),
          totalInvestedUsd: Number(usdValue.toFixed(8)),
          lastUpdated: new Date()
        });

        await portfolioEntry.save({ session });

        logger.info('📊 Created new portfolio entry', {
          userId,
          tokenName: tokenSymbol,
          amount: tokenAmount,
          usdValue
        });
      }

      return portfolioEntry;
    } catch (error) {
      logger.error('❌ Error adding to portfolio', {
        userId,
        tokenName,
        tokenAmount,
        usdValue,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Deduct tokens from user's portfolio (after withdrawal approval)
   * @param {String} userId - User ID
   * @param {String} tokenName - Token symbol/name
   * @param {Number} tokenAmount - Amount of tokens to withdraw
   * @param {Object} session - MongoDB session for transaction
   */
  static async deductFromPortfolio(userId, tokenName, tokenAmount, session = null) {
    try {
      const tokenSymbol = tokenName.toUpperCase();

      const portfolioEntry = await Portfolio.findOne({
        user: userId,
        token_name: tokenSymbol
      }).session(session);

      if (!portfolioEntry) {
        const error = new Error('TOKEN_NOT_IN_PORTFOLIO');
        error.data = { tokenName: tokenSymbol };
        throw error;
      }

      // Check if user has enough tokens
      if (portfolioEntry.amount < tokenAmount) {
        const error = new Error('INSUFFICIENT_TOKEN_BALANCE');
        error.data = {
          tokenName: tokenSymbol,
          requested: tokenAmount,
          available: portfolioEntry.amount,
          deficit: tokenAmount - portfolioEntry.amount
        };
        throw error;
      }

      const previousAmount = portfolioEntry.amount;
      const newAmount = Number((previousAmount - tokenAmount).toFixed(8));

      // Calculate proportional reduction in totalInvestedUsd
      const withdrawalRatio = tokenAmount / previousAmount;
      const usdToDeduct = portfolioEntry.totalInvestedUsd * withdrawalRatio;
      const newTotalInvestedUsd = Number((portfolioEntry.totalInvestedUsd - usdToDeduct).toFixed(8));

      portfolioEntry.amount = newAmount;
      portfolioEntry.totalInvestedUsd = newTotalInvestedUsd;
      portfolioEntry.lastUpdated = new Date();

      // If amount reaches zero or near-zero, delete the entry
      if (newAmount < 0.00000001) {
        await Portfolio.deleteOne({ _id: portfolioEntry._id }).session(session);
        
        logger.info('📊 Deleted portfolio entry (balance reached zero)', {
          userId,
          tokenName: tokenSymbol
        });
      } else {
        await portfolioEntry.save({ session });

        logger.info('📊 Deducted from portfolio', {
          userId,
          tokenName: tokenSymbol,
          previousAmount,
          newAmount,
          amountDeducted: tokenAmount,
          usdDeducted: usdToDeduct
        });
      }

      return {
        portfolioEntry,
        usdDeducted: Number(usdToDeduct.toFixed(8))
      };
    } catch (error) {
      logger.error('❌ Error deducting from portfolio', {
        userId,
        tokenName,
        tokenAmount,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user's complete portfolio with live prices
   * @param {String} userId - User ID
   * @returns {Object} - Portfolio summary
   */
  static async getUserPortfolio(userId) {
    try {
      const portfolioEntries = await Portfolio.find({ user: userId });

      if (portfolioEntries.length === 0) {
        return {
          userId,
          holdings: [],
          totalCurrentValue: 0,
          totalInvestedValue: 0,
          totalProfitLoss: 0,
          totalProfitLossPercentage: 0
        };
      }

      // Fetch live prices for all tokens in portfolio
      const holdingsWithLivePrices = await Promise.all(
        portfolioEntries.map(async (entry) => {
          try {
            const livePrice = await getTokenPrice(entry.token_name);
            const currentValue = Number((entry.amount * livePrice).toFixed(8));
            const profitLoss = Number((currentValue - entry.totalInvestedUsd).toFixed(8));
            const profitLossPercentage = entry.totalInvestedUsd > 0
              ? Number(((profitLoss / entry.totalInvestedUsd) * 100).toFixed(2))
              : 0;

            return {
              tokenName: entry.token_name,
              amount: entry.amount,
              averageAcquisitionPrice: entry.averageAcquisitionPrice,
              currentPrice: livePrice,
              totalInvestedUsd: entry.totalInvestedUsd,
              currentValue,
              profitLoss,
              profitLossPercentage,
              lastUpdated: entry.lastUpdated
            };
          } catch (error) {
            logger.error(`Failed to get price for ${entry.token_name}`, error);
            // Return entry with null price data
            return {
              tokenName: entry.token_name,
              amount: entry.amount,
              averageAcquisitionPrice: entry.averageAcquisitionPrice,
              currentPrice: null,
              totalInvestedUsd: entry.totalInvestedUsd,
              currentValue: null,
              profitLoss: null,
              profitLossPercentage: null,
              lastUpdated: entry.lastUpdated,
              error: 'Price unavailable'
            };
          }
        })
      );

      // Calculate totals
      const totalCurrentValue = holdingsWithLivePrices.reduce(
        (sum, h) => sum + (h.currentValue || 0),
        0
      );
      const totalInvestedValue = holdingsWithLivePrices.reduce(
        (sum, h) => sum + h.totalInvestedUsd,
        0
      );
      const totalProfitLoss = Number((totalCurrentValue - totalInvestedValue).toFixed(8));
      const totalProfitLossPercentage = totalInvestedValue > 0
        ? Number(((totalProfitLoss / totalInvestedValue) * 100).toFixed(2))
        : 0;

      return {
        userId,
        holdings: holdingsWithLivePrices,
        totalCurrentValue: Number(totalCurrentValue.toFixed(8)),
        totalInvestedValue: Number(totalInvestedValue.toFixed(8)),
        totalProfitLoss,
        totalProfitLossPercentage
      };
    } catch (error) {
      logger.error('❌ Error getting user portfolio', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if user has sufficient token balance for withdrawal
   * @param {String} userId - User ID
   * @param {String} tokenName - Token symbol/name
   * @param {Number} tokenAmount - Amount to withdraw
   * @returns {Object} - Validation result
   */
  static async validateWithdrawalAmount(userId, tokenName, tokenAmount) {
    try {
      const tokenSymbol = tokenName.toUpperCase();

      const portfolioEntry = await Portfolio.findOne({
        user: userId,
        token_name: tokenSymbol
      });

      if (!portfolioEntry) {
        return {
          valid: false,
          reason: `You don't have any ${tokenSymbol} in your portfolio`,
          code: 'TOKEN_NOT_IN_PORTFOLIO',
          availableTokens: await this.getUserAvailableTokens(userId)
        };
      }

      if (portfolioEntry.amount < tokenAmount) {
        return {
          valid: false,
          reason: `Insufficient ${tokenSymbol} balance`,
          code: 'INSUFFICIENT_TOKEN_BALANCE',
          requested: tokenAmount,
          available: portfolioEntry.amount,
          deficit: tokenAmount - portfolioEntry.amount
        };
      }

      // Get current price and calculate USD value
      const currentPrice = await getTokenPrice(tokenSymbol);
      const usdValue = Number((tokenAmount * currentPrice).toFixed(8));

      return {
        valid: true,
        tokenAmount,
        currentPrice,
        usdValue,
        availableAmount: portfolioEntry.amount
      };
    } catch (error) {
      logger.error('❌ Error validating withdrawal amount', {
        userId,
        tokenName,
        tokenAmount,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get list of tokens user can withdraw from
   * @param {String} userId - User ID
   * @returns {Array} - List of available tokens
   */
  static async getUserAvailableTokens(userId) {
    try {
      const portfolioEntries = await Portfolio.find({ user: userId });
      
      return portfolioEntries.map(entry => ({
        tokenName: entry.token_name,
        amount: entry.amount,
        averagePrice: entry.averageAcquisitionPrice
      }));
    } catch (error) {
      logger.error('❌ Error getting user available tokens', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Adjust liquid portfolio so mark-to-market available USD ≈ targetAvailable.
   * Increases are credited as USDT (1:1). Decreases prefer USDT, then highest-value tokens.
   * Does not change totalInvestment or locked trade capital.
   *
   * @param {String} userId
   * @param {Number} targetAvailable - Desired available USD (>= 0)
   * @param {Number} currentAvailable - Current available USD
   * @param {Object} session
   * @returns {Object} - { delta, adjustments }
   */
  static async adjustAvailableToTarget(
    userId,
    targetAvailable,
    currentAvailable,
    session = null
  ) {
    const target = Number(Number(targetAvailable).toFixed(8));
    const current = Number(Number(currentAvailable).toFixed(8));
    const delta = Number((target - current).toFixed(8));
    const adjustments = [];

    if (Math.abs(delta) < 0.00000001) {
      return { delta: 0, adjustments };
    }

    if (delta > 0) {
      // Credit as USDT at 1:1 so sync yields the target available balance
      await this.addToPortfolio(userId, 'USDT', delta, delta, session);
      adjustments.push({
        action: 'add',
        tokenName: 'USDT',
        tokenAmount: delta,
        usdValue: delta
      });
      return { delta, adjustments };
    }

    // Decrease: deduct |delta| USD from holdings (USDT first, then highest value)
    let remainingToDeduct = Number(Math.abs(delta).toFixed(8));

    const portfolioEntries = await Portfolio.find({ user: userId }).session(session);
    if (portfolioEntries.length === 0) {
      const error = new Error('INSUFFICIENT_PORTFOLIO_VALUE');
      error.data = {
        required: remainingToDeduct,
        available: 0,
        deficit: remainingToDeduct
      };
      throw error;
    }

    const entriesWithValues = await Promise.all(
      portfolioEntries.map(async (entry) => {
        const symbol = entry.token_name.toUpperCase();
        if (symbol === 'USDT' || symbol === 'USDC' || symbol === 'BUSD') {
          const currentValue = Number(entry.amount.toFixed(8));
          return { entry, livePrice: 1, currentValue, preferFirst: true };
        }
        try {
          const livePrice = await getTokenPrice(entry.token_name);
          const currentValue = Number((entry.amount * livePrice).toFixed(8));
          return { entry, livePrice, currentValue, preferFirst: false };
        } catch (priceError) {
          logger.warn('⚠️ Skipping token without live price during admin balance adjust', {
            userId,
            tokenName: entry.token_name,
            error: priceError.message
          });
          return { entry, livePrice: null, currentValue: 0, preferFirst: false };
        }
      })
    );

    // Stablecoins first, then highest USD value
    entriesWithValues.sort((a, b) => {
      if (a.preferFirst !== b.preferFirst) return a.preferFirst ? -1 : 1;
      return b.currentValue - a.currentValue;
    });

    const totalAvailable = entriesWithValues.reduce(
      (sum, item) => sum + item.currentValue,
      0
    );
    if (totalAvailable + 0.00000001 < remainingToDeduct) {
      const error = new Error('INSUFFICIENT_PORTFOLIO_VALUE');
      error.data = {
        required: remainingToDeduct,
        available: Number(totalAvailable.toFixed(8)),
        deficit: Number((remainingToDeduct - totalAvailable).toFixed(8))
      };
      throw error;
    }

    for (const { entry, livePrice, currentValue } of entriesWithValues) {
      if (remainingToDeduct <= 0) break;
      if (!livePrice || currentValue <= 0) continue;

      if (currentValue <= remainingToDeduct) {
        await this.deductFromPortfolio(
          userId,
          entry.token_name,
          entry.amount,
          session
        );
        adjustments.push({
          action: 'deduct',
          tokenName: entry.token_name,
          tokenAmount: entry.amount,
          usdValue: currentValue
        });
        remainingToDeduct = Number((remainingToDeduct - currentValue).toFixed(8));
      } else {
        const tokenAmountToDeduct = Number((remainingToDeduct / livePrice).toFixed(8));
        await this.deductFromPortfolio(
          userId,
          entry.token_name,
          tokenAmountToDeduct,
          session
        );
        adjustments.push({
          action: 'deduct',
          tokenName: entry.token_name,
          tokenAmount: tokenAmountToDeduct,
          usdValue: remainingToDeduct
        });
        remainingToDeduct = 0;
      }
    }

    if (remainingToDeduct > 0.0001) {
      const error = new Error('INSUFFICIENT_PORTFOLIO_VALUE');
      error.data = {
        required: Math.abs(delta),
        available: Number((Math.abs(delta) - remainingToDeduct).toFixed(8)),
        deficit: remainingToDeduct
      };
      throw error;
    }

    logger.info('📊 Adjusted portfolio available balance to target', {
      userId,
      targetAvailable: target,
      previousAvailable: current,
      delta,
      adjustments
    });

    return { delta, adjustments };
  }

  /**
   * Recalculate and sync user's accountBalance + equity metrics (currentValue, ROI)
   * @param {String} userId - User ID
   * @param {Object} session - MongoDB session
   * @returns {Number} - New available account balance
   */
  static async recalculateAccountBalance(userId, session = null) {
    try {
      // Lazy import avoids circular dependency with financial-summary → portfolio
      const { default: FinancialSummaryService } = await import(
        './financial-summary.service.js'
      );
      const summary = await FinancialSummaryService.syncUserFinancialMetrics(
        userId,
        session
      );

      logger.info('💰 Recalculated account balance and equity metrics', {
        userId,
        newAccountBalance: summary.accountBalance,
        currentValue: summary.currentValue,
        lockedValue: summary.lockedValue,
        roi: summary.roi
      });

      return summary.accountBalance;
    } catch (error) {
      logger.error('❌ Error recalculating account balance', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all users with their portfolio information (Admin only)
   * @returns {Array} - Array of users with portfolio data
   */
  static async getAllUsersWithPortfolios() {
    try {
      // Get all users (excluding password field)
      const users = await User.find({ role: 'user' })
        .select('-password')
        .sort({ createdAt: -1 });

      // Get portfolio data for each user
      const usersWithPortfolios = await Promise.all(
        users.map(async (user) => {
          const portfolio = await this.getUserPortfolio(user._id.toString());
          
          return {
            user: {
              _id: user._id,
              email: user.email,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              fullName: user.fullName,
              profilePicture: user.profilePicture,
              authProvider: user.authProvider,
              isEmailVerified: user.isEmailVerified,
              isActive: user.isActive,
              lastLogin: user.lastLogin,
              roi: user.roi,
              kycStatus: user.kycStatus,
              accountStatus: user.accountStatus,
              totalInvestment: user.totalInvestment,
              accountBalance: user.accountBalance,
              currentValue: user.currentValue,
              lifetimeWithdrawals: user.lifetimeWithdrawals,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            },
            portfolio: {
              holdings: portfolio.holdings,
              totalCurrentValue: portfolio.totalCurrentValue,
              totalInvestedValue: portfolio.totalInvestedValue,
              totalProfitLoss: portfolio.totalProfitLoss,
              totalProfitLossPercentage: portfolio.totalProfitLossPercentage
            }
          };
        })
      );

      logger.info('📊 Fetched all users with portfolios', {
        totalUsers: usersWithPortfolios.length
      });

      return usersWithPortfolios;
    } catch (error) {
      logger.error('❌ Error getting all users with portfolios', {
        error: error.message
      });
      throw error;
    }
  }
}

export default PortfolioService;