import express from 'express';
import CopytradingOptionController from '../controllers/copytrading-option.controller.js';

const copyTradingOptionRouter = express.Router();

// GET all
copyTradingOptionRouter.get('/', CopytradingOptionController.getAllCopytradingOptions);

// Recommended first (static)
copyTradingOptionRouter.get('/recommended', CopytradingOptionController.getRecommendedCopytradingOptions);

// User route BEFORE :id to avoid param conflict
copyTradingOptionRouter.get('/user/:userId', CopytradingOptionController.getCopytradingOptionsByUserId);

// Create
copyTradingOptionRouter.post('/', CopytradingOptionController.createCopytradingOption);

// ID routes
copyTradingOptionRouter.get('/:id', CopytradingOptionController.getCopytradingOptionById);
copyTradingOptionRouter.put('/:id', CopytradingOptionController.updateCopytradingOption);
copyTradingOptionRouter.delete('/:id', CopytradingOptionController.deleteCopytradingOption);

export default copyTradingOptionRouter;