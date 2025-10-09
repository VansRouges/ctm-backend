import CryptoOption from '../model/crypto-option.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';
import logger from '../utils/logger.js';

class CryptoOptionController {
  // Get all crypto options
  static async getAllCryptoOptions(req, res) {
    try {
      logger.info('🪙 Fetching all crypto options', {
        adminUsername: req.admin?.username
      });

      const cryptoOptions = await CryptoOption.find().sort({ createdAt: -1 });

      // Create audit log
      await createAuditLog(req, res, {
        action: 'crypto_options_view_all',
        resourceType: 'crypto_option',
        description: `Admin ${req.admin?.username || 'unknown'} viewed all crypto options (${cryptoOptions.length} options)`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Crypto options retrieved successfully', {
        adminUsername: req.admin?.username,
        count: cryptoOptions.length
      });
      
      res.json({
        success: true,
        data: cryptoOptions,
        count: cryptoOptions.length
      });
    } catch (error) {
      logger.error('❌ Error fetching crypto options', {
        error: error.message,
        adminId: req.admin?.id
      });
      console.error('Error fetching crypto options:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch crypto options',
        error: error.message
      });
    }
  }

  // Create new crypto option
  static async createCryptoOption(req, res) {
    try {
      const { token_name, token_address, user, token_symbol } = req.body;

      logger.info('📝 Creating crypto option', {
        adminUsername: req.admin?.username,
        token_name,
        token_symbol,
        user
      });

      // Validate required fields
      if (!token_name || !token_address || !user || !token_symbol) {
        logger.warn('⚠️ Missing required fields for crypto option creation', {
          adminUsername: req.admin?.username,
          providedFields: Object.keys(req.body)
        });
        return res.status(400).json({
          success: false,
          message: 'All fields are required: token_name, token_address, user, token_symbol'
        });
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

      const cryptoOption = new CryptoOption({
        token_name,
        token_address,
        user,
        token_symbol
      });

      const savedCryptoOption = await cryptoOption.save();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'crypto_option_created',
        resourceType: 'crypto_option',
        resourceId: savedCryptoOption._id.toString(),
        resourceName: `${savedCryptoOption.token_name} (${savedCryptoOption.token_symbol})`,
        description: `Created crypto option: ${savedCryptoOption.token_name} (${savedCryptoOption.token_symbol})`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Crypto option created successfully', {
        optionId: savedCryptoOption._id,
        adminUsername: req.admin?.username,
        token_name: savedCryptoOption.token_name,
        token_symbol: savedCryptoOption.token_symbol
      });

      res.status(201).json({
        success: true,
        message: 'Crypto option created successfully',
        data: savedCryptoOption
      });
    } catch (error) {
      logger.error('❌ Error creating crypto option', {
        error: error.message,
        adminId: req.admin?.id,
        token_name: req.body?.token_name
      });
      console.error('Error creating crypto option:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create crypto option',
        error: error.message
      });
    }
  }

  // Update crypto option
  static async updateCryptoOption(req, res) {
    try {
      const { id } = req.params;
      const { token_name, token_address, user, token_symbol } = req.body;

      logger.info('📝 Updating crypto option', {
        optionId: id,
        adminUsername: req.admin?.username,
        updates: Object.keys(req.body)
      });

      if (user) {
        const validation = await validateBodyUser(user);
        if (!validation.ok) {
          logger.warn('⚠️ User validation failed', {
            userId: user,
            error: validation.message,
            adminUsername: req.admin?.username
          });
          return res.status(validation.status).json({ success: false, message: validation.message });
        }
      }

      // Get old data before update
      const oldData = await CryptoOption.findById(id);
      if (!oldData) {
        logger.warn('⚠️ Crypto option not found', {
          optionId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({
          success: false,
          message: 'Crypto option not found'
        });
      }

      const updatedCryptoOption = await CryptoOption.findByIdAndUpdate(
        id,
        {
          token_name,
          token_address,
          user,
          token_symbol
        },
        { 
          new: true, 
          runValidators: true 
        }
      );

      // Create audit log
      await createAuditLog(req, res, {
        action: 'crypto_option_updated',
        resourceType: 'crypto_option',
        resourceId: updatedCryptoOption._id.toString(),
        resourceName: `${updatedCryptoOption.token_name} (${updatedCryptoOption.token_symbol})`,
        changes: {
          before: oldData.toObject(),
          after: updatedCryptoOption.toObject()
        },
        description: `Updated crypto option: ${updatedCryptoOption.token_name} (${updatedCryptoOption.token_symbol})`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Crypto option updated successfully', {
        optionId: id,
        adminUsername: req.admin?.username,
        token_name: updatedCryptoOption.token_name,
        token_symbol: updatedCryptoOption.token_symbol
      });

      res.json({
        success: true,
        message: 'Crypto option updated successfully',
        data: updatedCryptoOption
      });
    } catch (error) {
      logger.error('❌ Error updating crypto option', {
        error: error.message,
        optionId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error updating crypto option:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update crypto option',
        error: error.message
      });
    }
  }

  // Delete crypto option
  static async deleteCryptoOption(req, res) {
    try {
      const { id } = req.params;

      logger.info('🗑️ Deleting crypto option', {
        optionId: id,
        adminUsername: req.admin?.username
      });

      // Get crypto option data before deletion for audit
      const cryptoOptionToDelete = await CryptoOption.findById(id);

      if (!cryptoOptionToDelete) {
        logger.warn('⚠️ Crypto option not found for deletion', {
          optionId: id,
          adminUsername: req.admin?.username
        });
        return res.status(404).json({
          success: false,
          message: 'Crypto option not found'
        });
      }

      const deletedCryptoOption = await CryptoOption.findByIdAndDelete(id);

      // Create audit log
      await createAuditLog(req, res, {
        action: 'crypto_option_deleted',
        resourceType: 'crypto_option',
        resourceId: id,
        resourceName: `${cryptoOptionToDelete.token_name} (${cryptoOptionToDelete.token_symbol})`,
        deletedData: cryptoOptionToDelete.toObject(),
        description: `Deleted crypto option: ${cryptoOptionToDelete.token_name} (${cryptoOptionToDelete.token_symbol})`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      logger.info('✅ Crypto option deleted successfully', {
        optionId: id,
        adminUsername: req.admin?.username,
        token_name: cryptoOptionToDelete.token_name,
        token_symbol: cryptoOptionToDelete.token_symbol
      });

      res.json({
        success: true,
        message: 'Crypto option deleted successfully',
        data: deletedCryptoOption
      });
    } catch (error) {
      logger.error('❌ Error deleting crypto option', {
        error: error.message,
        optionId: req.params.id,
        adminId: req.admin?.id
      });
      console.error('Error deleting crypto option:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete crypto option',
        error: error.message
      });
    }
  }

  // Get crypto option by ID
  static async getCryptoOptionById(req, res) {
    try {
      const { id } = req.params;

      const cryptoOption = await CryptoOption.findById(id);

      if (!cryptoOption) {
        return res.status(404).json({
          success: false,
          message: 'Crypto option not found'
        });
      }

      res.json({
        success: true,
        data: cryptoOption
      });
    } catch (error) {
      console.error('Error fetching crypto option:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch crypto option',
        error: error.message
      });
    }
  }

  // Get crypto options by user ID
  static async getCryptoOptionsByUserId(req, res) {
    try {
      const { userId } = req.params;
      const validation = await validateUserExists(userId);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const cryptoOptions = await CryptoOption.find({ user: userId }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: cryptoOptions,
        count: cryptoOptions.length
      });
    } catch (error) {
      console.error('Error fetching crypto options by user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch crypto options for user',
        error: error.message
      });
    }
  }
}

export default CryptoOptionController;