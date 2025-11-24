import express from 'express';
import DepositController from '../controllers/deposit.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const depositRouter = express.Router();

// GET /api/deposits - Get all deposits (admin only)
depositRouter.get('/', requireAdminAuth, DepositController.getAllDeposits);

// POST /api/deposits/admin - Admin create deposit for user
depositRouter.post('/admin', requireAdminAuth, DepositController.createDepositForUser);

// POST /api/deposits - Create new deposit
depositRouter.post('/', DepositController.createDeposit);

// GET /api/deposits/:id - Get deposit by ID
depositRouter.get('/:id', DepositController.getDepositById);

// PUT /api/deposits/:id - Update deposit
depositRouter.put('/:id', requireAdminAuth, DepositController.updateDeposit);

// DELETE /api/deposits/:id - Delete deposit (admin only)
depositRouter.delete('/:id', requireAdminAuth, DepositController.deleteDeposit);

// GET /api/deposits/user/:userId - Get deposits for specific user
depositRouter.get('/user/:userId', DepositController.getUserDeposits);

// GET /api/deposits/user/:userId/status/:status - Get deposits by status for specific user
depositRouter.get('/user/:userId/status/:status', DepositController.getUserDepositsByStatus);

export default depositRouter;