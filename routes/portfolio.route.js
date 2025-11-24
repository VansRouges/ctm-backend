// routes/portfolio.route.js
import express from 'express';
import PortfolioController from '../controllers/portfolio.controller.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const portfolioRouter = express.Router();

// User endpoints
// GET /api/v1/portfolio/my-portfolio - Get authenticated user's portfolio
portfolioRouter.get('/my-portfolio', requireUserAuth, PortfolioController.getMyPortfolio);

// GET /api/v1/portfolio/my-available-tokens - Get tokens authenticated user can withdraw
portfolioRouter.get('/my-available-tokens', requireUserAuth, PortfolioController.getMyAvailableTokens);

// POST /api/v1/portfolio/validate-withdrawal - Validate if authenticated user can withdraw specific amount
portfolioRouter.post('/validate-withdrawal', requireUserAuth, PortfolioController.validateWithdrawal);

// Admin endpoints
// GET /api/v1/portfolio/users - Admin: Get all users with their portfolio information
portfolioRouter.get('/users', requireAdminAuth, PortfolioController.getAllUsersWithPortfolios);

// GET /api/v1/portfolio/user/:userId - Admin: Get user's portfolio
portfolioRouter.get('/user/:userId', requireAdminAuth, PortfolioController.getUserPortfolio);

// GET /api/v1/portfolio/user/:userId/available-tokens - Admin: Get tokens user can withdraw
portfolioRouter.get('/user/:userId/available-tokens', requireAdminAuth, PortfolioController.getAvailableTokens);

// POST /api/v1/portfolio/user/:userId/recalculate - Admin: Recalculate balance
portfolioRouter.post('/user/:userId/recalculate', requireAdminAuth, PortfolioController.recalculateBalance);

export default portfolioRouter;