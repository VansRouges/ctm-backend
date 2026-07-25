import { Router } from 'express';
import StockPurchaseController from '../controllers/stock-purchase.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';

const router = Router();

// Admin endpoints (before parameterized routes)
router.get('/', requireAdminAuth, StockPurchaseController.getAllStockPurchases);
router.put('/:id/approve', requireAdminAuth, StockPurchaseController.approveStockPurchase);
router.put('/:id/settle-liquidation', requireAdminAuth, StockPurchaseController.settleLiquidation);
router.put('/:id/reject', requireAdminAuth, StockPurchaseController.rejectStockPurchase);

// User endpoints
router.post('/', requireUserAuth, StockPurchaseController.createStockPurchase);
router.get('/my-purchases', requireUserAuth, StockPurchaseController.getMyStockPurchases);
router.get('/:id', requireUserAuth, StockPurchaseController.getStockPurchaseById);
router.post('/:id/request-liquidation', requireUserAuth, StockPurchaseController.requestLiquidation);

export default router;
