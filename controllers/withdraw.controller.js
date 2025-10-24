// controllers/withdraw.controller.js (SIMPLIFIED & REFACTORED)
import Transaction from '../model/transaction.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';
import WithdrawService from '../services/withdraw.service.js';
import { createNotification } from '../utils/notificationHelper.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
import logger from '../utils/logger.js';

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
      console.error('Error fetching withdraw by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch withdraw',
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

      // Check if user has sufficient balance before creating withdrawal request
      try {
        const balanceCheck = await WithdrawService.checkSufficientBalance(user, token_name, amount);
        
        if (!balanceCheck.hasSufficientFunds) {
          logger.warn('⚠️ Insufficient balance for withdrawal request', {
            userId: user,
            userEmail: balanceCheck.userEmail,
            tokenName: token_name,
            requestedAmount: amount,
            requiredUsd: balanceCheck.requiredUsdValue,
            availableBalance: balanceCheck.currentBalance,
            deficit: balanceCheck.deficit
          });

          return res.status(400).json({
            success: false,
            message: 'Insufficient balance for this withdrawal',
            data: {
              requiredUsdValue: balanceCheck.requiredUsdValue,
              currentBalance: balanceCheck.currentBalance,
              deficit: balanceCheck.deficit
            }
          });
        }
      } catch (error) {
        if (error.message === 'USER_NOT_FOUND') {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }
        // If price fetch fails, allow creation but log warning
        logger.warn('⚠️ Could not verify balance during withdrawal creation', {
          error: error.message,
          userId: user,
          tokenName: token_name
        });
      }

      const withdrawData = {
        token_name,
        amount,
        token_withdraw_address: token_withdraw_address || '',
        user,
        status: status || 'pending',
        isWithdraw: true,
        isDeposit: false
      };

      const withdraw = await Transaction.create(withdrawData);

      // Create notification
      await createNotification({
        action: 'withdraw_created',
        description: `New withdrawal request for ${amount} ${token_name}`,
        metadata: {
          userId: user,
          withdrawId: withdraw._id.toString(),
          amount,
          token_name,
          referenceId: withdraw._id.toString()
        }
      });
      
      res.status(201).json({
        success: true,
        message: 'Withdrawal request created successfully',
        data: withdraw
      });
    } catch (error) {
      console.error('Error creating withdraw:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create withdrawal request',
        error: error.message
      });
    }
  }

  // Update withdraw - REFACTORED VERSION
  static async updateWithdraw(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      logger.info('📝 Updating withdrawal', {
        withdrawalId: id,
        adminUsername: req.admin?.username,
        updates: Object.keys(updateData)
      });

      // Find the withdrawal
      const withdrawal = await Transaction.findOne({ _id: id, isWithdraw: true });
      
      if (!withdrawal) {
        logger.warn('⚠️ Withdrawal not found', {
          withdrawalId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({ 
          success: false, 
          message: 'Withdraw not found' 
        });
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
          return res.status(validation.status).json({ 
            success: false, 
            message: validation.message 
          });
        }
      }

      const previousStatus = withdrawal.status;
      const isApproving = previousStatus !== 'approved' && updateData.status === 'approved';

      // Handle approval flow
      if (isApproving) {
        try {
          const approvalResult = await WithdrawService.approveWithdrawal(
            withdrawal, 
            req.admin?.username
          );

          // Create audit log
          await createAuditLog(req, res, {
            action: 'withdraw_approved',
            resourceType: 'withdraw',
            resourceId: withdrawal._id.toString(),
            resourceName: `${withdrawal.token_name} withdrawal - ${withdrawal.amount}`,
            changes: {
              before: { 
                status: previousStatus,
                userBalance: approvalResult.previousBalance
              },
              after: { 
                status: 'approved',
                usdValue: approvalResult.usdValue,
                userBalance: approvalResult.newBalance
              }
            },
            description: `Approved ${withdrawal.token_name} withdrawal of ${withdrawal.amount} (USD $${approvalResult.usdValue.toFixed(2)})`
          });

          await invalidateAuditCache();

          return res.json({
            success: true,
            message: 'Withdrawal approved successfully',
            data: withdrawal,
            usdValueDeducted: approvalResult.usdValue,
            userNewBalance: approvalResult.newBalance,
            userPreviousBalance: approvalResult.previousBalance
          });

        } catch (error) {
          if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({ 
              success: false, 
              message: 'User not found for transaction' 
            });
          }
          if (error.message === 'ALREADY_APPROVED') {
            return res.status(400).json({ 
              success: false, 
              message: 'This withdrawal has already been approved' 
            });
          }
          if (error.message === 'INSUFFICIENT_FUNDS') {
            return res.status(400).json({ 
              success: false, 
              message: 'Insufficient totalInvestment to approve this withdrawal',
              data: error.data
            });
          }
          if (error.response || error.message?.toLowerCase().includes('price')) {
            return res.status(502).json({ 
              success: false, 
              message: 'Failed to fetch token price', 
              error: error.message 
            });
          }
          throw error; // Re-throw unexpected errors
        }
      }

      // Handle non-approval updates (status changes to pending/rejected, or field updates)
      try {
        const updatedWithdrawal = await WithdrawService.updateWithdrawal(id, updateData);

        // Create audit log
        await createAuditLog(req, res, {
          action: 'withdraw_updated',
          resourceType: 'withdraw',
          resourceId: updatedWithdrawal._id.toString(),
          resourceName: `${updatedWithdrawal.token_name} withdrawal - ${updatedWithdrawal.amount}`,
          changes: {
            before: { 
              status: previousStatus,
              amount: withdrawal.amount,
              token_name: withdrawal.token_name
            },
            after: { 
              status: updatedWithdrawal.status,
              amount: updatedWithdrawal.amount,
              token_name: updatedWithdrawal.token_name
            }
          },
          description: `Updated withdrawal: ${updatedWithdrawal.token_name} ${updatedWithdrawal.amount}`
        });

        await invalidateAuditCache();

        return res.json({
          success: true,
          message: 'Withdraw updated successfully',
          data: updatedWithdrawal
        });

      } catch (error) {
        if (error.code === 'IMMUTABLE_WITHDRAWAL') {
          return res.status(403).json({ 
            success: false, 
            message: error.message 
          });
        }
        if (error.message === 'WITHDRAWAL_NOT_FOUND') {
          return res.status(404).json({ 
            success: false, 
            message: 'Withdraw not found' 
          });
        }
        throw error;
      }

    } catch (error) {
      logger.error('❌ Error updating withdrawal', {
        error: error.message,
        stack: error.stack,
        withdrawalId: req.params.id,
        adminId: req.admin?.id
      });
      
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

      const withdraw = await Transaction.findOne({ _id: id, isWithdraw: true });
      
      if (!withdraw) {
        logger.warn('⚠️ Withdrawal not found for deletion', {
          withdrawalId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({
          success: false,
          message: 'Withdraw not found'
        });
      }

      // Prevent deletion of approved withdrawals (financial integrity)
      if (withdraw.status === 'approved') {
        logger.warn('⚠️ Cannot delete approved withdrawal', {
          withdrawalId: id,
          adminUsername: req.admin?.username,
          status: withdraw.status
        });
        return res.status(403).json({
          success: false,
          message: 'Cannot delete approved withdrawals. Approved transactions are immutable.'
        });
      }

      await Transaction.findByIdAndDelete(id);

      // Create audit log
      await createAuditLog(req, res, {
        action: 'withdraw_deleted',
        resourceType: 'withdraw',
        resourceId: withdraw._id.toString(),
        resourceName: `${withdraw.token_name} withdrawal - ${withdraw.amount}`,
        deletedData: withdraw.toObject(),
        description: `Deleted ${withdraw.status} withdrawal: ${withdraw.token_name} ${withdraw.amount}`
      });

      await invalidateAuditCache();

      logger.info('✅ Withdrawal deleted successfully', {
        withdrawalId: id,
        adminUsername: req.admin?.username
      });

      res.json({
        success: true,
        message: 'Withdraw deleted successfully'
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

  // Get withdraws by status for a specific user
  static async getUserWithdrawsByStatus(req, res) {
    try {
      const { userId, status } = req.params;

      // Validate user exists
      const validation = await validateUserExists(userId);
      if (!validation.ok) {
        return res.status(validation.status).json({ 
          success: false, 
          message: validation.message 
        });
      }

      // Validate status is valid
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const withdraws = await Transaction.find({
        user: userId,
        isWithdraw: true,
        status: status
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
        message: 'Failed to fetch withdraws',
        error: error.message
      });
    }
  }
}

export default WithdrawController;