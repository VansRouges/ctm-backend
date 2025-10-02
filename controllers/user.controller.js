import User from "../model/user.model.js";
import { createNotification } from "../utils/notificationHelper.js";
import { createAuditLog } from "../utils/auditHelper.js";
import { invalidateAuditCache } from "./audit-log.controller.js";

// Get all users
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-__v');
    res.json({
      success: true,
      message: "Users retrieved successfully",
      count: users.length,
      data: users
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
    // Get old user data before update
    const oldUser = await User.findById(req.params.id);
    
    if (!oldUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    );

    // Create audit log
    await createAuditLog(req, res, {
      action: 'user_update',
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

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
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
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create audit log
    await createAuditLog(req, res, {
      action: 'user_delete',
      resourceType: 'user',
      resourceId: user._id.toString(),
      resourceName: user.email,
      description: `Deleted user: ${user.email}`
    });

    // Invalidate audit cache
    await invalidateAuditCache();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
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