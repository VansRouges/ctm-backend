import CryptoOption from '../model/crypto-option.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';

class CryptoOptionController {
  // Get all crypto options
  static async getAllCryptoOptions(req, res) {
    try {
      const cryptoOptions = await CryptoOption.find().sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: cryptoOptions,
        count: cryptoOptions.length
      });
    } catch (error) {
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

      // Validate required fields
      if (!token_name || !token_address || !user || !token_symbol) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required: token_name, token_address, user, token_symbol'
        });
      }

      const validation = await validateBodyUser(user);
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, message: validation.message });
      }

      const cryptoOption = new CryptoOption({
        token_name,
        token_address,
        user,
        token_symbol
      });

      const savedCryptoOption = await cryptoOption.save();

      res.status(201).json({
        success: true,
        message: 'Crypto option created successfully',
        data: savedCryptoOption
      });
    } catch (error) {
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

      if (user) {
        const validation = await validateBodyUser(user);
        if (!validation.ok) {
          return res.status(validation.status).json({ success: false, message: validation.message });
        }
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

      if (!updatedCryptoOption) {
        return res.status(404).json({
          success: false,
          message: 'Crypto option not found'
        });
      }

      res.json({
        success: true,
        message: 'Crypto option updated successfully',
        data: updatedCryptoOption
      });
    } catch (error) {
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

      const deletedCryptoOption = await CryptoOption.findByIdAndDelete(id);

      if (!deletedCryptoOption) {
        return res.status(404).json({
          success: false,
          message: 'Crypto option not found'
        });
      }

      res.json({
        success: true,
        message: 'Crypto option deleted successfully',
        data: deletedCryptoOption
      });
    } catch (error) {
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