// routes/portfolio.route.js
import express from 'express';
import PortfolioController from '../controllers/portfolio.controller.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const portfolioRouter = express.Router();

// GET /api/v1/portfolio/user/:userId - Get user's portfolio
portfolioRouter.get('/user/:userId', requireUserAuth, PortfolioController.getUserPortfolio);

// GET /api/v1/portfolio/user/:userId/available-tokens - Get tokens user can withdraw
portfolioRouter.get('/user/:userId/available-tokens', requireUserAuth, PortfolioController.getAvailableTokens);

// POST /api/v1/portfolio/validate-withdrawal - Validate if user can withdraw specific amount
portfolioRouter.post('/validate-withdrawal', requireUserAuth, PortfolioController.validateWithdrawal);

// POST /api/v1/portfolio/user/:userId/recalculate - Recalculate balance (admin only)
portfolioRouter.post('/user/:userId/recalculate', requireAdminAuth, PortfolioController.recalculateBalance);

export default portfolioRouter;