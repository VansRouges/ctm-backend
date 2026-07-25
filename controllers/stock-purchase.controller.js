import mongoose from 'mongoose';
import StockPurchase from '../model/stock-purchase.model.js';
import StockPurchaseService from '../services/stock-purchase.service.js';
import { createNotification } from '../utils/notificationHelper.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
import { notifyStockPurchaseSubmitted } from '../utils/emailService.js';
import logger from '../utils/logger.js';

class StockPurchaseController {
  static async createStockPurchase(req, res) {
    try {
      const user = req.user?.userId;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User authentication required' });
      }

      const { symbol, quantity } = req.body;
      if (!symbol) {
        return res.status(400).json({ success: false, message: 'symbol is required' });
      }
      if (quantity === undefined || quantity === null || Number(quantity) <= 0) {
        return res.status(400).json({ success: false, message: 'quantity must be greater than 0' });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const result = await StockPurchaseService.createPurchase(
          { user, symbol, quantity: Number(quantity) },
          session
        );
        await session.commitTransaction();

        await createNotification({
          action: 'stock_purchase',
          userId: user,
          metadata: {
            amount: result.purchase.initial_investment,
            planName: `${result.purchase.symbol} x ${result.purchase.quantity}`,
            referenceId: result.purchase._id.toString()
          }
        }).catch(() => {});

        await createAuditLog(req, res, {
          action: 'stock_purchase_create',
          resourceType: 'stock_purchase',
          resourceId: result.purchase._id.toString(),
          resourceName: result.purchase.symbol,
          description: `Stock purchase activated: ${result.purchase.quantity} ${result.purchase.symbol} ($${result.purchase.initial_investment})`
        });
        await invalidateAuditCache();

        // User confirmation email (non-blocking)
        notifyStockPurchaseSubmitted(user, result.purchase).catch(() => {});

        return res.status(201).json({
          success: true,
          message: 'Stock purchase completed successfully',
          data: {
            purchase: result.purchase,
            deductions: result.deductions,
            newAccountBalance: result.newAccountBalance
          }
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      logger.error('❌ Create stock purchase failed', { error: error.message });

      if (error.message === 'STOCK_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Stock not found', data: error.data });
      }
      if (error.message === 'INSUFFICIENT_FUNDS' || error.message === 'INSUFFICIENT_PORTFOLIO') {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. Required: $${error.data?.required}, Available: $${error.data?.available}`,
          data: error.data
        });
      }
      if (error.message === 'NO_PORTFOLIO_ENTRIES') {
        return res.status(400).json({
          success: false,
          message: 'No portfolio balance available to fund this purchase. Please deposit first.',
          data: error.data
        });
      }
      if (error.message === 'INVALID_QUANTITY') {
        return res.status(400).json({ success: false, message: 'Invalid quantity' });
      }

      return res.status(500).json({ success: false, message: 'Failed to create stock purchase' });
    }
  }

  static async getMyStockPurchases(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User authentication required' });
      }

      const purchases = await StockPurchase.find({ user: userId }).sort({ createdAt: -1 });
      const enriched = await StockPurchaseService.withMarkToMarket(purchases);

      return res.status(200).json({
        success: true,
        data: enriched,
        count: enriched.length
      });
    } catch (error) {
      logger.error('❌ Get my stock purchases failed', { error: error.message });
      return res.status(500).json({ success: false, message: 'Failed to fetch stock purchases' });
    }
  }

  static async getStockPurchaseById(req, res) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const purchase = await StockPurchase.findById(id);
      if (!purchase) {
        return res.status(404).json({ success: false, message: 'Stock purchase not found' });
      }
      if (purchase.user.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const [enriched] = await StockPurchaseService.withMarkToMarket(purchase);
      return res.status(200).json({ success: true, data: enriched });
    } catch (error) {
      logger.error('❌ Get stock purchase failed', { error: error.message });
      return res.status(500).json({ success: false, message: 'Failed to fetch stock purchase' });
    }
  }

  static async requestLiquidation(req, res) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const purchase = await StockPurchase.findById(id);
      if (!purchase) {
        return res.status(404).json({ success: false, message: 'Stock purchase not found' });
      }

      const result = await StockPurchaseService.requestLiquidation(purchase, userId);

      await createNotification({
        action: 'stock_purchase',
        userId,
        metadata: {
          amount: purchase.initial_investment,
          planName: `Liquidate ${purchase.symbol}`,
          referenceId: purchase._id.toString()
        }
      }).catch(() => {});

      await createAuditLog(req, res, {
        action: 'stock_liquidation_request',
        resourceType: 'stock_purchase',
        resourceId: purchase._id.toString(),
        resourceName: purchase.symbol,
        description: `User requested liquidation of ${purchase.quantity} ${purchase.symbol}`
      });
      await invalidateAuditCache();

      return res.status(200).json({
        success: true,
        message: 'Liquidation requested — pending admin approval',
        data: { purchase: result.purchase }
      });
    } catch (error) {
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (error.message === 'INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          message: `Cannot request liquidation. Current status: ${error.data?.currentStatus}`
        });
      }
      logger.error('❌ Request liquidation failed', { error: error.message });
      return res.status(500).json({ success: false, message: 'Failed to request liquidation' });
    }
  }

  static async getAllStockPurchases(req, res) {
    try {
      const { status } = req.query;
      const filter = {};
      if (status) filter.stock_status = status;

      const purchases = await StockPurchase.find(filter)
        .populate('user', 'email fullName firstName lastName')
        .sort({ createdAt: -1 });

      const enriched = await StockPurchaseService.withMarkToMarket(purchases);

      return res.status(200).json({
        success: true,
        data: enriched,
        count: enriched.length
      });
    } catch (error) {
      logger.error('❌ Get all stock purchases failed', { error: error.message });
      return res.status(500).json({ success: false, message: 'Failed to fetch stock purchases' });
    }
  }

  static async approveStockPurchase(req, res) {
    try {
      const { id } = req.params;
      const adminUsername = req.admin?.username || 'admin';

      const purchase = await StockPurchase.findById(id);
      if (!purchase) {
        return res.status(404).json({ success: false, message: 'Stock purchase not found' });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const result = await StockPurchaseService.approvePurchase(purchase, adminUsername, session);
        await session.commitTransaction();

        await createAuditLog(req, res, {
          action: 'stock_purchase_approve',
          resourceType: 'stock_purchase',
          resourceId: purchase._id.toString(),
          resourceName: purchase.symbol,
          description: `Approved stock purchase: ${purchase.quantity} ${purchase.symbol}`
        });
        await invalidateAuditCache();

        const [enriched] = await StockPurchaseService.withMarkToMarket(result.purchase);
        return res.status(200).json({
          success: true,
          message: 'Stock purchase approved',
          data: { purchase: enriched, deductions: result.deductions }
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      if (error.message === 'INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          message: `Cannot approve. Current status: ${error.data?.currentStatus}`
        });
      }
      if (error.message === 'NO_PORTFOLIO_ENTRIES' || error.message === 'INSUFFICIENT_PORTFOLIO') {
        return res.status(400).json({
          success: false,
          message: 'User does not have sufficient portfolio balance to fund this purchase',
          data: error.data
        });
      }
      logger.error('❌ Approve stock purchase failed', { error: error.message });
      return res.status(500).json({ success: false, message: 'Failed to approve stock purchase' });
    }
  }

  static async settleLiquidation(req, res) {
    try {
      const { id } = req.params;
      const { finalValue, isProfit } = req.body;
      const adminUsername = req.admin?.username || 'admin';

      if (finalValue === undefined || finalValue === null) {
        return res.status(400).json({ success: false, message: 'finalValue is required' });
      }

      const purchase = await StockPurchase.findById(id);
      if (!purchase) {
        return res.status(404).json({ success: false, message: 'Stock purchase not found' });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const result = await StockPurchaseService.settleLiquidation(
          purchase,
          { finalValue: Number(finalValue), isProfit },
          adminUsername,
          session
        );
        await session.commitTransaction();

        await createAuditLog(req, res, {
          action: 'stock_liquidation_settle',
          resourceType: 'stock_purchase',
          resourceId: purchase._id.toString(),
          resourceName: purchase.symbol,
          description: `Settled liquidation of ${purchase.symbol} for $${finalValue} (isProfit=${isProfit})`
        });
        await invalidateAuditCache();

        const [enriched] = await StockPurchaseService.withMarkToMarket(result.purchase);
        return res.status(200).json({
          success: true,
          message: 'Liquidation settled — USDT credited to user',
          data: { purchase: enriched, balanceUpdate: result.balanceUpdate }
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      if (error.message === 'INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          message: `Cannot settle. Current status: ${error.data?.currentStatus}`
        });
      }
      if (error.message === 'INVALID_FINAL_VALUE') {
        return res.status(400).json({ success: false, message: 'Invalid finalValue' });
      }
      logger.error('❌ Settle liquidation failed', { error: error.message });
      return res.status(500).json({ success: false, message: 'Failed to settle liquidation' });
    }
  }

  static async rejectStockPurchase(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminUsername = req.admin?.username || 'admin';

      const purchase = await StockPurchase.findById(id);
      if (!purchase) {
        return res.status(404).json({ success: false, message: 'Stock purchase not found' });
      }

      const result = await StockPurchaseService.rejectPurchase(purchase, adminUsername, reason);

      await createAuditLog(req, res, {
        action: 'stock_purchase_reject',
        resourceType: 'stock_purchase',
        resourceId: purchase._id.toString(),
        resourceName: purchase.symbol,
        description: `Rejected stock purchase/liquidation: ${purchase.symbol}`
      });
      await invalidateAuditCache();

      return res.status(200).json({
        success: true,
        message: 'Request rejected',
        data: { purchase: result.purchase }
      });
    } catch (error) {
      if (error.message === 'INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          message: `Cannot reject. Current status: ${error.data?.currentStatus}`
        });
      }
      logger.error('❌ Reject stock purchase failed', { error: error.message });
      return res.status(500).json({ success: false, message: 'Failed to reject stock purchase' });
    }
  }
}

export default StockPurchaseController;
