import { Router } from 'express';
import CopytradePurchaseController from '../controllers/copytrade-purchase.controller.js';

const router = Router();

router.post('/', CopytradePurchaseController.createCopytradePurchase);
router.get('/', CopytradePurchaseController.getAllCopytradePurchases);
router.get('/user/:userId', CopytradePurchaseController.getCopytradePurchasesByUser);
router.get('/:id', CopytradePurchaseController.getCopytradePurchaseById);
router.put('/:id', CopytradePurchaseController.updateCopytradePurchase);
router.delete('/:id', CopytradePurchaseController.deleteCopytradePurchase);

export default router;
