// services/withdraw.service.js (REFACTORED)
import mongoose from 'mongoose';
import Transaction from '../model/transaction.model.js';
import { getTokenPrice } from '../utils/priceService.js';
import logger from '../utils/logger.js';
import BalanceService from './balance.service.js';
import TransactionService from './transaction.service.js';
import PortfolioService from './portfolio.service.js';

class WithdrawService {
  /**
   * Approve a withdrawal and update user balance
   * @param {Object} withdrawal - The withdrawal transaction document
   * @param {String} adminUsername - Admin who approved
   * @returns {Object} - Approval result with balance details
   */
  static async approveWithdrawal(withdrawal, adminUsername) {
    const session = await mongoose.startSession();
    
    try {
      let result;
      
      await session.withTransaction(async () => {
        // Check if already approved (prevent double-approval)
        if (withdrawal.status === 'approved' && withdrawal.usdValue) {
          throw new Error('ALREADY_APPROVED');
        }

        // Fetch live token price
        const price = await getTokenPrice(withdrawal.token_name);
        const usdValue = Number((price * withdrawal.amount).toFixed(8));

        // Validate user has the specific token in their portfolio
        const validation = await PortfolioService.validateWithdrawalAmount(
            withdrawal.user,
            withdrawal.token_name,
            withdrawal.amount
        );
        
        if (!validation.valid) {
            const error = new Error(validation.reason);
            error.code = validation.code;
            error.data = validation;
            throw error;
        }

        // Deduct funds from user account (updates only accountBalance)
        const balanceUpdate = await BalanceService.deductFunds(
            withdrawal.user,
            usdValue,
            withdrawal.token_name,
            withdrawal.amount,
            session
        );

        // Update withdrawal with snapshot data (immutable after approval)
        withdrawal.tokenPriceAtApproval = Number(price);
        withdrawal.usdValue = usdValue;
        withdrawal.approvedAt = new Date();
        withdrawal.status = 'approved';

        await withdrawal.save({ session });

        TransactionService.logTransactionAction(withdrawal, 'approved', adminUsername, {
          usdValueDeducted: usdValue,
          tokenPrice: price,
          userEmail: balanceUpdate.userEmail,
          accountBalance: {
            previous: balanceUpdate.previousAccountBalance,
            new: balanceUpdate.newAccountBalance
          },
          totalInvestment: balanceUpdate.totalInvestment // unchanged
        });

        result = {
          success: true,
          usdValue,
          tokenPrice: price,
          ...balanceUpdate
        };
      });

      return result;
      
    } catch (err) {
      logger.error('❌ Withdrawal approval failed', {
        withdrawalId: withdrawal._id,
        error: err.message,
        adminUsername
      });
      
      throw err;
      
    } finally {
      session.endSession();
    }
  }

  /**
   * Reject a withdrawal
   * @param {Object} withdrawal - The withdrawal transaction document
   * @param {String} adminUsername - Admin who rejected
   * @returns {Object} - Rejection result
   */
  static async rejectWithdrawal(withdrawal, adminUsername) {
    // Validate that withdrawal can be rejected
    if (withdrawal.status === 'approved') {
      throw new Error('CANNOT_REJECT_APPROVED');
    }

    if (withdrawal.status === 'rejected') {
      throw new Error('ALREADY_REJECTED');
    }

    withdrawal.status = 'rejected';
    await withdrawal.save();

    TransactionService.logTransactionAction(withdrawal, 'rejected', adminUsername);

    return {
      success: true,
      message: 'Withdrawal rejected successfully'
    };
  }

  /**
   * Update withdrawal (only if status is pending)
   * @param {String} withdrawalId - Withdrawal ID
   * @param {Object} updates - Fields to update
   * @returns {Object} - Updated withdrawal
   */
  static async updateWithdrawal(withdrawalId, updates) {
    const withdrawal = await TransactionService.getTransaction(withdrawalId, 'withdraw');

    // Validate if withdrawal can be modified
    const validation = TransactionService.validateTransactionUpdate(withdrawal, updates);
    if (!validation.allowed) {
      const error = new Error(validation.reason);
      error.code = validation.code;
      throw error;
    }

    // If status is being updated, validate the transition
    if (updates.status && updates.status !== withdrawal.status) {
      const statusValidation = TransactionService.validateStatusTransition(
        withdrawal.status,
        updates.status,
        false // isWithdraw
      );

      if (!statusValidation.allowed) {
        const error = new Error(statusValidation.reason);
        error.code = 'INVALID_STATUS_TRANSITION';
        throw error;
      }
    }

    // Apply updates (only for pending withdrawals)
    if (updates.amount !== undefined) withdrawal.amount = updates.amount;
    if (updates.token_name) withdrawal.token_name = updates.token_name;
    if (updates.token_withdraw_address) withdrawal.token_withdraw_address = updates.token_withdraw_address;
    if (updates.status) withdrawal.status = updates.status;

    await withdrawal.save();
    
    return withdrawal;
  }

  /**
   * Check if user has sufficient balance for withdrawal
   * Uses accountBalance instead of totalInvestment
   * @param {String} userId - User ID
   * @param {String} tokenName - Token name or symbol
   * @param {Number} amount - Amount to withdraw
   * @returns {Object} - Balance check result
   */
  static async checkSufficientBalance(userId, tokenName, amount) {
    try {
      const price = await getTokenPrice(tokenName);
      const requiredUsdValue = Number((price * amount).toFixed(8));

      const balanceCheck = await BalanceService.hasSufficientBalance(userId, requiredUsdValue);

      return {
        ...balanceCheck,
        requiredUsdValue,
        tokenPrice: price
      };
    } catch (error) {
      logger.error('❌ Error checking balance for withdrawal', {
        userId,
        tokenName,
        amount,
        error: error.message
      });
      throw error;
    }
  }
}

export default WithdrawService;