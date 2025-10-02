import User from "../model/user.model.js";
import { createNotification } from "../utils/notificationHelper.js";

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
const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
    next();
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
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

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