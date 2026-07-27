import User from "../model/user.model.js";
import { createNotification } from "../utils/notificationHelper.js";
import { createAuditLog } from "../utils/auditHelper.js";
import { invalidateAuditCache } from "./audit-log.controller.js";
import FinancialSummaryService from "../services/financial-summary.service.js";
import BalanceService from "../services/balance.service.js";
import logger from "../utils/logger.js";

// Get all users
const getUsers = async (req, res, next) => {
  try {
    logger.info('👥 Fetching all users', {
      adminUsername: req.admin?.username
    });

    const users = await User.find().select('-__v');

    // Create audit log
    await createAuditLog(req, res, {
      action: 'users_view_all',
      resourceType: 'user',
      description: `Admin ${req.admin?.username || 'unknown'} viewed all users (${users.length} users)`
    });

    // Invalidate audit cache
    await invalidateAuditCache();

    logger.info('✅ Users retrieved successfully', {
      adminUsername: req.admin?.username,
      count: users.length
    });

    res.json({
      success: true,
      message: "Users retrieved successfully",
      count: users.length,
      data: users
    });
    next(); // Call next middleware if needed
  } catch (error) {
    logger.error('❌ Error fetching users', {
      error: error.message,
      adminId: req.admin?.id
    });
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
    next(error); 
  }
};

// Get single user by ID (refreshes equity metrics before returning)
const getUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const isAdmin = Boolean(req.admin);
    const isSelf =
      Boolean(req.user?.userId) && String(req.user.userId) === String(userId);

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own profile'
      });
    }

    try {
      await FinancialSummaryService.syncUserFinancialMetrics(userId);
    } catch (syncError) {
      if (syncError.message !== 'USER_NOT_FOUND') {
        logger.warn('⚠️ Financial metrics sync failed on getUserById', {
          userId,
          error: syncError.message
        });
      }
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const summary = {
      totalInvestment: user.totalInvestment || 0,
      accountBalance: user.accountBalance || 0,
      lockedValue: Number(
        ((user.currentValue || 0) - (user.accountBalance || 0)).toFixed(8)
      ),
      currentValue: user.currentValue || 0,
      lifetimeWithdrawals: user.lifetimeWithdrawals || 0,
      roi: user.roi || 0,
      netGainLoss: Number(
        (
          (user.currentValue || 0) +
          (user.lifetimeWithdrawals || 0) -
          (user.totalInvestment || 0)
        ).toFixed(8)
      )
    };

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: user,
      financialSummary: summary
    });
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
    next(error);
  }
};


// Create new user
const createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    
    // Create notification for admin
    await createNotification({
      action: 'user_created',
      userId: user._id,
      metadata: {
        referenceId: user._id.toString()
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });
    next();
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: error.message
    });
    next(error);
  }
};

// Update user — auth + field allowlists (no mass-assignment)
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = Boolean(req.admin);
    const isSelf =
      Boolean(req.user?.userId) && String(req.user.userId) === String(id);

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile'
      });
    }

    // accountBalance / currentValue are handled via BalanceService (portfolio-backed)
    const ADMIN_ALLOWED = [
      'username',
      'firstName',
      'lastName',
      'email',
      'isActive',
      'accountStatus',
      'totalInvestment',
      'accountBalance',
      'currentValue',
      'roi'
    ];
    const USER_ALLOWED = ['username', 'firstName', 'lastName'];
    const allowed = isAdmin ? ADMIN_ALLOWED : USER_ALLOWED;

    // KYC must go through /kyc/admin/:id/status — never via user update
    if (Object.prototype.hasOwnProperty.call(req.body, 'kycStatus')) {
      return res.status(400).json({
        success: false,
        message:
          'kycStatus cannot be set here. Approve or reject KYC via the KYC admin endpoints.'
      });
    }

    // Non-admins cannot touch financial fields even if sent
    if (
      !isAdmin &&
      (Object.prototype.hasOwnProperty.call(req.body, 'accountBalance') ||
        Object.prototype.hasOwnProperty.call(req.body, 'currentValue') ||
        Object.prototype.hasOwnProperty.call(req.body, 'totalInvestment') ||
        Object.prototype.hasOwnProperty.call(req.body, 'roi'))
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update financial fields'
      });
    }

    const financialFields = {};
    if (
      isAdmin &&
      Object.prototype.hasOwnProperty.call(req.body, 'accountBalance')
    ) {
      financialFields.accountBalance = req.body.accountBalance;
    }
    if (
      isAdmin &&
      Object.prototype.hasOwnProperty.call(req.body, 'currentValue')
    ) {
      financialFields.currentValue = req.body.currentValue;
    }
    const hasFinancialUpdate = Object.keys(financialFields).length > 0;

    const updates = {};
    for (const key of allowed) {
      if (
        key === 'accountBalance' ||
        key === 'currentValue'
      ) {
        continue; // applied via BalanceService below
      }
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0 && !hasFinancialUpdate) {
      return res.status(400).json({
        success: false,
        message: `No valid fields to update. Allowed: ${allowed.join(', ')}`
      });
    }

    logger.info('📝 Updating user', {
      userId: id,
      adminUsername: req.admin?.username,
      selfUpdate: isSelf,
      updates: Object.keys(updates),
      financialFields: Object.keys(financialFields)
    });

    const oldUser = await User.findById(id);

    if (!oldUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let financialResult = null;
    if (hasFinancialUpdate) {
      financialResult = await BalanceService.adminUpdateFinancialMetrics(
        id,
        financialFields
      );
      // ROI is recalculated by sync — drop manual roi if financials changed
      delete updates.roi;
    }

    let user =
      Object.keys(updates).length > 0
        ? await User.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true
          })
        : await User.findById(id);

    await createAuditLog(req, res, {
      action: hasFinancialUpdate ? 'user_financials_updated' : 'user_updated',
      resourceType: 'user',
      resourceId: user._id.toString(),
      resourceName: user.email,
      changes: {
        before: oldUser.toObject(),
        after: user.toObject(),
        ...(financialResult && {
          financials: {
            before: financialResult.before,
            after: financialResult.after,
            adjustments: financialResult.adjustments
          }
        })
      },
      description: hasFinancialUpdate
        ? `Updated financial metrics for user: ${user.email}`
        : `Updated user: ${user.email}`
    });

    await invalidateAuditCache();

    logger.info('✅ User updated successfully', {
      userId: id,
      adminUsername: req.admin?.username,
      userEmail: user.email,
      financialUpdate: hasFinancialUpdate
    });

    res.json({
      success: true,
      message: hasFinancialUpdate
        ? 'User and financial metrics updated successfully'
        : 'User updated successfully',
      data: user,
      ...(financialResult && {
        financialSummary: financialResult.after,
        portfolioAdjustments: financialResult.adjustments
      })
    });
  } catch (error) {
    logger.error('❌ Error updating user', {
      error: error.message,
      userId: req.params.id,
      adminId: req.admin?.id,
      data: error.data
    });

    const financialErrors = new Set([
      'NO_FINANCIAL_FIELDS',
      'INVALID_FINANCIAL_VALUE',
      'CURRENT_VALUE_BELOW_BALANCE',
      'CURRENT_VALUE_LOCKED_MISMATCH',
      'CURRENT_VALUE_BELOW_LOCKED',
      'INSUFFICIENT_PORTFOLIO_VALUE',
      'USER_NOT_FOUND'
    ]);

    if (financialErrors.has(error.message)) {
      const status = error.message === 'USER_NOT_FOUND' ? 404 : 400;
      return res.status(status).json({
        success: false,
        message: error.data?.message || error.message,
        error: error.message,
        data: error.data || undefined
      });
    }

    res.status(400).json({
      success: false,
      message: 'Update Error',
      error: error.message
    });
    next(error);
  }
};

// Delete user
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info('🗑️ Deleting user', {
      userId: id,
      adminUsername: req.admin?.username
    });

    // Get user data before deletion for audit
    const user = await User.findById(id);

    if (!user) {
      logger.warn('⚠️ User not found for deletion', {
        userId: id,
        adminUsername: req.admin?.username
      });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await User.findByIdAndDelete(id);

    // Create audit log
    await createAuditLog(req, res, {
      action: 'user_deleted',
      resourceType: 'user',
      resourceId: user._id.toString(),
      resourceName: user.email,
      deletedData: user.toObject(),
      description: `Deleted user: ${user.email}`
    });

    // Invalidate audit cache
    await invalidateAuditCache();

    logger.info('✅ User deleted successfully', {
      userId: id,
      adminUsername: req.admin?.username,
      userEmail: user.email
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('❌ Error deleting user', {
      error: error.message,
      userId: req.params.id,
      adminId: req.admin?.id
    });
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
    next(error);
  }
};

export {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};