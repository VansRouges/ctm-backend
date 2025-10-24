// services/transaction.service.js
// Shared transaction validation and utilities
import Transaction from '../model/transaction.model.js';
import logger from '../utils/logger.js';

class TransactionService {
  /**
   * Validate if a transaction can be modified based on its current status
   * @param {Object} transaction - Transaction document
   * @param {Object} requestedUpdates - Updates being requested
   * @returns {Object} - { allowed, reason, code }
   */
  static validateTransactionUpdate(transaction, requestedUpdates) {
    const transactionType = transaction.isDeposit ? 'deposit' : 'withdrawal';
    const currentStatus = transaction.status;

    // Rule 1: Approved transactions are COMPLETELY IMMUTABLE
    if (currentStatus === 'approved') {
      return {
        allowed: false,
        reason: `Cannot modify approved ${transactionType}s. Approved transactions are permanently locked to maintain financial integrity.`,
        code: 'IMMUTABLE_APPROVED'
      };
    }

    // Rule 2: Rejected transactions are COMPLETELY IMMUTABLE
    if (currentStatus === 'rejected') {
      return {
        allowed: false,
        reason: `Cannot modify rejected ${transactionType}s. Rejected transactions are permanently locked for audit purposes.`,
        code: 'IMMUTABLE_REJECTED'
      };
    }

    // Rule 3: Only pending transactions can be modified
    if (currentStatus === 'pending') {
      return {
        allowed: true,
        reason: null,
        code: null
      };
    }

    // Fallback (shouldn't reach here with current enum)
    return {
      allowed: false,
      reason: `Unknown transaction status: ${currentStatus}`,
      code: 'UNKNOWN_STATUS'
    };
  }

  /**
   * Validate status transition
   * @param {String} currentStatus - Current status
   * @param {String} newStatus - Requested new status
   * @param {Boolean} isDeposit - Is this a deposit transaction
   * @returns {Object} - { allowed, reason }
   */
  static validateStatusTransition(currentStatus, newStatus, isDeposit = true) {
    const transactionType = isDeposit ? 'deposit' : 'withdrawal';

    // Same status = no change
    if (currentStatus === newStatus) {
      return { allowed: true, reason: null };
    }

    // From pending -> approved/rejected: ALLOWED
    if (currentStatus === 'pending' && (newStatus === 'approved' || newStatus === 'rejected')) {
      return { allowed: true, reason: null };
    }

    // From approved -> anything else: FORBIDDEN
    if (currentStatus === 'approved') {
      return {
        allowed: false,
        reason: `Cannot change status from approved to ${newStatus}. Approved ${transactionType}s are immutable.`
      };
    }

    // From rejected -> anything else: FORBIDDEN
    if (currentStatus === 'rejected') {
      return {
        allowed: false,
        reason: `Cannot change status from rejected to ${newStatus}. Rejected ${transactionType}s are immutable.`
      };
    }

    // Any other transition: FORBIDDEN
    return {
      allowed: false,
      reason: `Invalid status transition from ${currentStatus} to ${newStatus}`
    };
  }

  /**
   * Check if transaction is already finalized (approved or rejected)
   * @param {Object} transaction - Transaction document
   * @returns {Boolean}
   */
  static isFinalized(transaction) {
    return transaction.status === 'approved' || transaction.status === 'rejected';
  }

  /**
   * Get transaction by ID with type validation
   * @param {String} transactionId - Transaction ID
   * @param {String} type - 'deposit' or 'withdraw'
   * @returns {Object} - Transaction document
   */
  static async getTransaction(transactionId, type) {
    const query = { _id: transactionId };
    
    if (type === 'deposit') {
      query.isDeposit = true;
    } else if (type === 'withdraw') {
      query.isWithdraw = true;
    }

    const transaction = await Transaction.findOne(query);

    if (!transaction) {
      const error = new Error(`${type.toUpperCase()}_NOT_FOUND`);
      error.code = `${type.toUpperCase()}_NOT_FOUND`;
      throw error;
    }

    return transaction;
  }

  /**
   * Log transaction state change
   * @param {Object} transaction - Transaction document
   * @param {String} action - Action being performed
   * @param {String} adminUsername - Admin performing action
   * @param {Object} additionalData - Additional log data
   */
  static logTransactionAction(transaction, action, adminUsername, additionalData = {}) {
    const transactionType = transaction.isDeposit ? 'deposit' : 'withdrawal';
    
    logger.info(`📋 Transaction ${action}`, {
      transactionType,
      transactionId: transaction._id,
      userId: transaction.user,
      tokenName: transaction.token_name,
      amount: transaction.amount,
      status: transaction.status,
      adminUsername,
      ...additionalData
    });
  }
}

export default TransactionService;