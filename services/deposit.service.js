// services/deposit.service.js (REFACTORED)
import mongoose from 'mongoose';
import Transaction from '../model/transaction.model.js';
import { getTokenPrice } from '../utils/priceService.js';
import logger from '../utils/logger.js';
import BalanceService from './balance.service.js';
import TransactionService from './transaction.service.js';

class DepositService {
  /**
   * Approve a deposit and update user balance
   * @param {Object} deposit - The deposit transaction document
   * @param {String} adminUsername - Admin who approved
   * @returns {Object} - Approval result with balance details
   */
  static async approveDeposit(deposit, adminUsername) {
    const session = await mongoose.startSession();
    
    try {
      let result;
      
      await session.withTransaction(async () => {
        // Check if already approved (prevent double-approval)
        if (deposit.status === 'approved' && deposit.usdValue) {
          throw new Error('ALREADY_APPROVED');
        }

        // Fetch live token price
        const price = await getTokenPrice(deposit.token_name);
        const usdValue = Number((price * deposit.amount).toFixed(8));

       // Add funds to user account (updates both totalInvestment, accountBalance, and portfolio)
        const balanceUpdate = await BalanceService.addFunds(
            deposit.user,
            usdValue,
            deposit.token_name,  // ADD THIS
            deposit.amount,      // ADD THIS
            session
        );

        // Update deposit with snapshot data (immutable after approval)
        deposit.tokenPriceAtApproval = Number(price);
        deposit.usdValue = usdValue;
        deposit.approvedAt = new Date();
        deposit.status = 'approved';

        await deposit.save({ session });

        TransactionService.logTransactionAction(deposit, 'approved', adminUsername, {
          usdValueAdded: usdValue,
          tokenPrice: price,
          userEmail: balanceUpdate.userEmail,
          totalInvestment: {
            previous: balanceUpdate.previousTotalInvestment,
            new: balanceUpdate.newTotalInvestment
          },
          accountBalance: {
            previous: balanceUpdate.previousAccountBalance,
            new: balanceUpdate.newAccountBalance
          }
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
      logger.error('❌ Deposit approval failed', {
        depositId: deposit._id,
        error: err.message,
        adminUsername
      });
      
      throw err;
      
    } finally {
      session.endSession();
    }
  }

  /**
   * Reject a deposit
   * @param {Object} deposit - The deposit transaction document
   * @param {String} adminUsername - Admin who rejected
   * @returns {Object} - Rejection result
   */
  static async rejectDeposit(deposit, adminUsername) {
    // Validate that deposit can be rejected
    if (deposit.status === 'approved') {
      throw new Error('CANNOT_REJECT_APPROVED');
    }

    if (deposit.status === 'rejected') {
      throw new Error('ALREADY_REJECTED');
    }

    deposit.status = 'rejected';
    await deposit.save();

    TransactionService.logTransactionAction(deposit, 'rejected', adminUsername);

    return {
      success: true,
      message: 'Deposit rejected successfully'
    };
  }

  /**
   * Update deposit (only if status is pending)
   * @param {String} depositId - Deposit ID
   * @param {Object} updates - Fields to update
   * @returns {Object} - Updated deposit
   */
  static async updateDeposit(depositId, updates) {
    const deposit = await TransactionService.getTransaction(depositId, 'deposit');

    // Validate if deposit can be modified
    const validation = TransactionService.validateTransactionUpdate(deposit, updates);
    if (!validation.allowed) {
      const error = new Error(validation.reason);
      error.code = validation.code;
      throw error;
    }

    // If status is being updated, validate the transition
    if (updates.status && updates.status !== deposit.status) {
      const statusValidation = TransactionService.validateStatusTransition(
        deposit.status,
        updates.status,
        true // isDeposit
      );

      if (!statusValidation.allowed) {
        const error = new Error(statusValidation.reason);
        error.code = 'INVALID_STATUS_TRANSITION';
        throw error;
      }
    }

    // Apply updates (only for pending deposits)
    if (updates.amount !== undefined) deposit.amount = updates.amount;
    if (updates.token_name) deposit.token_name = updates.token_name;
    if (updates.token_deposit_address) deposit.token_deposit_address = updates.token_deposit_address;
    if (updates.status) deposit.status = updates.status;

    await deposit.save();
    
    return deposit;
  }
}

export default DepositService;