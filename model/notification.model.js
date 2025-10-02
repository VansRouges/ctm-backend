import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ['user_created', 'deposit', 'withdraw', 'copytrade_purchase', 'support_ticket'],
      index: true
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['unread', 'read'],
      default: 'unread',
      index: true
    },
    metadata: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      userEmail: String,
      amount: Number,
      currency: String,
      referenceId: String, // ID of the related resource (deposit ID, withdraw ID, etc.)
      additionalInfo: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt
  }
);

// Index for efficient queries
notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ action: 1, createdAt: -1 });

// Virtual for time formatting
notificationSchema.virtual('timeAgo').get(function() {
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
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;