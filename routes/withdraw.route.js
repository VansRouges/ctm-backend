import express from 'express';
import WithdrawController from '../controllers/withdraw.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import { requireKycApproved } from '../middlewares/kyc.middleware.js';
import { requireUserOrAdminAuth } from '../middlewares/user-or-admin-auth.middleware.js';

const withdrawRouter = express.Router();

withdrawRouter.get('/', requireAdminAuth, WithdrawController.getAllWithdraws);
withdrawRouter.post('/admin', requireAdminAuth, WithdrawController.createWithdrawForUser);

withdrawRouter.post('/', requireUserAuth, requireKycApproved, WithdrawController.createWithdraw);

withdrawRouter.get('/user/:userId', requireUserOrAdminAuth, WithdrawController.getUserWithdraws);
withdrawRouter.get(
  '/user/:userId/status/:status',
  requireUserOrAdminAuth,
  WithdrawController.getUserWithdrawsByStatus
);

withdrawRouter.get('/:id', requireUserOrAdminAuth, WithdrawController.getWithdrawById);
withdrawRouter.put('/:id', requireAdminAuth, WithdrawController.updateWithdraw);
withdrawRouter.delete('/:id', requireAdminAuth, WithdrawController.deleteWithdraw);

export default withdrawRouter;
