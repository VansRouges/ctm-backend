import { Router } from 'express';
import CopytradePurchaseController from '../controllers/copytrade-purchase.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import { requireKycApproved } from '../middlewares/kyc.middleware.js';

const router = Router();

// Admin endpoints (must come before user endpoints to avoid route conflicts)
router.post('/admin', requireAdminAuth, CopytradePurchaseController.createCopytradePurchaseForUser);
router.post('/:id/end', requireAdminAuth, CopytradePurchaseController.endCopytradePurchase);
router.get('/', requireAdminAuth, CopytradePurchaseController.getAllCopytradePurchases);

// User endpoints
router.post('/', requireUserAuth, requireKycApproved, CopytradePurchaseController.createCopytradePurchase);
router.get('/my-purchases', requireUserAuth, CopytradePurchaseController.getMyCopytradePurchases);
router.get('/:id', requireUserAuth, CopytradePurchaseController.getCopytradePurchaseById);
router.get('/user/:userId', requireUserAuth, CopytradePurchaseController.getCopytradePurchasesByUser);
router.put('/:id', requireAdminAuth, CopytradePurchaseController.updateCopytradePurchase);
router.delete('/:id', requireAdminAuth, CopytradePurchaseController.deleteCopytradePurchase);

export default router;
