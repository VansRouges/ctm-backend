import UserSupport from '../model/user-support.model.js';

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
      const { user_id, full_name, priority, status, title, message, email } = req.body;

      // Validate required fields
      if (!user_id || !full_name || !title || !message || !email) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required: user_id, full_name, title, message, email'
        });
      }

      const userSupport = new UserSupport({
        user_id,
        full_name,
        priority: priority || 'medium',
        status: status || 'open',
        title,
        message,
        email
      });

      const savedUserSupport = await userSupport.save();

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
      const { user_id, full_name, priority, status, title, message, email } = req.body;

      const updatedUserSupport = await UserSupport.findByIdAndUpdate(
        id,
        {
          user_id,
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

      if (!updatedUserSupport) {
        return res.status(404).json({
          success: false,
          message: 'User support ticket not found'
        });
      }

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
      const { user_id } = req.params;

      const userSupport = await UserSupport.find({ user_id }).sort({ createdAt: -1 });

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