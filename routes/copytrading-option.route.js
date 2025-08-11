import express from 'express';
import CopytradingOptionController from '../controllers/copytrading-option.controller.js';

const copyTradingOptionRouter = express.Router();

// GET /api/copytrading-options - Get all copytrading options
copyTradingOptionRouter.get('/', CopytradingOptionController.getAllCopytradingOptions);

// POST /api/copytrading-options - Create new copytrading option
copyTradingOptionRouter.post('/', CopytradingOptionController.createCopytradingOption);

// GET /api/copytrading-options/recommended - Get recommended copytrading options
copyTradingOptionRouter.get('/recommended', CopytradingOptionController.getRecommendedCopytradingOptions);

// GET /api/copytrading-options/:id - Get copytrading option by ID
copyTradingOptionRouter.get('/:id', CopytradingOptionController.getCopytradingOptionById);

// PUT /api/copytrading-options/:id - Update copytrading option
copyTradingOptionRouter.put('/:id', CopytradingOptionController.updateCopytradingOption);

// DELETE /api/copytrading-options/:id - Delete copytrading option
copyTradingOptionRouter.delete('/:id', CopytradingOptionController.deleteCopytradingOption);

// GET /api/copytrading-options/user/:user_id - Get copytrading options by user ID
copyTradingOptionRouter.get('/user/:user_id', CopytradingOptionController.getCopytradingOptionsByUserId);

export default copyTradingOptionRouter;