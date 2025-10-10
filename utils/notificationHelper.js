import Notification from '../model/notification.model.js';
import User from '../model/user.model.js';
import { invalidateCache } from '../controllers/notification.controller.js';

/**
 * Create a notification for admin
 * @param {Object} options - Notification options
 * @param {string} options.action - Action type (user_created, deposit, withdraw, etc.)
 * @param {string} options.userId - User ID who triggered the action
 * @param {string} options.description - Custom description (optional, will be auto-generated)
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Notification>} Created notification
 */
export const createNotification = async (options) => {
  try {
    const { action, userId, description, metadata = {} } = options;

    // Fetch user details if userId is provided
    let user = null;
    let userEmail = null;

    if (userId) {
      user = await User.findById(userId).select('email username firstName lastName').lean();
      userEmail = user?.email;
    }

    // Generate description if not provided
    let finalDescription = description;
    
    if (!finalDescription) {
      finalDescription = generateDescription(action, user, metadata);
    }

    // Create notification
    const notification = await Notification.create({
      action,
      description: finalDescription,
      status: 'unread',
      metadata: {
        userId,
        userEmail,
        ...metadata
      }
    });

    console.log(`📬 Notification created: ${action} - ${finalDescription}`);
    
    // Invalidate notification cache
    invalidateCache();
    
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
};

/**
 * Generate description based on action and user data
 */
const generateDescription = (action, user, metadata = {}) => {
  const userIdentifier = user?.email || user?.username || 'A user';
  const amount = metadata.amount;
  const currency = metadata.currency || '';

  switch (action) {
    case 'user_created':
      return `${userIdentifier} just created an account`;

    case 'user_login':
      const authProvider = metadata.authProvider || 'platform';
      return `${userIdentifier} just logged in via ${authProvider}`;

    case 'kyc_submitted':
      return `${userIdentifier} submitted KYC application for review`;

    case 'kyc_approved':
      return `${userIdentifier}'s KYC application has been approved`;

    case 'kyc_rejected':
      return `${userIdentifier}'s KYC application has been rejected`;

    case 'deposit':
      if (amount) {
        return `${userIdentifier} just deposited ${currency}${amount}`;
      }
      return `${userIdentifier} just placed a deposit order`;

    case 'withdraw':
      if (amount) {
        return `${userIdentifier} just requested withdrawal of ${currency}${amount}`;
      }
      return `${userIdentifier} just placed a withdrawal request`;

    case 'copytrade_purchase':
      if (metadata.planName) {
        return `${userIdentifier} just purchased ${metadata.planName} copytrading plan`;
      }
      return `${userIdentifier} just made a copytrade purchase`;

    case 'support_ticket':
      if (metadata.subject) {
        return `${userIdentifier} just created a support ticket: "${metadata.subject}"`;
      }
      return `${userIdentifier} just created a support ticket`;

    default:
      return `${userIdentifier} performed an action: ${action}`;
  }
};

/**
 * Batch create notifications (useful for bulk operations)
 */
export const createBulkNotifications = async (notificationsArray) => {
  try {
    const notifications = await Notification.insertMany(notificationsArray);
    console.log(`📬 ${notifications.length} notifications created`);
    return notifications;
  } catch (error) {
    console.error('Failed to create bulk notifications:', error);
    return [];
  }
};

export default {
  createNotification,
  createBulkNotifications
};