import CopytradingOption from '../model/copytrading-option.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
import logger from '../utils/logger.js';

class CopytradingOptionController {

  static async getAllCopytradingOptions(req, res) {
    try {
      logger.info('📊 Fetching all copytrading options', {
        adminUsername: req.admin?.username
      });

      const copytradingOptions = await CopytradingOption.find().sort({ createdAt: -1 });

      // Create audit log
      await createAuditLog(req, res, {
        action: 'copytrading_options_view_all',
        resourceType: 'copytrading_option',
        description: `Admin ${req.admin?.username || 'unknown'} viewed all copytrading options (${copytradingOptions.length} options)`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrading options retrieved successfully', {
        adminUsername: req.admin?.username,
        count: copytradingOptions.length
      });

      res.json({ success: true, data: copytradingOptions, count: copytradingOptions.length });
    } catch (error) {
      logger.error('❌ Error fetching copytrading options', {
        error: error.message,
        adminId: req.admin?.id
      });
      console.error('Error fetching copytrading options:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrading options', error: error.message });
    }
  }

  static async createCopytradingOption(req, res) {
    try {
      const {
        trade_title,
        trade_max,
        trade_min,
        user,
        trade_description,
        trade_roi_min,
        trade_roi_max,
        isRecommended,
        trade_risk,
        trade_duration
      } = req.body;

      logger.info('📝 Creating copytrading option', {
        adminUsername: req.admin?.username,
        trade_title,
        user
      });

      const requiredFields = [
        'trade_title', 'trade_max', 'trade_min', 'user',
        'trade_description', 'trade_roi_min', 'trade_roi_max', 'trade_risk', 'trade_duration'
      ];

      for (const field of requiredFields) {
        if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
          logger.warn('⚠️ Missing required field', {
            field,
            adminUsername: req.admin?.username
          });
          return res.status(400).json({ success: false, message: `${field} is required` });
        }
      }

      const validation = await validateBodyUser(user);
      if (!validation.ok) {
        logger.warn('⚠️ User validation failed', {
          userId: user,
          error: validation.message,
          adminUsername: req.admin?.username
        });
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const copytradingOption = new CopytradingOption({
        trade_title,
        trade_max,
        trade_min,
        user,
        trade_description,
        trade_roi_min,
        trade_roi_max,
        isRecommended: !!isRecommended,
        trade_risk,
        trade_duration
      });

      const savedCopytradingOption = await copytradingOption.save();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'copytrading_option_created',
        resourceType: 'copytrading_option',
        resourceId: savedCopytradingOption._id.toString(),
        resourceName: savedCopytradingOption.trade_title,
        description: `Created copytrading option: ${savedCopytradingOption.trade_title}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrading option created successfully', {
        optionId: savedCopytradingOption._id,
        adminUsername: req.admin?.username,
        trade_title: savedCopytradingOption.trade_title
      });

      res.status(201).json({
        success: true,
        message: 'Copytrading option created successfully',
        data: savedCopytradingOption
      });
    } catch (error) {
      logger.error('❌ Error creating copytrading option', {
        error: error.message,
        adminId: req.admin?.id,
        trade_title: req.body?.trade_title
      });
      console.error('Error creating copytrading option:', error);
      res.status(500).json({ success: false, message: 'Failed to create copytrading option', error: error.message });
    }
  }

  static async updateCopytradingOption(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      logger.info('📝 Updating copytrading option', {
        optionId: id,
        adminUsername: req.admin?.username,
        updates: Object.keys(updateData)
      });

      if (updateData.user) {
        const validation = await validateBodyUser(updateData.user);
        if (!validation.ok) {
          logger.warn('⚠️ User validation failed', {
            userId: updateData.user,
            error: validation.message,
            adminUsername: req.admin?.username
          });
          return res.status(validation.status).json({ success: false, message: validation.message });
        }
      }

      // Get old data before update
      const oldData = await CopytradingOption.findById(id);
      if (!oldData) {
        logger.warn('⚠️ Copytrading option not found', {
          optionId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({ success: false, message: 'Copytrading option not found' });
      }

      const updatedCopytradingOption = await CopytradingOption.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      // Create audit log
      await createAuditLog(req, res, {
        action: 'copytrading_option_updated',
        resourceType: 'copytrading_option',
        resourceId: updatedCopytradingOption._id.toString(),
        resourceName: updatedCopytradingOption.trade_title,
        changes: {
          before: oldData.toObject(),
          after: updatedCopytradingOption.toObject()
        },
        description: `Updated copytrading option: ${updatedCopytradingOption.trade_title}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrading option updated successfully', {
        optionId: id,
        adminUsername: req.admin?.username,
        trade_title: updatedCopytradingOption.trade_title
      });

      res.json({
        success: true,
        message: 'Copytrading option updated successfully',
        data: updatedCopytradingOption
      });
    } catch (error) {
      logger.error('❌ Error updating copytrading option', {
        error: error.message,
        optionId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error updating copytrading option:', error);
      res.status(500).json({ success: false, message: 'Failed to update copytrading option', error: error.message });
    }
  }

  static async deleteCopytradingOption(req, res) {
    try {
      const { id } = req.params;

      logger.info('🗑️ Deleting copytrading option', {
        optionId: id,
        adminUsername: req.admin?.username
      });

      // Get data before deletion for audit
      const copytradingOption = await CopytradingOption.findById(id);
      if (!copytradingOption) {
        logger.warn('⚠️ Copytrading option not found for deletion', {
          optionId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({ success: false, message: 'Copytrading option not found' });
      }

      await CopytradingOption.findByIdAndDelete(id);

      // Create audit log
      await createAuditLog(req, res, {
        action: 'copytrading_option_deleted',
        resourceType: 'copytrading_option',
        resourceId: id,
        resourceName: copytradingOption.trade_title,
        deletedData: copytradingOption.toObject(),
        description: `Deleted copytrading option: ${copytradingOption.trade_title}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrading option deleted successfully', {
        optionId: id,
        adminUsername: req.admin?.username,
        trade_title: copytradingOption.trade_title
      });

      res.json({ success: true, message: 'Copytrading option deleted successfully' });
    } catch (error) {
      logger.error('❌ Error deleting copytrading option', {
        error: error.message,
        optionId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error deleting copytrading option:', error);
      res.status(500).json({ success: false, message: 'Failed to delete copytrading option', error: error.message });
    }
  }

  static async getCopytradingOptionById(req, res) {
    try {
      const { id } = req.params;

      logger.info('🔍 Fetching copytrading option by ID', {
        optionId: id,
        adminUsername: req.admin?.username
      });

      const copytradingOption = await CopytradingOption.findById(id);
      if (!copytradingOption) {
        logger.warn('⚠️ Copytrading option not found', {
          optionId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({ success: false, message: 'Copytrading option not found' });
      }

      // Create audit log
      await createAuditLog(req, res, {
        action: 'copytrading_option_view',
        resourceType: 'copytrading_option',
        resourceId: copytradingOption._id.toString(),
        resourceName: copytradingOption.trade_title,
        description: `Viewed copytrading option: ${copytradingOption.trade_title}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Copytrading option retrieved successfully', {
        optionId: id,
        adminUsername: req.admin?.username,
        trade_title: copytradingOption.trade_title
      });

      res.json({ success: true, data: copytradingOption });
    } catch (error) {
      logger.error('❌ Error fetching copytrading option', {
        error: error.message,
        optionId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error fetching copytrading option:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrading option', error: error.message });
    }
  }

  static async getCopytradingOptionsByUserId(req, res) {
    try {
      const { userId } = req.params;
      const validation = await validateUserExists(userId);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }
      const copytradingOptions = await CopytradingOption.find({ user: userId }).sort({ createdAt: -1 });
      res.json({ success: true, data: copytradingOptions, count: copytradingOptions.length });
    } catch (error) {
      console.error('Error fetching copytrading options by user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch copytrading options for user',
        error: error.message
      });
    }
  }

  static async getRecommendedCopytradingOptions(req, res) {
    try {
      const recommendedOptions = await CopytradingOption.find({ isRecommended: true }).sort({ createdAt: -1 });
      res.json({ success: true, data: recommendedOptions, count: recommendedOptions.length });
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