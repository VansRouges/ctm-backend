import express from 'express';
import WithdrawController from '../controllers/withdraw.controller.js';

const withdrawRouter = express.Router();

// GET /api/withdraws - Get all withdraws (admin only)
withdrawRouter.get('/', WithdrawController.getAllWithdraws);

// POST /api/withdraws - Create new withdraw
withdrawRouter.post('/', WithdrawController.createWithdraw);

// GET /api/withdraws/:id - Get withdraw by ID
withdrawRouter.get('/:id', WithdrawController.getWithdrawById);

// PUT /api/withdraws/:id - Update withdraw
withdrawRouter.put('/:id', WithdrawController.updateWithdraw);

// DELETE /api/withdraws/:id - Delete withdraw
withdrawRouter.delete('/:id', WithdrawController.deleteWithdraw);

// GET /api/withdraws/user/:user_id - Get withdraws for specific user
withdrawRouter.get('/user/:user_id', WithdrawController.getUserWithdraws);

// GET /api/withdraws/user/:user_id/status/:status - Get withdraws by status for specific user
withdrawRouter.get('/user/:user_id/status/:status', WithdrawController.getUserWithdrawsByStatus);

export default withdrawRouter;