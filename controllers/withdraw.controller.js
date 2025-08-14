import Transaction from '../model/transaction.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';
import User from '../model/user.model.js';
import { getTokenPrice } from '../utils/priceService.js';
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
      const withdraws = await Transaction.find({ 
        isWithdraw: true 
      }).sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: withdraws,
        count: withdraws.length
      });
    } catch (error) {
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

      // Force flags
      updateData.isWithdraw = true;
      updateData.isDeposit = false;

      const existing = await Transaction.findOne({ _id: id, isWithdraw: true });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Withdraw not found' });
      }

      const prevStatus = existing.status;

      // Prevent editing amount/token once already approved
      if (prevStatus === 'approved') {
        const amountChange = updateData.amount !== undefined && updateData.amount !== existing.amount;
        const tokenChange = updateData.token_name && updateData.token_name !== existing.token_name;
        if (amountChange || tokenChange) {
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
          });
        } catch (err) {
          session.endSession();
          if (err.message === 'USER_NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'User not found for transaction' });
          }
          if (err.message === 'INSUFFICIENT_FUNDS') {
            return res.status(400).json({ success: false, message: 'Insufficient totalInvestment to approve this withdraw' });
          }
          if (err.response || err.message?.toLowerCase().includes('price')) {
            return res.status(502).json({ success: false, message: 'Failed to fetch token price', error: err.message });
          }
          return res.status(500).json({ success: false, message: 'Failed during approval transaction', error: err.message });
        } finally {
          session.endSession();
        }
      } else {
        await existing.save();
      }

      res.json({
        success: true,
        message: 'Withdraw updated successfully',
        data: existing,
        ...(existing.usdValue ? { usdValueDeducted: existing.usdValue } : {})
      });
    } catch (error) {
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

      const deletedWithdraw = await Transaction.findOneAndDelete({
        _id: id,
        isWithdraw: true
      });

      if (!deletedWithdraw) {
        return res.status(404).json({
          success: false,
          message: 'Withdraw not found'
        });
      }

      res.json({
        success: true,
        message: 'Withdraw deleted successfully',
        data: deletedWithdraw
      });
    } catch (error) {
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