import { Router } from 'express';
import CopytradePurchaseController from '../controllers/copytrade-purchase.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', CopytradePurchaseController.createCopytradePurchase);
router.get('/', requireAdminAuth, CopytradePurchaseController.getAllCopytradePurchases);  // Admin only - get all purchases
router.get('/user/:userId', CopytradePurchaseController.getCopytradePurchasesByUser);
router.get('/:id', CopytradePurchaseController.getCopytradePurchaseById);
router.put('/:id', requireAdminAuth, CopytradePurchaseController.updateCopytradePurchase);
router.delete('/:id', requireAdminAuth, CopytradePurchaseController.deleteCopytradePurchase);  // Admin only

export default router;
