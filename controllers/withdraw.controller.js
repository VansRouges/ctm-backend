import Transaction from '../model/transaction.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';
import User from '../model/user.model.js';
import { getTokenPrice } from '../utils/priceService.js';
import { createNotification } from '../utils/notificationHelper.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

class WithdrawController {
  // Get all withdraws for a specific user
  static async getUserWithdraws(req, res) {
    try {
      const { userId } = req.params;

      const validation = await validateUserExists(userId);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const withdraws = await Transaction.find({
        user: userId,
        isWithdraw: true
      }).sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: withdraws,
        count: withdraws.length
      });
    } catch (error) {
      console.error('Error fetching user withdraws:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch withdraws',
        error: error.message
      });
    }
  }

  // Get all withdraws (admin only)
  static async getAllWithdraws(req, res) {
    try {
      logger.info('💸 Fetching all withdrawals', {
        adminUsername: req.admin?.username
      });

      const withdraws = await Transaction.find({ 
        isWithdraw: true 
      }).sort({ createdAt: -1 });

      // Create audit log
      await createAuditLog(req, res, {
        action: 'withdrawals_view_all',
        resourceType: 'withdraw',
        description: `Admin ${req.admin?.username || 'unknown'} viewed all withdrawals (${withdraws.length} withdrawals)`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Withdrawals retrieved successfully', {
        adminUsername: req.admin?.username,
        count: withdraws.length
      });
      
      res.json({
        success: true,
        data: withdraws,
        count: withdraws.length
      });
    } catch (error) {
      logger.error('❌ Error fetching withdrawals', {
        error: error.message,
        adminId: req.admin?.id
      });
      console.error('Error fetching all withdraws:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch withdraws',
        error: error.message
      });
    }
  }

  // Create new withdraw
  static async createWithdraw(req, res) {
    try {
      const { token_name, amount, token_withdraw_address, user, status } = req.body;

      // Validate required fields
      if (!token_name || !amount || !user) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: token_name, amount, user_id'
        });
      }

      const validation = await validateBodyUser(user);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const withdraw = new Transaction({
        token_name,
        isWithdraw: true,
        isDeposit: false,
        amount,
        token_withdraw_address,
        user,
        status: status || 'pending'
      });

      const savedWithdraw = await withdraw.save();

      // Create notification for admin
      await createNotification({
        action: 'withdraw',
        userId: user,
        metadata: {
          amount,
          currency: token_name,
          referenceId: savedWithdraw._id.toString()
        }
      });

      res.status(201).json({
        success: true,
        message: 'Withdraw created successfully',
        data: savedWithdraw
      });
    } catch (error) {
      console.error('Error creating withdraw:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create withdraw',
        error: error.message
      });
    }
  }

  // Update withdraw
  static async updateWithdraw(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      logger.info('📝 Updating withdrawal', {
        withdrawalId: id,
        adminUsername: req.admin?.username,
        updates: Object.keys(updateData)
      });

      // Force flags
      updateData.isWithdraw = true;
      updateData.isDeposit = false;

      const existing = await Transaction.findOne({ _id: id, isWithdraw: true });
      if (!existing) {
        logger.warn('⚠️ Withdrawal not found', {
          withdrawalId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({ success: false, message: 'Withdraw not found' });
      }

      // If user field is being updated, validate it exists
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

      const prevStatus = existing.status;

      // Prevent editing amount/token once already approved
      if (prevStatus === 'approved') {
        const amountChange = updateData.amount !== undefined && updateData.amount !== existing.amount;
        const tokenChange = updateData.token_name && updateData.token_name !== existing.token_name;
        if (amountChange || tokenChange) {
          logger.warn('⚠️ Cannot modify approved withdrawal', {
            withdrawalId: id,
            adminUsername: req.admin?.username,
            currentStatus: prevStatus
          });
          return res.status(400).json({ success: false, message: 'Cannot modify amount or token_name after approval' });
        }
      }

      if (updateData.status) existing.status = updateData.status;
      if (prevStatus !== 'approved') { // editable only before approval
        if (updateData.amount !== undefined) existing.amount = updateData.amount;
        if (updateData.token_name) existing.token_name = updateData.token_name;
      }
      if (updateData.token_withdraw_address) existing.token_withdraw_address = updateData.token_withdraw_address;

      // Only act on transition to approved
      const approving = prevStatus !== 'approved' && existing.status === 'approved';

      if (approving) {
        logger.info('✅ Approving withdrawal', {
          withdrawalId: id,
          adminUsername: req.admin?.username,
          amount: existing.amount,
          token: existing.token_name
        });

        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const price = await getTokenPrice(existing.token_name);
            const usdValue = Number((price * existing.amount).toFixed(8));
            const userDoc = await User.findById(existing.user).select('totalInvestment').session(session);
            if (!userDoc) throw new Error('USER_NOT_FOUND');
            const currentTI = userDoc.totalInvestment || 0;
            if (currentTI <= 0 || currentTI < usdValue) throw new Error('INSUFFICIENT_FUNDS');

            // Persist snapshot fields ONLY if not already set
            if (!existing.usdValue) {
              existing.tokenPriceAtApproval = Number(price);
              existing.usdValue = usdValue;
              existing.approvedAt = new Date();
            }

            userDoc.totalInvestment = Number((currentTI - usdValue).toFixed(8));
            await userDoc.save({ session });
            await existing.save({ session });
            existing.usdValue = usdValue;

            logger.info('💰 Withdrawal approved and funds deducted', {
              withdrawalId: id,
              adminUsername: req.admin?.username,
              usdValueDeducted: usdValue,
              remainingBalance: userDoc.totalInvestment
            });
          });
        } catch (err) {
          session.endSession();
          if (err.message === 'USER_NOT_FOUND') {
            logger.error('❌ User not found for withdrawal approval', {
              withdrawalId: id,
              userId: existing.user,
              adminUsername: req.admin?.username
            });
            return res.status(404).json({ success: false, message: 'User not found for transaction' });
          }
          if (err.message === 'INSUFFICIENT_FUNDS') {
            logger.error('❌ Insufficient funds for withdrawal approval', {
              withdrawalId: id,
              adminUsername: req.admin?.username,
              requestedAmount: existing.amount,
              token: existing.token_name
            });
            return res.status(400).json({ success: false, message: 'Insufficient totalInvestment to approve this withdraw' });
          }
          if (err.response || err.message?.toLowerCase().includes('price')) {
            logger.error('❌ Price service error during withdrawal approval', {
              error: err.message,
              withdrawalId: id,
              token: existing.token_name
            });
            return res.status(502).json({ success: false, message: 'Failed to fetch token price', error: err.message });
          }
          logger.error('❌ Transaction error during withdrawal approval', {
            error: err.message,
            withdrawalId: id,
            adminUsername: req.admin?.username
          });
          return res.status(500).json({ success: false, message: 'Failed during approval transaction', error: err.message });
        } finally {
          session.endSession();
        }
      } else {
        await existing.save();
      }

      // Create audit log for withdraw update
      const statusChanged = prevStatus !== existing.status;
      const actionType = statusChanged ? 'withdraw_status_changed' : 'withdraw_updated';
      
      await createAuditLog(req, res, {
        action: actionType,
        resourceType: 'withdraw',
        resourceId: existing._id.toString(),
        resourceName: `${existing.token_name} withdrawal - ${existing.amount}`,
        changes: {
          before: { 
            status: prevStatus,
            amount: req.body.amount !== undefined ? (existing.amount - (req.body.amount - existing.amount)) : existing.amount,
            token_name: req.body.token_name ? (existing.token_name === req.body.token_name ? existing.token_name : 'changed') : existing.token_name
          },
          after: { 
            status: existing.status,
            amount: existing.amount,
            token_name: existing.token_name
          }
        },
        description: statusChanged ? 
          `Withdrawal status changed from ${prevStatus} to ${existing.status} for ${existing.token_name} ${existing.amount}` :
          `Updated withdrawal: ${existing.token_name} ${existing.amount}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Withdrawal updated successfully', {
        withdrawalId: id,
        adminUsername: req.admin?.username,
        newStatus: existing.status,
        tokenName: existing.token_name,
        amount: existing.amount
      });

      res.json({
        success: true,
        message: 'Withdraw updated successfully',
        data: existing,
        ...(existing.usdValue ? { usdValueDeducted: existing.usdValue } : {})
      });
    } catch (error) {
      logger.error('❌ Error updating withdrawal', {
        error: error.message,
        withdrawalId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error updating withdraw:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update withdraw',
        error: error.message
      });
    }
  }

  // Delete withdraw
  static async deleteWithdraw(req, res) {
    try {
      const { id } = req.params;

      logger.info('🗑️ Deleting withdrawal', {
        withdrawalId: id,
        adminUsername: req.admin?.username
      });

      // Get withdrawal data before deletion for audit
      const withdrawToDelete = await Transaction.findOne({
        _id: id,
        isWithdraw: true
      });

      if (!withdrawToDelete) {
        logger.warn('⚠️ Withdrawal not found for deletion', {
          withdrawalId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({
          success: false,
          message: 'Withdraw not found'
        });
      }

      const deletedWithdraw = await Transaction.findOneAndDelete({
        _id: id,
        isWithdraw: true
      });

      // Create audit log
      await createAuditLog(req, res, {
        action: 'withdraw_deleted',
        resourceType: 'withdraw',
        resourceId: id,
        resourceName: `${withdrawToDelete.token_name} withdrawal - ${withdrawToDelete.amount}`,
        deletedData: withdrawToDelete.toObject(),
        description: `Deleted withdrawal: ${withdrawToDelete.token_name} ${withdrawToDelete.amount} (Status: ${withdrawToDelete.status})`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Withdrawal deleted successfully', {
        withdrawalId: id,
        adminUsername: req.admin?.username,
        tokenName: withdrawToDelete.token_name,
        amount: withdrawToDelete.amount,
        status: withdrawToDelete.status
      });

      res.json({
        success: true,
        message: 'Withdraw deleted successfully',
        data: deletedWithdraw
      });
    } catch (error) {
      logger.error('❌ Error deleting withdrawal', {
        error: error.message,
        withdrawalId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error deleting withdraw:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete withdraw',
        error: error.message
      });
    }
  }

  // Get withdraw by ID
  static async getWithdrawById(req, res) {
    try {
      const { id } = req.params;

      const withdraw = await Transaction.findOne({
        _id: id,
        isWithdraw: true
      });

      if (!withdraw) {
        return res.status(404).json({
          success: false,
          message: 'Withdraw not found'
        });
      }

      res.json({
        success: true,
        data: withdraw
      });
    } catch (error) {
      console.error('Error fetching withdraw:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch withdraw',
        error: error.message
      });
    }
  }

  // Get withdraws by status for a user
  static async getUserWithdrawsByStatus(req, res) {
    try {
      const { userId, status } = req.params;

      const validation = await validateUserExists(userId);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const withdraws = await Transaction.find({
        user: userId,
        isWithdraw: true,
        status
      }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: withdraws,
        count: withdraws.length
      });
    } catch (error) {
      console.error('Error fetching user withdraws by status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch withdraws by status',
        error: error.message
      });
    }
  }
}

export default WithdrawController;