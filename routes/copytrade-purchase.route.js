import { Router } from 'express';
import CopytradePurchaseController from '../controllers/copytrade-purchase.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';

const router = Router();

// Admin endpoints (must come before user endpoints to avoid route conflicts)
router.post('/admin', requireAdminAuth, CopytradePurchaseController.createCopytradePurchaseForUser);  // Admin - create purchase for user
router.get('/', requireAdminAuth, CopytradePurchaseController.getAllCopytradePurchases);  // Admin - get all purchases

// User endpoints
router.post('/', requireUserAuth, CopytradePurchaseController.createCopytradePurchase);  // User creates purchase
router.get('/my-purchases', requireUserAuth, CopytradePurchaseController.getMyCopytradePurchases);  // User gets their purchases
router.get('/:id', requireUserAuth, CopytradePurchaseController.getCopytradePurchaseById);  // User gets their purchase by ID
router.get('/user/:userId', requireUserAuth, CopytradePurchaseController.getCopytradePurchasesByUser);  // Admin - get user's purchases
router.put('/:id', requireAdminAuth, CopytradePurchaseController.updateCopytradePurchase);  // Admin - approve/update purchase
router.delete('/:id', requireAdminAuth, CopytradePurchaseController.deleteCopytradePurchase);  // Admin - delete purchase

export default router;
