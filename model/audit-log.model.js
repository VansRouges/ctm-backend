import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      id: {
        type: String,
        required: true
      },
      username: String,
      email: String
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Authentication
        'admin_login',
        'admin_logout',
        
        // User Management
        'users_view_all',
        'user_updated',
        'user_deleted',
        
        // Deposits
        'deposits_view_all',
        'deposit_updated',
        'deposit_deleted',
        'deposit_status_changed',
        
        // Withdrawals
        'withdrawals_view_all',
        'withdraw_updated',
        'withdraw_deleted',
        'withdraw_status_changed',
        
        // Copytrading Options
        'copytrading_options_view_all',
        'copytrading_option_created',
        'copytrading_option_updated',
        'copytrading_option_deleted',
        
        // Copytrade Purchases
        'copytrade_purchase_view_all',
        'copytrade_purchase_viewed',
        'copytrade_purchase_updated',
        'copytrade_purchase_deleted',
        
        // Crypto Options
        'crypto_options_view_all',
        'crypto_option_created',
        'crypto_option_updated',
        'crypto_option_deleted',
        
        // User Support
        'support_tickets_view_all',
        'support_ticket_updated',
        'support_ticket_deleted',
        
        // Admin Emails
        'admin_emails_view_all',
        'admin_email_created',
        'admin_email_updated',
        'admin_email_deleted',
        
        // Notifications
        'notifications_view_all',
        'notification_status_updated',
        'notifications_unread_count_viewed',
        'notification_deleted',
        'notifications_marked_all_read',
        'notifications_deleted_all_read',
        
        // System
        'stock_update_triggered',
        
        // Other
        'other_action'
      ],
      index: true
    },
    resource: {
      type: {
        type: String,
        enum: ['user', 'deposit', 'withdraw', 'copytrading_option', 'copytrade_purchase', 
               'crypto_option', 'support_ticket', 'admin_email', 'notification', 'system', 'auth'],
        required: true
      },
      id: String, // Resource ID if applicable
      name: String // Resource name/identifier
    },
    description: {
      type: String,
      required: true
    },
    changes: {
      type: mongoose.Schema.Types.Mixed, // Store before/after values
      default: {}
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      statusCode: Number,
      method: String,
      endpoint: String,
      additionalInfo: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true // createdAt and updatedAt
  }
);

// Indexes for efficient queries
auditLogSchema.index({ 'admin.id': 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ 'resource.type': 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// Virtual for formatting
auditLogSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
});

// Enable virtuals in JSON
auditLogSchema.set('toJSON', { virtuals: true });
auditLogSchema.set('toObject', { virtuals: true });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;