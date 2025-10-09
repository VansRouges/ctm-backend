import User from "../model/user.model.js";
import { createNotification } from "../utils/notificationHelper.js";
import { createAuditLog } from "../utils/auditHelper.js";
import { invalidateAuditCache } from "./audit-log.controller.js";
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

// Get single user by ID
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: user
    });
    next(); // Call next middleware if needed
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
    next(error);
  }
};

// Get user by Clerk ID
const getUserByClerkId = async (req, res, next) => {
  try {
    const user = await User.findOne({ clerkId: req.params.clerkId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: user
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

// Update user
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info('📝 Updating user', {
      userId: id,
      adminUsername: req.admin?.username,
      updates: Object.keys(req.body)
    });

    // Get old user data before update
    const oldUser = await User.findById(id);
    
    if (!oldUser) {
      logger.warn('⚠️ User not found for update', {
        userId: id,
        adminUsername: req.admin?.username
      });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    );

    // Create audit log
    await createAuditLog(req, res, {
      action: 'user_updated',
      resourceType: 'user',
      resourceId: user._id.toString(),
      resourceName: user.email,
      changes: {
        before: oldUser.toObject(),
        after: user.toObject()
      },
      description: `Updated user: ${user.email}`
    });

    // Invalidate audit cache
    await invalidateAuditCache();

    logger.info('✅ User updated successfully', {
      userId: id,
      adminUsername: req.admin?.username,
      userEmail: user.email
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    logger.error('❌ Error updating user', {
      error: error.message,
      userId: req.params.id,
      adminId: req.admin?.id
    });
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
  getUserByClerkId,
  createUser,
  updateUser,
  deleteUser
};