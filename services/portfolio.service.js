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
   * Recalculate and sync user's accountBalance with portfolio
   * @param {String} userId - User ID
   * @param {Object} session - MongoDB session
   * @returns {Number} - New account balance
   */
  static async recalculateAccountBalance(userId, session = null) {
    try {
      const portfolio = await this.getUserPortfolio(userId);
      const newAccountBalance = portfolio.totalCurrentValue;

      // Update user's accountBalance
      await User.findByIdAndUpdate(
        userId,
        { accountBalance: Number(newAccountBalance.toFixed(8)) },
        { session }
      );

      logger.info('💰 Recalculated account balance from portfolio', {
        userId,
        newAccountBalance,
        holdingsCount: portfolio.holdings.length
      });

      return newAccountBalance;
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