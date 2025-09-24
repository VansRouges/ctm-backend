import express from 'express';
import WithdrawController from '../controllers/withdraw.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const withdrawRouter = express.Router();

// GET /api/withdraws - Get all withdraws (admin only)
withdrawRouter.get('/', requireAdminAuth, WithdrawController.getAllWithdraws);

// POST /api/withdraws - Create new withdraw
withdrawRouter.post('/', WithdrawController.createWithdraw);

// GET /api/withdraws/:id - Get withdraw by ID
withdrawRouter.get('/:id', WithdrawController.getWithdrawById);

// PUT /api/withdraws/:id - Update withdraw
withdrawRouter.put('/:id', WithdrawController.updateWithdraw);

// DELETE /api/withdraws/:id - Delete withdraw (admin only)
withdrawRouter.delete('/:id', requireAdminAuth, WithdrawController.deleteWithdraw);

// GET /api/withdraws/user/:userId - Get withdraws for specific user
withdrawRouter.get('/user/:userId', WithdrawController.getUserWithdraws);

// GET /api/withdraws/user/:userId/status/:status - Get withdraws by status for specific user
withdrawRouter.get('/user/:userId/status/:status', WithdrawController.getUserWithdrawsByStatus);

export default withdrawRouter;