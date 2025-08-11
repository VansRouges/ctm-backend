import CopytradingOption from '../models/copytrading-option.model.js';

class CopytradingOptionController {
  // Get all copytrading options
  static async getAllCopytradingOptions(req, res) {
    try {
      const copytradingOptions = await CopytradingOption.find().sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: copytradingOptions,
        count: copytradingOptions.length
      });
    } catch (error) {
      console.error('Error fetching copytrading options:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch copytrading options',
        error: error.message
      });
    }
  }

  // Create new copytrading option
  static async createCopytradingOption(req, res) {
    try {
      const {
        trade_title,
        trade_max,
        trade_min,
        user_id,
        user_name,
        trade_description,
        trade_roi_min,
        trade_roi_max,
        isRecommended,
        trade_risk,
        trade_duration,
        trade_approval_date,
        trade_end_date
      } = req.body;

      // Validate required fields
      const requiredFields = [
        'trade_title', 'trade_max', 'trade_min', 'user_id', 'user_name',
        'trade_description', 'trade_roi_min', 'trade_roi_max', 'trade_risk', 'trade_duration'
      ];

      for (const field of requiredFields) {
        if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
          return res.status(400).json({
            success: false,
            message: `${field} is required`
          });
        }
      }

      const copytradingOption = new CopytradingOption({
        trade_title,
        trade_max,
        trade_min,
        user_id,
        user_name,
        trade_description,
        trade_roi_min,
        trade_roi_max,
        isRecommended: isRecommended || false,
        trade_risk,
        trade_duration,
        trade_approval_date,
        trade_end_date
      });

      const savedCopytradingOption = await copytradingOption.save();

      res.status(201).json({
        success: true,
        message: 'Copytrading option created successfully',
        data: savedCopytradingOption
      });
    } catch (error) {
      console.error('Error creating copytrading option:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create copytrading option',
        error: error.message
      });
    }
  }

  // Update copytrading option
  static async updateCopytradingOption(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedCopytradingOption = await CopytradingOption.findByIdAndUpdate(
        id,
        updateData,
        { 
          new: true, 
          runValidators: true 
        }
      );

      if (!updatedCopytradingOption) {
        return res.status(404).json({
          success: false,
          message: 'Copytrading option not found'
        });
      }

      res.json({
        success: true,
        message: 'Copytrading option updated successfully',
        data: updatedCopytradingOption
      });
    } catch (error) {
      console.error('Error updating copytrading option:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update copytrading option',
        error: error.message
      });
    }
  }

  // Delete copytrading option
  static async deleteCopytradingOption(req, res) {
    try {
      const { id } = req.params;

      const deletedCopytradingOption = await CopytradingOption.findByIdAndDelete(id);

      if (!deletedCopytradingOption) {
        return res.status(404).json({
          success: false,
          message: 'Copytrading option not found'
        });
      }

      res.json({
        success: true,
        message: 'Copytrading option deleted successfully',
        data: deletedCopytradingOption
      });
    } catch (error) {
      console.error('Error deleting copytrading option:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete copytrading option',
        error: error.message
      });
    }
  }

  // Get copytrading option by ID
  static async getCopytradingOptionById(req, res) {
    try {
      const { id } = req.params;

      const copytradingOption = await CopytradingOption.findById(id);

      if (!copytradingOption) {
        return res.status(404).json({
          success: false,
          message: 'Copytrading option not found'
        });
      }

      res.json({
        success: true,
        data: copytradingOption
      });
    } catch (error) {
      console.error('Error fetching copytrading option:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch copytrading option',
        error: error.message
      });
    }
  }

  // Get copytrading options by user ID
  static async getCopytradingOptionsByUserId(req, res) {
    try {
      const { user_id } = req.params;

      const copytradingOptions = await CopytradingOption.find({ user_id }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: copytradingOptions,
        count: copytradingOptions.length
      });
    } catch (error) {
      console.error('Error fetching copytrading options by user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch copytrading options for user',
        error: error.message
      });
    }
  }

  // Get recommended copytrading options
  static async getRecommendedCopytradingOptions(req, res) {
    try {
      const recommendedOptions = await CopytradingOption.find({ isRecommended: true }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: recommendedOptions,
        count: recommendedOptions.length
      });
    } catch (error) {
      console.error('Error fetching recommended copytrading options:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recommended copytrading options',
        error: error.message
      });
    }
  }
}

export default CopytradingOptionController;