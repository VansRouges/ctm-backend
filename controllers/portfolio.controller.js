// controllers/portfolio.controller.js
import PortfolioService from '../services/portfolio.service.js';
import logger from '../utils/logger.js';

class PortfolioController {
  /**
   * Get authenticated user's portfolio (User endpoint)
   * GET /api/v1/portfolio/my-portfolio
   */
  static async getMyPortfolio(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      logger.info('📊 Fetching user portfolio', { userId });

      const portfolio = await PortfolioService.getUserPortfolio(userId);

      res.json({
        success: true,
        data: portfolio
      });
    } catch (error) {
      logger.error('❌ Error fetching user portfolio', {
        error: error.message,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch portfolio',
        error: error.message
      });
    }
  }

  /**
   * Get user's portfolio (Admin endpoint)
   * GET /api/v1/portfolio/user/:userId
   */
  static async getUserPortfolio(req, res) {
    try {
      const { userId } = req.params;

      logger.info('📊 Admin fetching user portfolio', { userId, adminId: req.admin?.id });

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
   * Get authenticated user's available tokens (User endpoint)
   * GET /api/v1/portfolio/my-available-tokens
   */
  static async getMyAvailableTokens(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const tokens = await PortfolioService.getUserAvailableTokens(userId);

      res.json({
        success: true,
        data: tokens
      });
    } catch (error) {
      logger.error('❌ Error fetching available tokens', {
        error: error.message,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch available tokens',
        error: error.message
      });
    }
  }

  /**
   * Get user's available tokens (Admin endpoint)
   * GET /api/v1/portfolio/user/:userId/available-tokens
   */
  static async getAvailableTokens(req, res) {
    try {
      const { userId } = req.params;

      const tokens = await PortfolioService.getUserAvailableTokens(userId);

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
   * Validate withdrawal amount (User endpoint)
   * POST /api/v1/portfolio/validate-withdrawal
   */
  static async validateWithdrawal(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const { tokenName, amount } = req.body;

      if (!tokenName || !amount) {
        return res.status(400).json({
          success: false,
          message: 'tokenName and amount are required'
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
        userId: req.user?.userId,
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