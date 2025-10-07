import AdminEmail from '../model/admin-email.model.js';
import { createAuditLog } from '../utils/auditHelper.js';
import { invalidateAuditCache } from './audit-log.controller.js';

class AdminEmailController {
  // Get all admin emails
  static async getAllAdminEmails(req, res) {
    try {
      const adminEmails = await AdminEmail.find().sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: adminEmails,
        count: adminEmails.length
      });
    } catch (error) {
      console.error('Error fetching admin emails:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin emails',
        error: error.message
      });
    }
  }

  // Create new admin email
  static async createAdminEmail(req, res) {
    try {
      const { from, to, subject, message, status, email_id } = req.body;

      // Validate required fields
      if (!from || !to || !subject || !message || !email_id) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required: from, to, subject, message, email_id'
        });
      }

      const adminEmail = new AdminEmail({
        from,
        to,
        subject,
        message,
        status: status || 'pending',
        email_id
      });

      const savedAdminEmail = await adminEmail.save();

      // Create audit log
      await createAuditLog(req, res, {
        action: 'admin_email_created',
        resourceType: 'admin_email',
        resourceId: savedAdminEmail._id.toString(),
        resourceName: savedAdminEmail.subject,
        description: `Created admin email: ${savedAdminEmail.subject} (${savedAdminEmail.from} → ${savedAdminEmail.to})`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.status(201).json({
        success: true,
        message: 'Admin email created successfully',
        data: savedAdminEmail
      });
    } catch (error) {
      console.error('Error creating admin email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create admin email',
        error: error.message
      });
    }
  }

  // Update admin email
  static async updateAdminEmail(req, res) {
    try {
      const { id } = req.params;
      const { from, to, subject, message, status, email_id } = req.body;

      // Get old data before update
      const oldAdminEmail = await AdminEmail.findById(id);
      if (!oldAdminEmail) {
        return res.status(404).json({
          success: false,
          message: 'Admin email not found'
        });
      }

      const updatedAdminEmail = await AdminEmail.findByIdAndUpdate(
        id,
        {
          from,
          to,
          subject,
          message,
          status,
          email_id
        },
        { 
          new: true, 
          runValidators: true 
        }
      );

      // Create audit log
      await createAuditLog(req, res, {
        action: 'admin_email_updated',
        resourceType: 'admin_email',
        resourceId: updatedAdminEmail._id.toString(),
        resourceName: updatedAdminEmail.subject,
        changes: {
          before: oldAdminEmail.toObject(),
          after: updatedAdminEmail.toObject()
        },
        description: `Updated admin email: ${updatedAdminEmail.subject}`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'Admin email updated successfully',
        data: updatedAdminEmail
      });
    } catch (error) {
      console.error('Error updating admin email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update admin email',
        error: error.message
      });
    }
  }

  // Delete admin email
  static async deleteAdminEmail(req, res) {
    try {
      const { id } = req.params;

      const deletedAdminEmail = await AdminEmail.findByIdAndDelete(id);

      if (!deletedAdminEmail) {
        return res.status(404).json({
          success: false,
          message: 'Admin email not found'
        });
      }

      // Create audit log
      await createAuditLog(req, res, {
        action: 'admin_email_deleted',
        resourceType: 'admin_email',
        resourceId: deletedAdminEmail._id.toString(),
        resourceName: deletedAdminEmail.subject,
        description: `Deleted admin email: ${deletedAdminEmail.subject} (${deletedAdminEmail.from} → ${deletedAdminEmail.to})`
      });

      // Invalidate audit cache
      await invalidateAuditCache();

      res.json({
        success: true,
        message: 'Admin email deleted successfully',
        data: deletedAdminEmail
      });
    } catch (error) {
      console.error('Error deleting admin email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete admin email',
        error: error.message
      });
    }
  }

  // Get admin email by ID
  static async getAdminEmailById(req, res) {
    try {
      const { id } = req.params;

      const adminEmail = await AdminEmail.findById(id);

      if (!adminEmail) {
        return res.status(404).json({
          success: false,
          message: 'Admin email not found'
        });
      }

      res.json({
        success: true,
        data: adminEmail
      });
    } catch (error) {
      console.error('Error fetching admin email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin email',
        error: error.message
      });
    }
  }

  // Get admin email by email_id
  static async getAdminEmailByEmailId(req, res) {
    try {
      const { email_id } = req.params;

      const adminEmail = await AdminEmail.findOne({ email_id });

      if (!adminEmail) {
        return res.status(404).json({
          success: false,
          message: 'Admin email not found'
        });
      }

      res.json({
        success: true,
        data: adminEmail
      });
    } catch (error) {
      console.error('Error fetching admin email by email_id:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin email',
        error: error.message
      });
    }
  }

  // Get admin emails by status
  static async getAdminEmailsByStatus(req, res) {
    try {
      const { status } = req.params;

      const adminEmails = await AdminEmail.find({ status }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: adminEmails,
        count: adminEmails.length
      });
    } catch (error) {
      console.error('Error fetching admin emails by status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin emails by status',
        error: error.message
      });
    }
  }
}

export default AdminEmailController;