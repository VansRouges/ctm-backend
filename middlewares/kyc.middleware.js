// middlewares/kyc.middleware.js
import User from '../model/user.model.js';
import logger from '../utils/logger.js';

/**
 * Require the authenticated user to have approved KYC (User.kycStatus === true).
 * Must run after requireUserAuth.
 */
export const requireKycApproved = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const user = await User.findById(userId).select('kycStatus email');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.kycStatus) {
      logger.warn('🚫 KYC required — blocked action', {
        userId: user._id,
        email: user.email,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        code: 'KYC_REQUIRED',
        message: 'KYC verification is required before you can perform this action. Please complete KYC and wait for approval.'
      });
    }

    next();
  } catch (error) {
    logger.error('❌ KYC middleware error', {
      error: error.message,
      userId: req.user?.userId
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to verify KYC status'
    });
  }
};

export default requireKycApproved;
