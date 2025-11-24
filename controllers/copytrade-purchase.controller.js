import CopytradePurchase from '../model/copytrade-purchase.model.js';
import User from '../model/user.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';
import { createNotification } from '../utils/notificationHelper.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
import CopytradePurchaseService from '../services/copytrade-purchase.service.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

class CopytradePurchaseController {
  static async createCopytradePurchase(req, res) {
    try {
      const {
        copytradeOptionId,
        initial_investment,
        trade_current_value,
        trade_profit_loss,
        trade_win_rate,
        trade_approval_date,
        trade_end_date
      } = req.body;

      // Get user ID from authenticated user (not from request body)
      const user = req.user?.userId;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User authentication required' });
      }

      logger.info('📝 Creating copytrade purchase', {
        userId: user,
        userEmail: req.user?.email,
        copytradeOptionId,
        initial_investment
      });

      // Validate required fields
      const required = ['copytradeOptionId', 'initial_investment'];
      for (const f of required) {
        if (req.body[f] === undefined || req.body[f] === null || req.body[f] === '') {
          logger.warn('⚠️ Missing required field for copytrade purchase', {
            field: f,
            userId: user
          });
          return res.status(400).json({ success: false, message: `${f} is required` });
        }
      }

      // Use MongoDB transaction for atomicity
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Create purchase (status: pending, no balance deduction)
        const result = await CopytradePurchaseService.createPurchase({
          user,
          copytradeOptionId,
          initial_investment,
          trade_current_value,
          trade_profit_loss,
          trade_win_rate,
          trade_approval_date,
          trade_end_date
        }, session);

        await session.commitTransaction();
        const saved = result.purchase;
      
        // Create notification for admin
        await createNotification({
          action: 'copytrade_purchase',
          userId: user,
          metadata: {
            amount: initial_investment,
            planName: saved.trade_title,
            referenceId: saved._id.toString()
          }
        });

        // Create audit log
        await createAuditLog(req, res, {
          action: 'copytrade_purchase_create',
          resourceType: 'copytrade_purchase',
          resourceId: saved._id.toString(),
          resourceName: saved.trade_title,
          description: `Created copytrade purchase: ${saved.trade_title} - $${saved.initial_investment}`
        });

        // Invalidate audit cache
        await invalidateAuditCache();

        logger.info('✅ Copytrade purchase created successfully (pending approval)', {
          purchaseId: saved._id,
          userId: user,
          userEmail: req.user?.email,
          trade_title: saved.trade_title,
          initial_investment: saved.initial_investment,
          status: saved.trade_status
        });
        
        res.status(201).json({ 
          success: true, 
          message: 'Copytrade purchase created successfully (pending approval)', 
          data: {
            purchase: saved,
            note: 'Balance will be deducted when admin approves (status changes to active)'
          }
        });
      } catch (error) {
        await session.abortTransaction();
        
        // Handle specific error types
        if (error.message === 'INSUFFICIENT_BALANCE_FOR_PURCHASE') {
          logger.warn('⚠️ Insufficient balance for copytrade purchase', {
            userId: user,
            error: error.message,
            data: error.data,
            userEmail: req.user?.email
          });
          return res.status(400).json({
            success: false,
            message: `User does not have sufficient balance. Minimum required: $${error.data.required}, Available: $${error.data.available}`,
            error: error.message,
            data: error.data
          });
        }

        if (error.message === 'INSUFFICIENT_FUNDS') {
          logger.warn('⚠️ Insufficient funds for copytrade purchase', {
            userId: user,
            error: error.message,
            data: error.data,
            userEmail: req.user?.email
          });
          return res.status(400).json({
            success: false,
            message: `Insufficient funds. Required: $${error.data.required}, Available: $${error.data.available}`,
            error: error.message,
            data: error.data
          });
        }

        if (error.message === 'INVESTMENT_BELOW_MINIMUM') {
          logger.warn('⚠️ Investment below minimum', {
            userId: user,
            error: error.message,
            data: error.data,
            userEmail: req.user?.email
          });
          return res.status(400).json({
            success: false,
            message: `Investment amount is below minimum. Minimum: $${error.data.minimum}, Provided: $${error.data.investment}`,
            error: error.message,
            data: error.data
          });
        }

        if (error.message === 'COPYTRADE_OPTION_NOT_FOUND') {
          logger.warn('⚠️ Copytrade option not found', {
            copytradeOptionId: req.body.copytradeOptionId,
            error: error.message,
            userId: user,
            userEmail: req.user?.email
          });
          return res.status(404).json({
            success: false,
            message: 'Copytrade option not found',
            error: error.message,
            data: error.data
          });
        }

        logger.error('❌ Error creating copytrade purchase', {
          error: error.message,
          userId: user,
          userEmail: req.user?.email,
          copytradeOptionId: req.body?.copytradeOptionId,
          stack: error.stack
        });
        console.error('Error creating copytrade purchase:', error);
        res.status(500).json({ success: false, message: 'Failed to create copytrade purchase', error: error.message });
      } finally {
        session.endSession();
      }
    } catch (error) {
      logger.error('❌ Unexpected error creating copytrade purchase', {
        error: error.message,
        stack: error.stack
      });
      console.error('Unexpected error creating copytrade purchase:', error);
      res.status(500).json({ success: false, message: 'Failed to create copytrade purchase', error: error.message });
    }
  }

  static async getAllCopytradePurchases(req, res) {
    try {
      logger.info('📊 Fetching all copytrade purchases', {
        adminUsername: req.admin?.username
      });

      const items = await CopytradePurchase.find().sort({ createdAt: -1 });

      // Create audit log
      await createAuditLog(req, res, {
        action: 'copytrade_purchase_view_all',
        resourceType: 'copytrade_purchase',
        description: `Admin ${req.admin?.username || 'unknown'} viewed all copytrade purchases (${items.length} purchases)`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrade purchases retrieved successfully', {
        adminUsername: req.admin?.username,
        count: items.length
      });

      res.json({ success: true, data: items, count: items.length });
    } catch (error) {
      logger.error('❌ Error fetching copytrade purchases', {
        error: error.message,
        adminId: req.admin?.id
      });
      console.error('Error fetching copytrade purchases:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrade purchases', error: error.message });
    }
  }

  static async getCopytradePurchaseById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const isAdmin = req.admin?.id;

      logger.info('🔍 Fetching copytrade purchase by ID', {
        purchaseId: id,
        userId: userId || undefined,
        adminId: isAdmin || undefined
      });

      const doc = await CopytradePurchase.findById(id);
      if (!doc) {
        logger.warn('⚠️ Copytrade purchase not found', {
          purchaseId: id,
          userId: userId || undefined,
          adminId: isAdmin || undefined
        });
        return res.status(404).json({ success: false, message: 'Copytrade purchase not found' });
      }

      // If user (not admin), verify they own this purchase
      if (userId && !isAdmin) {
        if (doc.user.toString() !== userId) {
          logger.warn('⚠️ User attempted to access another user\'s purchase', {
            purchaseId: id,
            userId,
            purchaseUserId: doc.user.toString()
          });
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      // Create audit log (only for admin)
      if (isAdmin) {
        await createAuditLog(req, res, {
          action: 'copytrade_purchase_viewed',
          resourceType: 'copytrade_purchase',
          resourceId: doc._id.toString(),
          resourceName: doc.trade_title,
          description: `Viewed copytrade purchase: ${doc.trade_title}`
        });

        // Invalidate audit cache
        await invalidateAuditCache();
      }

      logger.info('✅ Copytrade purchase retrieved successfully', {
        purchaseId: id,
        userId: userId || undefined,
        adminId: isAdmin || undefined,
        trade_title: doc.trade_title,
        trade_status: doc.trade_status
      });

      res.json({ success: true, data: doc });
    } catch (error) {
      logger.error('❌ Error fetching copytrade purchase', {
        error: error.message,
        purchaseId: req.params.id,
        userId: req.user?.userId,
        adminId: req.admin?.id
      });
      console.error('Error fetching copytrade purchase:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrade purchase', error: error.message });
    }
  }

  static async getMyCopytradePurchases(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User authentication required' });
      }
      const items = await CopytradePurchase.find({ user: userId }).sort({ createdAt: -1 });
      res.json({ success: true, data: items, count: items.length });
    } catch (error) {
      console.error('Error fetching user copytrade purchases:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrade purchases', error: error.message });
    }
  }

  static async getCopytradePurchasesByUser(req, res) {
    try {
      const { userId } = req.params;
      const validation = await validateUserExists(userId);
      if (!validation.ok) return res.status(validation.status).json({ success: false, message: validation.message });
      const items = await CopytradePurchase.find({ user: userId }).sort({ createdAt: -1 });
      res.json({ success: true, data: items, count: items.length });
    } catch (error) {
      console.error('Error fetching copytrade purchases for user:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrade purchases for user', error: error.message });
    }
  }

  static async updateCopytradePurchase(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      logger.info('📝 Updating copytrade purchase', {
        purchaseId: id,
        adminUsername: req.admin?.username,
        updates: Object.keys(updateData)
      });

      if (updateData.user) {
        const validation = await validateBodyUser(updateData.user);
        if (!validation.ok) {
          logger.warn('⚠️ User validation failed', {
            userId: updateData.user,
            error: validation.message,
            adminUsername: req.admin?.username
          });
          return res.status(validation.status).json({ success: false, message: validation.message });
        }
      }

      // Get old data before update
      const oldData = await CopytradePurchase.findById(id);
      if (!oldData) {
        logger.warn('⚠️ Copytrade purchase not found', {
          purchaseId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({ success: false, message: 'Copytrade purchase not found' });
      }

      // Handle status change from 'pending' to 'active' (approval)
      if (oldData.trade_status === 'pending' && updateData.trade_status === 'active') {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Approve purchase and deduct from portfolio
          const approvalResult = await CopytradePurchaseService.approvePurchase(
            oldData,
            req.admin?.username || 'unknown',
            session
          );

          await session.commitTransaction();

          logger.info('✅ Copytrade purchase approved with portfolio deduction', {
            purchaseId: id,
            adminUsername: req.admin?.username,
            deductions: approvalResult.deductions,
            newAccountBalance: approvalResult.newAccountBalance
          });

          // Create audit log
          await createAuditLog(req, res, {
            action: 'copytrade_purchase_approved',
            resourceType: 'copytrade_purchase',
            resourceId: oldData._id.toString(),
            resourceName: oldData.trade_title,
            description: `Approved copytrade purchase: ${oldData.trade_title} - $${oldData.initial_investment}`,
            metadata: {
              deductions: approvalResult.deductions,
              newAccountBalance: approvalResult.newAccountBalance
            }
          });

          await invalidateAuditCache();

          return res.json({
            success: true,
            message: 'Copytrade purchase approved successfully',
            data: {
              purchase: approvalResult.purchase,
              deductions: approvalResult.deductions,
              newAccountBalance: approvalResult.newAccountBalance
            }
          });
        } catch (error) {
          await session.abortTransaction();

          // Handle specific errors
          if (error.message === 'INSUFFICIENT_PORTFOLIO_VALUE') {
            logger.warn('⚠️ Insufficient portfolio value for copytrade purchase approval', {
              purchaseId: id,
              error: error.message,
              data: error.data,
              adminUsername: req.admin?.username
            });
            return res.status(400).json({
              success: false,
              message: `Insufficient portfolio value. Required: $${error.data.required}, Available: $${error.data.available}`,
              error: error.message,
              data: error.data
            });
          }

          if (error.message === 'NO_PORTFOLIO_ENTRIES') {
            logger.warn('⚠️ No portfolio entries for copytrade purchase approval', {
              purchaseId: id,
              error: error.message,
              adminUsername: req.admin?.username
            });
            return res.status(400).json({
              success: false,
              message: 'User has no portfolio entries',
              error: error.message
            });
          }

          logger.error('❌ Error approving copytrade purchase', {
            purchaseId: id,
            error: error.message,
            stack: error.stack,
            adminUsername: req.admin?.username
          });
          throw error;
        } finally {
          session.endSession();
        }
      }

      // Prevent changing status from 'active' back to 'pending' or other statuses
      if (oldData.trade_status === 'active' && updateData.trade_status && updateData.trade_status !== 'active') {
        logger.warn('⚠️ Attempted to change status of approved copytrade purchase', {
          purchaseId: id,
          currentStatus: oldData.trade_status,
          attemptedStatus: updateData.trade_status,
          adminUsername: req.admin?.username
        });
        return res.status(400).json({
          success: false,
          message: 'Cannot change status of an approved (active) copytrade purchase'
        });
      }

      if (updateData.trade_current_value !== undefined || updateData.initial_investment !== undefined) {
        logger.info('💰 Updating financial values', {
          purchaseId: id,
          adminUsername: req.admin?.username,
          oldCurrentValue: oldData.trade_current_value,
          newCurrentValue: updateData.trade_current_value,
          oldInvestment: oldData.initial_investment,
          newInvestment: updateData.initial_investment
        });

        Object.assign(oldData, updateData);
        await oldData.save();

        // Create audit log
        await createAuditLog(req, res, {
          action: 'copytrade_purchase_updated',
          resourceType: 'copytrade_purchase',
          resourceId: oldData._id.toString(),
          resourceName: oldData.trade_title,
          changes: {
            before: oldData.toObject(),
            after: oldData.toObject()
          },
          description: `Updated copytrade purchase: ${oldData.trade_title}`
        });

        // Invalidate audit cache
        await invalidateAuditCache();

        logger.info('✅ Copytrade purchase updated successfully (financial values)', {
          purchaseId: id,
          adminUsername: req.admin?.username,
          trade_title: oldData.trade_title,
          current_value: oldData.trade_current_value
        });

        return res.json({ success: true, message: 'Copytrade purchase updated successfully', data: oldData });
      }

      const updated = await CopytradePurchase.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

      // Create audit log
      await createAuditLog(req, res, {
        action: 'copytrade_purchase_updated',
        resourceType: 'copytrade_purchase',
        resourceId: updated._id.toString(),
        resourceName: updated.trade_title,
        changes: {
          before: oldData.toObject(),
          after: updated.toObject()
        },
        description: `Updated copytrade purchase: ${updated.trade_title}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrade purchase updated successfully', {
        purchaseId: id,
        adminUsername: req.admin?.username,
        trade_title: updated.trade_title,
        trade_status: updated.trade_status
      });

      res.json({ success: true, message: 'Copytrade purchase updated successfully', data: updated });
    } catch (error) {
      logger.error('❌ Error updating copytrade purchase', {
        error: error.message,
        purchaseId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error updating copytrade purchase:', error);
      res.status(500).json({ success: false, message: 'Failed to update copytrade purchase', error: error.message });
    }
  }

  static async deleteCopytradePurchase(req, res) {
    try {
      const { id } = req.params;

      logger.info('🗑️ Deleting copytrade purchase', {
        purchaseId: id,
        adminUsername: req.admin?.username
      });

      // Get purchase data before deletion for audit
      const purchaseToDelete = await CopytradePurchase.findById(id);
      if (!purchaseToDelete) {
        logger.warn('⚠️ Copytrade purchase not found for deletion', {
          purchaseId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({ success: false, message: 'Copytrade purchase not found' });
      }

      const deleted = await CopytradePurchase.findByIdAndDelete(id);

      // Create audit log
      await createAuditLog(req, res, {
        action: 'copytrade_purchase_deleted',
        resourceType: 'copytrade_purchase',
        resourceId: deleted._id.toString(),
        resourceName: deleted.trade_title,
        deletedData: purchaseToDelete.toObject(),
        description: `Deleted copytrade purchase: ${deleted.trade_title}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrade purchase deleted successfully', {
        purchaseId: id,
        adminUsername: req.admin?.username,
        trade_title: deleted.trade_title,
        initial_investment: deleted.initial_investment
      });

      res.json({ success: true, message: 'Copytrade purchase deleted successfully', data: deleted });
    } catch (error) {
      logger.error('❌ Error deleting copytrade purchase', {
        error: error.message,
        purchaseId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error deleting copytrade purchase:', error);
      res.status(500).json({ success: false, message: 'Failed to delete copytrade purchase', error: error.message });
    }
  }

  // Admin: Create copytrade purchase on behalf of a user
  static async createCopytradePurchaseForUser(req, res) {
    try {
      const {
        userId,
        copytradeOptionId,
        initial_investment,
        autoApprove
      } = req.body;

      logger.info('📝 Admin creating copytrade purchase for user', {
        adminUsername: req.admin?.username,
        adminId: req.admin?.id,
        userId,
        copytradeOptionId,
        initial_investment
      });

      // Validate required fields
      if (!userId || !copytradeOptionId || !initial_investment) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: userId, copytradeOptionId, initial_investment'
        });
      }

      // Validate user exists and is not an admin
      const userValidation = await validateBodyUser(userId);
      if (!userValidation.ok) {
        return res.status(userValidation.status).json({ 
          success: false, 
          message: userValidation.message 
        });
      }

      // Check that user is not an admin
      const userDoc = await User.findById(userId).select('role email');
      if (!userDoc) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      if (userDoc.role === 'admin') {
        logger.warn('⚠️ Admin attempted to create copytrade purchase for another admin', {
          adminUsername: req.admin?.username,
          targetUserId: userId
        });
        return res.status(403).json({ 
          success: false, 
          message: 'Cannot create copytrade purchases for admin users' 
        });
      }

      // Use MongoDB transaction for atomicity
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Create purchase (status: pending, no balance deduction)
        const result = await CopytradePurchaseService.createPurchase({
          user: userId,
          copytradeOptionId,
          initial_investment
        }, session);

        const saved = result.purchase;

        // If autoApprove is true, approve the purchase immediately
        if (autoApprove === true) {
          const approvalResult = await CopytradePurchaseService.approvePurchase(
            saved,
            req.admin?.username,
            session
          );

          await session.commitTransaction();

          // Create audit log
          await createAuditLog(req, res, {
            action: 'admin_copytrade_purchase_created_approved',
            resourceType: 'copytrade_purchase',
            resourceId: saved._id.toString(),
            resourceName: saved.trade_title,
            changes: {
              before: { status: 'pending' },
              after: { 
                status: 'active',
                initialInvestment: saved.initial_investment,
                userBalance: approvalResult.newAccountBalance
              }
            },
            description: `Admin ${req.admin?.username} created and approved copytrade purchase: ${saved.trade_title} - $${saved.initial_investment} for user ${userDoc.email}`
          });

          await invalidateAuditCache();

          // Create notification for user
          await createNotification({
            action: 'copytrade_purchase',
            userId: userId,
            metadata: {
              amount: initial_investment,
              planName: saved.trade_title,
              referenceId: saved._id.toString(),
              adminCreated: true
            }
          });

          logger.info('✅ Admin created and approved copytrade purchase successfully', {
            adminUsername: req.admin?.username,
            purchaseId: saved._id,
            userId,
            userEmail: userDoc.email,
            trade_title: saved.trade_title,
            initial_investment: saved.initial_investment
          });

          return res.status(201).json({
            success: true,
            message: 'Copytrade purchase created and approved successfully',
            data: {
              purchase: saved,
              deductions: approvalResult.deductions,
              newAccountBalance: approvalResult.newAccountBalance
            }
          });
        } else {
          await session.commitTransaction();

          // Create audit log for creation only
          await createAuditLog(req, res, {
            action: 'admin_copytrade_purchase_created',
            resourceType: 'copytrade_purchase',
            resourceId: saved._id.toString(),
            resourceName: saved.trade_title,
            description: `Admin ${req.admin?.username} created copytrade purchase: ${saved.trade_title} - $${saved.initial_investment} for user ${userDoc.email} (pending approval)`
          });

          await invalidateAuditCache();

          // Create notification for user
          await createNotification({
            action: 'copytrade_purchase',
            userId: userId,
            metadata: {
              amount: initial_investment,
              planName: saved.trade_title,
              referenceId: saved._id.toString(),
              adminCreated: true
            }
          });

          logger.info('✅ Admin created copytrade purchase successfully (pending approval)', {
            adminUsername: req.admin?.username,
            purchaseId: saved._id,
            userId,
            userEmail: userDoc.email,
            trade_title: saved.trade_title,
            initial_investment: saved.initial_investment
          });

          return res.status(201).json({
            success: true,
            message: 'Copytrade purchase created successfully (pending approval)',
            data: {
              purchase: saved,
              note: 'Balance will be deducted when admin approves (status changes to active)'
            }
          });
        }
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      logger.error('❌ Error creating copytrade purchase for user', {
        error: error.message,
        stack: error.stack,
        adminId: req.admin?.id,
        userId: req.body.userId
      });

      // Handle specific error types
      if (error.message === 'INSUFFICIENT_BALANCE_FOR_PURCHASE') {
        return res.status(400).json({
          success: false,
          message: `User does not have sufficient balance. Minimum required: $${error.data.required}, Available: $${error.data.available}`,
          error: error.message,
          data: error.data
        });
      }

      if (error.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. Required: $${error.data.required}, Available: $${error.data.available}`,
          error: error.message,
          data: error.data
        });
      }

      if (error.message === 'INVESTMENT_BELOW_MINIMUM') {
        return res.status(400).json({
          success: false,
          message: `Investment amount is below the minimum required. Minimum: $${error.data.minimum}, Provided: $${error.data.investment}`,
          error: error.message,
          data: error.data
        });
      }

      if (error.message === 'COPYTRADE_OPTION_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: 'Copytrade option not found',
          error: error.message,
          data: error.data
        });
      }

      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: error.message
        });
      }

      if (error.message === 'NO_PORTFOLIO_ENTRIES') {
        return res.status(400).json({
          success: false,
          message: 'User has no portfolio entries to deduct from',
          error: error.message,
          data: error.data
        });
      }

      if (error.message === 'INSUFFICIENT_PORTFOLIO_VALUE') {
        return res.status(400).json({
          success: false,
          message: `Insufficient portfolio value. Required: $${error.data.required}, Available: $${error.data.available}`,
          error: error.message,
          data: error.data
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create copytrade purchase',
        error: error.message
      });
    }
  }
}

export default CopytradePurchaseController;
