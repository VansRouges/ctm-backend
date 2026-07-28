// controllers/portfolio.controller.js
import PortfolioService from '../services/portfolio.service.js';
import FinancialSummaryService from '../services/financial-summary.service.js';
import BalanceService from '../services/balance.service.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
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
   * Recalculate account balance + equity metrics from portfolio and locked trades
   * POST /api/v1/portfolio/user/:userId/recalculate
   */
  static async recalculateBalance(req, res) {
    try {
      const { userId } = req.params;

      const summary = await FinancialSummaryService.syncUserFinancialMetrics(userId);

      res.json({
        success: true,
        message: 'Account balance and equity metrics recalculated successfully',
        data: {
          newBalance: summary.accountBalance,
          ...summary
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

  /**
   * Authenticated user's equity summary
   * GET /api/v1/portfolio/my-financial-summary
   */
  static async getMyFinancialSummary(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const summary = await FinancialSummaryService.syncUserFinancialMetrics(userId);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('❌ Error fetching financial summary', {
        error: error.message,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch financial summary',
        error: error.message
      });
    }
  }

  /**
   * Admin: user's equity summary
   * GET /api/v1/portfolio/user/:userId/financial-summary
   */
  static async getUserFinancialSummary(req, res) {
    try {
      const { userId } = req.params;
      const summary = await FinancialSummaryService.syncUserFinancialMetrics(userId);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('❌ Error fetching user financial summary', {
        error: error.message,
        userId: req.params.userId,
        adminId: req.admin?.id
      });

      const status = error.message === 'USER_NOT_FOUND' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message === 'USER_NOT_FOUND'
          ? 'User not found'
          : 'Failed to fetch financial summary',
        error: error.message
      });
    }
  }

  /**
   * Admin: set accountBalance and/or currentValue (portfolio-backed, durable through sync)
   * PUT /api/v1/portfolio/user/:userId/financial
   */
  static async updateUserFinancialMetrics(req, res) {
    try {
      const { userId } = req.params;
      const { accountBalance, currentValue } = req.body || {};

      if (accountBalance === undefined && currentValue === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Provide accountBalance and/or currentValue',
          error: 'NO_FINANCIAL_FIELDS'
        });
      }

      logger.info('✏️ Admin updating user financial metrics', {
        userId,
        adminId: req.admin?.id,
        accountBalance,
        currentValue
      });

      const result = await BalanceService.adminUpdateFinancialMetrics(userId, {
        accountBalance,
        currentValue
      });

      await createAuditLog(req, res, {
        action: 'user_financials_updated',
        resourceType: 'user',
        resourceId: String(userId),
        resourceName: result.email,
        changes: {
          before: result.before,
          after: result.after,
          adjustments: result.adjustments
        },
        description: `Updated financial metrics for user: ${result.email}`
      });
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'Financial metrics updated successfully',
        data: {
          ...result.after,
          email: result.email
        },
        before: result.before,
        portfolioAdjustments: result.adjustments
      });
    } catch (error) {
      logger.error('❌ Error updating user financial metrics', {
        error: error.message,
        userId: req.params.userId,
        adminId: req.admin?.id,
        data: error.data
      });

      const financialErrors = new Set([
        'NO_FINANCIAL_FIELDS',
        'INVALID_FINANCIAL_VALUE',
        'CURRENT_VALUE_BELOW_BALANCE',
        'CURRENT_VALUE_LOCKED_MISMATCH',
        'CURRENT_VALUE_BELOW_LOCKED',
        'INSUFFICIENT_PORTFOLIO_VALUE',
        'USER_NOT_FOUND'
      ]);

      if (financialErrors.has(error.message)) {
        const status = error.message === 'USER_NOT_FOUND' ? 404 : 400;
        return res.status(status).json({
          success: false,
          message: error.data?.message || error.message,
          error: error.message,
          data: error.data || undefined
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update financial metrics',
        error: error.message
      });
    }
  }

  /**
   * Get all users with their portfolio information (Admin endpoint)
   * GET /api/v1/portfolio/users
   */
  static async getAllUsersWithPortfolios(req, res) {
    try {
      logger.info('📊 Admin fetching all users with portfolios', { adminId: req.admin?.id });

      const usersWithPortfolios = await PortfolioService.getAllUsersWithPortfolios();

      res.json({
        success: true,
        count: usersWithPortfolios.length,
        data: usersWithPortfolios
      });
    } catch (error) {
      logger.error('❌ Error fetching all users with portfolios', {
        error: error.message,
        adminId: req.admin?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch users with portfolios',
        error: error.message
      });
    }
  }
}

export default PortfolioController;