import express from 'express';
import DepositController from '../controllers/deposit.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import { requireKycApproved } from '../middlewares/kyc.middleware.js';
import { requireUserOrAdminAuth } from '../middlewares/user-or-admin-auth.middleware.js';

const depositRouter = express.Router();

depositRouter.get('/', requireAdminAuth, DepositController.getAllDeposits);
depositRouter.post('/admin', requireAdminAuth, DepositController.createDepositForUser);

depositRouter.post('/', requireUserAuth, requireKycApproved, DepositController.createDeposit);

// Static path segments before :id
depositRouter.get('/user/:userId', requireUserOrAdminAuth, DepositController.getUserDeposits);
depositRouter.get(
  '/user/:userId/status/:status',
  requireUserOrAdminAuth,
  DepositController.getUserDepositsByStatus
);

depositRouter.get('/:id', requireUserOrAdminAuth, DepositController.getDepositById);
depositRouter.put('/:id', requireAdminAuth, DepositController.updateDeposit);
depositRouter.delete('/:id', requireAdminAuth, DepositController.deleteDeposit);

export default depositRouter;
