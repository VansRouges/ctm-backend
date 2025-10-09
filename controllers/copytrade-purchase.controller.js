import CopytradePurchase from '../model/copytrade-purchase.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';
import { createNotification } from '../utils/notificationHelper.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
import logger from '../utils/logger.js';

class CopytradePurchaseController {
  static async createCopytradePurchase(req, res) {
    try {
      const {
        user,
        trade_title,
        trade_max,
        trade_min,
        trade_risk,
        trade_roi_min,
        trade_roi_max,
        trade_duration,
        initial_investment,
        trade_current_value,
        trade_profit_loss,
        trade_status,
        trade_token,
        trade_token_address,
        trade_win_rate,
        trade_approval_date,
        trade_end_date
      } = req.body;

      logger.info('📝 Creating copytrade purchase', {
        adminUsername: req.admin?.username,
        trade_title,
        user,
        initial_investment,
        trade_token
      });

      const required = [ 'user','trade_title','trade_max','trade_min','trade_risk','trade_roi_min','trade_roi_max','trade_duration','initial_investment','trade_current_value','trade_token','trade_token_address' ];
      for (const f of required) {
        if (req.body[f] === undefined || req.body[f] === null || req.body[f] === '') {
          logger.warn('⚠️ Missing required field for copytrade purchase', {
            field: f,
            adminUsername: req.admin?.username
          });
          return res.status(400).json({ success: false, message: `${f} is required` });
        }
      }

      const validation = await validateBodyUser(user);
      if (!validation.ok) {
        logger.warn('⚠️ User validation failed', {
          userId: user,
          error: validation.message,
          adminUsername: req.admin?.username
        });
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const doc = new CopytradePurchase({
        user,
        trade_title,
        trade_max,
        trade_min,
        trade_risk,
        trade_roi_min,
        trade_roi_max,
        trade_duration,
        initial_investment,
        trade_current_value,
        trade_profit_loss: trade_profit_loss !== undefined ? trade_profit_loss : trade_current_value - initial_investment,
        trade_status: trade_status || 'active',
        trade_token,
        trade_token_address,
        trade_win_rate,
        trade_approval_date,
        trade_end_date
      });

      const saved = await doc.save();
      
      // Create notification for admin
      await createNotification({
        action: 'copytrade_purchase',
        userId: user,
        metadata: {
          amount: initial_investment,
          currency: trade_token,
          planName: trade_title,
          referenceId: saved._id.toString()
        }
      });

      // // Create audit log
      // await createAuditLog(req, res, {
      //   action: 'copytrade_purchase_create',
      //   resourceType: 'copytrade_purchase',
      //   resourceId: saved._id.toString(),
      //   resourceName: saved.trade_title,
      //   description: `Created copytrade purchase: ${saved.trade_title} - ${saved.initial_investment} ${saved.trade_token}`
      // });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrade purchase created successfully', {
        purchaseId: saved._id,
        adminUsername: req.admin?.username,
        trade_title: saved.trade_title,
        initial_investment: saved.initial_investment,
        trade_token: saved.trade_token
      });
      
      res.status(201).json({ success: true, message: 'Copytrade purchase created successfully', data: saved });
    } catch (error) {
      logger.error('❌ Error creating copytrade purchase', {
        error: error.message,
        adminId: req.admin?.id,
        trade_title: req.body?.trade_title
      });
      console.error('Error creating copytrade purchase:', error);
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

      logger.info('🔍 Fetching copytrade purchase by ID', {
        purchaseId: id,
        adminUsername: req.admin?.username
      });

      const doc = await CopytradePurchase.findById(id);
      if (!doc) {
        logger.warn('⚠️ Copytrade purchase not found', {
          purchaseId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({ success: false, message: 'Copytrade purchase not found' });
      }

      // Create audit log
      await createAuditLog(req, res, {
        action: 'copytrade_purchase_viewed',
        resourceType: 'copytrade_purchase',
        resourceId: doc._id.toString(),
        resourceName: doc.trade_title,
        description: `Viewed copytrade purchase: ${doc.trade_title}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrade purchase retrieved successfully', {
        purchaseId: id,
        adminUsername: req.admin?.username,
        trade_title: doc.trade_title,
        trade_status: doc.trade_status
      });

      res.json({ success: true, data: doc });
    } catch (error) {
      logger.error('❌ Error fetching copytrade purchase', {
        error: error.message,
        purchaseId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error fetching copytrade purchase:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrade purchase', error: error.message });
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
        initial_investment: deleted.initial_investment,
        trade_token: deleted.trade_token
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
}

export default CopytradePurchaseController;
