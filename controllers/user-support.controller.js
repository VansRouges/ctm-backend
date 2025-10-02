import UserSupport from '../model/user-support.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';
import { createNotification } from '../utils/notificationHelper.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';

class UserSupportController {
  // Get all user support tickets
  static async getAllUserSupport(req, res) {
    try {
      const userSupport = await UserSupport.find().sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: userSupport,
        count: userSupport.length
      });
    } catch (error) {
      console.error('Error fetching user support tickets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user support tickets',
        error: error.message
      });
    }
  }

  // Create new user support ticket
  static async createUserSupport(req, res) {
    try {
      const { user, full_name, priority, status, title, message, email } = req.body;

      // Validate required fields
      if (!user || !full_name || !title || !message || !email) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required: user, full_name, title, message, email'
        });
      }

      // Validate enum values
      const validPriorities = ['low', 'medium', 'high'];
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];

      if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Valid values: ${validPriorities.join(', ')}`
        });
      }

      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid values: ${validStatuses.join(', ')}`
        });
      }

      // Validate user exists
      const validation = await validateBodyUser(user);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const userSupport = new UserSupport({
        user,
        full_name,
        priority: priority || 'medium',
        status: status || 'open',
        title,
        message,
        email
      });

      const savedUserSupport = await userSupport.save();

      // Create notification for admin
      await createNotification({
        action: 'support_ticket',
        userId: user,
        metadata: {
          subject: title,
          priority: priority || 'medium',
          referenceId: savedUserSupport._id.toString()
        }
      });

      res.status(201).json({
        success: true,
        message: 'User support ticket created successfully',
        data: savedUserSupport
      });
    } catch (error) {
      console.error('Error creating user support ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user support ticket',
        error: error.message
      });
    }
  }

  // Update user support ticket
  static async updateUserSupport(req, res) {
    try {
      const { id } = req.params;
      const { user, full_name, priority, status, title, message, email } = req.body;

      // Validate enum values if provided
      const validPriorities = ['low', 'medium', 'high'];
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];

      if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Valid values: ${validPriorities.join(', ')}`
        });
      }

      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid values: ${validStatuses.join(', ')}`
        });
      }

      // If user field is being updated, validate it exists
      if (user) {
        const validation = await validateBodyUser(user);
        if (!validation.ok) {
          return res.status(validation.status).json({ success: false, message: validation.message });
        }
      }

      // Get old data before update
      const oldData = await UserSupport.findById(id);
      if (!oldData) {
        return res.status(404).json({
          success: false,
          message: 'User support ticket not found'
        });
      }

      const updatedUserSupport = await UserSupport.findByIdAndUpdate(
        id,
        {
          user,
          full_name,
          priority,
          status,
          title,
          message,
          email
        },
        { 
          new: true, 
          runValidators: true 
        }
      );

      // Create audit log
      await createAuditLog(req, res, {
        action: 'support_ticket_update',
        resourceType: 'support_ticket',
        resourceId: updatedUserSupport._id.toString(),
        resourceName: updatedUserSupport.title,
        changes: {
          before: oldData.toObject(),
          after: updatedUserSupport.toObject()
        },
        description: `Updated support ticket: ${updatedUserSupport.title}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'User support ticket updated successfully',
        data: updatedUserSupport
      });
    } catch (error) {
      console.error('Error updating user support ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user support ticket',
        error: error.message
      });
    }
  }

  // Delete user support ticket
  static async deleteUserSupport(req, res) {
    try {
      const { id } = req.params;

      const deletedUserSupport = await UserSupport.findByIdAndDelete(id);

      if (!deletedUserSupport) {
        return res.status(404).json({
          success: false,
          message: 'User support ticket not found'
        });
      }

      // Create audit log
      await createAuditLog(req, res, {
        action: 'support_ticket_delete',
        resourceType: 'support_ticket',
        resourceId: deletedUserSupport._id.toString(),
        resourceName: deletedUserSupport.title,
        description: `Deleted support ticket: ${deletedUserSupport.title}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'User support ticket deleted successfully',
        data: deletedUserSupport
      });
    } catch (error) {
      console.error('Error deleting user support ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user support ticket',
        error: error.message
      });
    }
  }

  // Get user support ticket by ID
  static async getUserSupportById(req, res) {
    try {
      const { id } = req.params;

      const userSupport = await UserSupport.findById(id);

      if (!userSupport) {
        return res.status(404).json({
          success: false,
          message: 'User support ticket not found'
        });
      }

      res.json({
        success: true,
        data: userSupport
      });
    } catch (error) {
      console.error('Error fetching user support ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user support ticket',
        error: error.message
      });
    }
  }

  // Get user support tickets by user ID
  static async getUserSupportByUserId(req, res) {
    try {
      const { userId } = req.params;

      // Validate user exists
      const validation = await validateUserExists(userId);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const userSupport = await UserSupport.find({ user: userId }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: userSupport,
        count: userSupport.length
      });
    } catch (error) {
      console.error('Error fetching user support tickets by user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user support tickets for user',
        error: error.message
      });
    }
  }

  // Get user support tickets by status
  static async getUserSupportByStatus(req, res) {
    try {
      const { status } = req.params;

      // Validate status enum
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid values: ${validStatuses.join(', ')}`
        });
      }

      const userSupport = await UserSupport.find({ status }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: userSupport,
        count: userSupport.length
      });
    } catch (error) {
      console.error('Error fetching user support tickets by status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user support tickets by status',
        error: error.message
      });
    }
  }

  // Get user support tickets by priority
  static async getUserSupportByPriority(req, res) {
    try {
      const { priority } = req.params;

      // Validate priority enum
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Valid values: ${validPriorities.join(', ')}`
        });
      }

      const userSupport = await UserSupport.find({ priority }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: userSupport,
        count: userSupport.length
      });
    } catch (error) {
      console.error('Error fetching user support tickets by priority:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user support tickets by priority',
        error: error.message
      });
    }
  }
}

export default UserSupportController;