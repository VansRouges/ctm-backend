import CopytradePurchase from '../model/copytrade-purchase.model.js';
import { validateUserExists, validateBodyUser } from '../utils/userValidation.js';

class CopytradePurchaseController {
  static async createCopytradePurchase(req, res) {
    try {
      const {
        user,
        trade_title,
        trade_max,
        trade_min,
        trade_risk,
        trade_roi_min,
        trade_roi_max,
        trade_duration,
        initial_investment,
        trade_current_value,
        trade_profit_loss,
        trade_status,
        trade_token,
        trade_token_address,
        trade_win_rate,
        trade_approval_date,
        trade_end_date
      } = req.body;

      const required = [ 'user','trade_title','trade_max','trade_min','trade_risk','trade_roi_min','trade_roi_max','trade_duration','initial_investment','trade_current_value','trade_token','trade_token_address' ];
      for (const f of required) {
        if (req.body[f] === undefined || req.body[f] === null || req.body[f] === '') {
          return res.status(400).json({ success: false, message: `${f} is required` });
        }
      }

      const validation = await validateBodyUser(user);
      if (!validation.ok) return res.status(validation.status).json({ success: false, message: validation.message });

      const doc = new CopytradePurchase({
        user,
        trade_title,
        trade_max,
        trade_min,
        trade_risk,
        trade_roi_min,
        trade_roi_max,
        trade_duration,
        initial_investment,
        trade_current_value,
        trade_profit_loss: trade_profit_loss !== undefined ? trade_profit_loss : trade_current_value - initial_investment,
        trade_status: trade_status || 'active',
        trade_token,
        trade_token_address,
        trade_win_rate,
        trade_approval_date,
        trade_end_date
      });

      const saved = await doc.save();
      res.status(201).json({ success: true, message: 'Copytrade purchase created successfully', data: saved });
    } catch (error) {
      console.error('Error creating copytrade purchase:', error);
      res.status(500).json({ success: false, message: 'Failed to create copytrade purchase', error: error.message });
    }
  }

  static async getAllCopytradePurchases(req, res) {
    try {
      const items = await CopytradePurchase.find().sort({ createdAt: -1 });
      res.json({ success: true, data: items, count: items.length });
    } catch (error) {
      console.error('Error fetching copytrade purchases:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrade purchases', error: error.message });
    }
  }

  static async getCopytradePurchaseById(req, res) {
    try {
      const { id } = req.params;
      const doc = await CopytradePurchase.findById(id);
      if (!doc) return res.status(404).json({ success: false, message: 'Copytrade purchase not found' });
      res.json({ success: true, data: doc });
    } catch (error) {
      console.error('Error fetching copytrade purchase:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrade purchase', error: error.message });
    }
  }

  static async getCopytradePurchasesByUser(req, res) {
    try {
      const { userId } = req.params;
      const validation = await validateUserExists(userId);
      if (!validation.ok) return res.status(validation.status).json({ success: false, message: validation.message });
      const items = await CopytradePurchase.find({ user: userId }).sort({ createdAt: -1 });
      res.json({ success: true, data: items, count: items.length });
    } catch (error) {
      console.error('Error fetching copytrade purchases for user:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch copytrade purchases for user', error: error.message });
    }
  }

  static async updateCopytradePurchase(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      if (updateData.user) {
        const validation = await validateBodyUser(updateData.user);
        if (!validation.ok) return res.status(validation.status).json({ success: false, message: validation.message });
      }

      if (updateData.trade_current_value !== undefined || updateData.initial_investment !== undefined) {
        const existing = await CopytradePurchase.findById(id);
        if (!existing) return res.status(404).json({ success: false, message: 'Copytrade purchase not found' });
        Object.assign(existing, updateData);
        await existing.save();
        return res.json({ success: true, message: 'Copytrade purchase updated successfully', data: existing });
      }

      const updated = await CopytradePurchase.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ success: false, message: 'Copytrade purchase not found' });
      res.json({ success: true, message: 'Copytrade purchase updated successfully', data: updated });
    } catch (error) {
      console.error('Error updating copytrade purchase:', error);
      res.status(500).json({ success: false, message: 'Failed to update copytrade purchase', error: error.message });
    }
  }

  static async deleteCopytradePurchase(req, res) {
    try {
      const { id } = req.params;
      const deleted = await CopytradePurchase.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Copytrade purchase not found' });
      res.json({ success: true, message: 'Copytrade purchase deleted successfully', data: deleted });
    } catch (error) {
      console.error('Error deleting copytrade purchase:', error);
      res.status(500).json({ success: false, message: 'Failed to delete copytrade purchase', error: error.message });
    }
  }
}

export default CopytradePurchaseController;
