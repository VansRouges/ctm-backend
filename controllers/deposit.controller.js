import Transaction from '../model/transaction.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';
import DepositService from '../services/deposit.service.js';
import { createNotification } from '../utils/notificationHelper.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
import logger from '../utils/logger.js';

class DepositController {
  // Get all deposits for a specific user
  static async getUserDeposits(req, res) {
    try {
        const { userId } = req.params;

        const validation = await validateUserExists(userId);
        if (!validation.ok) {
          return res.status(validation.status).json({ success: false, message: validation.message });
        }

        const deposits = await Transaction.find({ user: userId, isDeposit: true }).sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: deposits,
        count: deposits.length
      });
    } catch (error) {
      console.error('Error fetching user deposits:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deposits',
        error: error.message
      });
    }
  }

  // Get all deposits (admin only)
  static async getAllDeposits(req, res) {
    try {
      logger.info('💰 Fetching all deposits', {
        adminUsername: req.admin?.username
      });

      const deposits = await Transaction.find({ 
        isDeposit: true 
      }).sort({ createdAt: -1 });

      // Create audit log
      await createAuditLog(req, res, {
        action: 'deposits_view_all',
        resourceType: 'deposit',
        description: `Admin ${req.admin?.username || 'unknown'} viewed all deposits (${deposits.length} deposits)`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Deposits retrieved successfully', {
        adminUsername: req.admin?.username,
        count: deposits.length
      });
      
      res.json({
        success: true,
        data: deposits,
        count: deposits.length
      });
    } catch (error) {
      logger.error('❌ Error fetching deposits', {
        error: error.message,
        adminId: req.admin?.id
      });
      console.error('Error fetching all deposits:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deposits',
        error: error.message
      });
    }
  }

  // Create new deposit
  static async createDeposit(req, res) {
    try {
      const { token_name, amount, token_deposit_address, user, status } = req.body;

      // Validate required fields
      if (!token_name || !amount || !user) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: token_name, amount, user'
        });
      }

      const validation = await validateBodyUser(user);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const deposit = new Transaction({
        token_name,
        isWithdraw: false,
        isDeposit: true,
        amount,
        token_deposit_address,
        user,
        status: status || 'pending'
      });

      const savedDeposit = await deposit.save();

      // Create notification for admin
      await createNotification({
        action: 'deposit',
        userId: user,
        metadata: {
          amount,
          currency: token_name,
          referenceId: savedDeposit._id.toString()
        }
      });

      res.status(201).json({
        success: true,
        message: 'Deposit created successfully',
        data: savedDeposit
      });
    } catch (error) {
      console.error('Error creating deposit:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create deposit',
        error: error.message
      });
    }
  }

 // Update deposit - SIMPLIFIED VERSION
  static async updateDeposit(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      logger.info('📝 Updating deposit', {
        depositId: id,
        adminUsername: req.admin?.username,
        updates: Object.keys(updateData)
      });

      // Find the deposit
      const deposit = await Transaction.findOne({ _id: id, isDeposit: true });
      
      if (!deposit) {
        logger.warn('⚠️ Deposit not found', {
          depositId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({ 
          success: false, 
          message: 'Deposit not found' 
        });
      }

      const previousStatus = deposit.status;
      const isApproving = previousStatus !== 'approved' && updateData.status === 'approved';

      // Handle approval flow
      if (isApproving) {
        try {
          const approvalResult = await DepositService.approveDeposit(
            deposit, 
            req.admin?.username
          );

          // Create audit log
          await createAuditLog(req, res, {
            action: 'deposit_approved',
            resourceType: 'deposit',
            resourceId: deposit._id.toString(),
            resourceName: `${deposit.token_name} deposit - ${deposit.amount}`,
            changes: {
              before: { status: previousStatus },
              after: { 
                status: 'approved',
                usdValue: approvalResult.usdValue,
                userBalance: approvalResult.newBalance
              }
            },
            description: `Approved ${deposit.token_name} deposit of ${deposit.amount} (USD $${approvalResult.usdValue.toFixed(2)})`
          });

          await invalidateAuditCache();

          return res.json({
            success: true,
            message: 'Deposit approved successfully',
            data: deposit,
            usdValueAdded: approvalResult.usdValue,
            userNewBalance: approvalResult.newBalance
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
              message: 'This deposit has already been approved' 
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
        const updatedDeposit = await DepositService.updateDeposit(id, updateData);

        // Create audit log
        await createAuditLog(req, res, {
          action: 'deposit_updated',
          resourceType: 'deposit',
          resourceId: updatedDeposit._id.toString(),
          resourceName: `${updatedDeposit.token_name} deposit - ${updatedDeposit.amount}`,
          changes: {
            before: { 
              status: previousStatus,
              amount: deposit.amount,
              token_name: deposit.token_name
            },
            after: { 
              status: updatedDeposit.status,
              amount: updatedDeposit.amount,
              token_name: updatedDeposit.token_name
            }
          },
          description: `Updated deposit: ${updatedDeposit.token_name} ${updatedDeposit.amount}`
        });

        await invalidateAuditCache();

        return res.json({
          success: true,
          message: 'Deposit updated successfully',
          data: updatedDeposit
        });

      } catch (error) {
        if (error.code === 'IMMUTABLE_DEPOSIT') {
          return res.status(403).json({ 
            success: false, 
            message: error.message 
          });
        }
        if (error.message === 'DEPOSIT_NOT_FOUND') {
          return res.status(404).json({ 
            success: false, 
            message: 'Deposit not found' 
          });
        }
        throw error;
      }

    } catch (error) {
      logger.error('❌ Error updating deposit', {
        error: error.message,
        stack: error.stack,
        depositId: req.params.id,
        adminId: req.admin?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to update deposit',
        error: error.message
      });
    }
  }

  // Delete deposit
  static async deleteDeposit(req, res) {
    try {
      const { id } = req.params;

      logger.info('🗑️ Deleting deposit', {
        depositId: id,
        adminUsername: req.admin?.username
      });

      // Get deposit data before deletion for audit
      const depositToDelete = await Transaction.findOne({
        _id: id,
        isDeposit: true
      });

      if (!depositToDelete) {
        logger.warn('⚠️ Deposit not found for deletion', {
          depositId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({
          success: false,
          message: 'Deposit not found'
        });
      }

      const deletedDeposit = await Transaction.findOneAndDelete({
        _id: id,
        isDeposit: true
      });

      // Create audit log
      await createAuditLog(req, res, {
        action: 'deposit_deleted',
        resourceType: 'deposit',
        resourceId: id,
        resourceName: `${depositToDelete.token_name} deposit - ${depositToDelete.amount}`,
        deletedData: depositToDelete.toObject(),
        description: `Deleted deposit: ${depositToDelete.token_name} ${depositToDelete.amount} (Status: ${depositToDelete.status})`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Deposit deleted successfully', {
        depositId: id,
        adminUsername: req.admin?.username,
        tokenName: depositToDelete.token_name,
        amount: depositToDelete.amount,
        status: depositToDelete.status
      });

      res.json({
        success: true,
        message: 'Deposit deleted successfully',
        data: deletedDeposit
      });
    } catch (error) {
      logger.error('❌ Error deleting deposit', {
        error: error.message,
        depositId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error deleting deposit:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete deposit',
        error: error.message
      });
    }
  }

  // Get deposit by ID
  static async getDepositById(req, res) {
    try {
      const { id } = req.params;

      const deposit = await Transaction.findOne({
        _id: id,
        isDeposit: true
      });

      if (!deposit) {
        return res.status(404).json({
          success: false,
          message: 'Deposit not found'
        });
      }

      res.json({
        success: true,
        data: deposit
      });
    } catch (error) {
      console.error('Error fetching deposit:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deposit',
        error: error.message
      });
    }
  }

  // Get deposits by status for a user
  static async getUserDepositsByStatus(req, res) {
    try {
      const { userId, status } = req.params;

      const validation = await validateUserExists(userId);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const deposits = await Transaction.find({
        user: userId,
        isDeposit: true,
        status
      }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: deposits,
        count: deposits.length
      });
    } catch (error) {
      console.error('Error fetching user deposits by status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deposits by status',
        error: error.message
      });
    }
  }
}

export default DepositController;