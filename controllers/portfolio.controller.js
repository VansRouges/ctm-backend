// controllers/portfolio.controller.js
import PortfolioService from '../services/portfolio.service.js';
import logger from '../utils/logger.js';

class PortfolioController {
  /**
   * Get user's portfolio
   * GET /api/v1/portfolio/user/:userId
   */
  static async getUserPortfolio(req, res) {
    try {
      const { userId } = req.params;

      logger.info('📊 Fetching user portfolio', { userId });

      const portfolio = await PortfolioService.getUserPortfolio(userId);

      res.json({
        success: true,
        data: portfolio
      });
    } catch (error) {
      logger.error('❌ Error fetching user portfolio', {
        error: error.message,
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch portfolio',
        error: error.message
      });
    }
  }

  /**
   * Get user's available tokens for withdrawal
   * GET /api/v1/portfolio/user/:userId/available-tokens
   */
  static async getAvailableTokens(req, res) {
    try {
      const { userId } = req.params;

      const tokens =  PortfolioService.getUserAvailableTokens(userId);

      res.json({
        success: true,
        data: tokens
      });
    } catch (error) {
      logger.error('❌ Error fetching available tokens', {
        error: error.message,
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch available tokens',
        error: error.message
      });
    }
  }

  /**
   * Validate withdrawal amount
   * POST /api/v1/portfolio/validate-withdrawal
   */
  static async validateWithdrawal(req, res) {
    try {
      const { userId, tokenName, amount } = req.body;

      if (!userId || !tokenName || !amount) {
        return res.status(400).json({
          success: false,
          message: 'userId, tokenName, and amount are required'
        });
      }

      const validation = await PortfolioService.validateWithdrawalAmount(
        userId,
        tokenName,
        amount
      );

      res.json({
        success: validation.valid,
        data: validation
      });
    } catch (error) {
      logger.error('❌ Error validating withdrawal', {
        error: error.message,
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: 'Failed to validate withdrawal',
        error: error.message
      });
    }
  }

  /**
   * Recalculate account balance from portfolio
   * POST /api/v1/portfolio/user/:userId/recalculate
   */
  static async recalculateBalance(req, res) {
    try {
      const { userId } = req.params;

      const newBalance = await PortfolioService.recalculateAccountBalance(userId);

      res.json({
        success: true,
        message: 'Account balance recalculated successfully',
        data: {
          newBalance
        }
      });
    } catch (error) {
      logger.error('❌ Error recalculating balance', {
        error: error.message,
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to recalculate balance',
        error: error.message
      });
    }
  }
}

export default PortfolioController;