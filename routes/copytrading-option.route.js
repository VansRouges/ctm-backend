import express from 'express';
import CopytradingOptionController from '../controllers/copytrading-option.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const copyTradingOptionRouter = express.Router();

// GET all (admin only)
copyTradingOptionRouter.get('/', requireAdminAuth, CopytradingOptionController.getAllCopytradingOptions);

// Recommended first (static)
copyTradingOptionRouter.get('/recommended', CopytradingOptionController.getRecommendedCopytradingOptions);

// User route BEFORE :id to avoid param conflict
copyTradingOptionRouter.get('/user/:userId', CopytradingOptionController.getCopytradingOptionsByUserId);

// Create
copyTradingOptionRouter.post('/', CopytradingOptionController.createCopytradingOption);

// ID routes
copyTradingOptionRouter.get('/:id', CopytradingOptionController.getCopytradingOptionById);
copyTradingOptionRouter.put('/:id', CopytradingOptionController.updateCopytradingOption);
copyTradingOptionRouter.delete('/:id', requireAdminAuth, CopytradingOptionController.deleteCopytradingOption);  // Admin only

export default copyTradingOptionRouter;