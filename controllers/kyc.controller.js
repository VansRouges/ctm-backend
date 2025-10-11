import KYC from '../model/kyc.model.js';
import User from '../model/user.model.js';
import logger from '../utils/logger.js';
import { createNotification } from '../utils/notificationHelper.js';
import { createAuditLog } from '../utils/auditHelper.js';

// Helper function to extract file key from Cloudinary URL
const extractFileKeyFromUrl = (url) => {
  try {
    const matches = url.match(/\/v\d+\/(.+?)(?:\.|$)/);
    return matches ? matches[1] : null;
  } catch (error) {
    logger.error('Error extracting file key from URL', { url, error: error.message });
    return null;
  }
};

// Helper function to delete KYC document from Cloudinary
const deleteKYCDocument = async (fileKey) => {
  try {
    // Note: Implement Cloudinary deletion logic here if needed
    // Example: await cloudinary.uploader.destroy(fileKey);
    logger.info('Document deletion attempted', { fileKey });
    return true;
  } catch (error) {
    logger.error('Error deleting KYC document', { fileKey, error: error.message });
    return false;
  }
};

// User endpoint - Submit KYC application
export const submitKYC = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      fullName,
      dateOfBirth,
      phoneNumber,
      address,
      validIdUrl,
      passportUrl,
      validIdFileName,
      passportFileName,
      validIdFileSize,
      passportFileSize
    } = req.body;

    logger.info('🔍 KYC submission attempt', {
      userId,
      fullName,
      hasValidIdUrl: !!validIdUrl,
      hasPassportUrl: !!passportUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Validate required fields
    if (!fullName || !dateOfBirth || !phoneNumber || !address) {
      logger.warn('❌ KYC validation failed - missing required fields', {
        userId,
        hasFullName: !!fullName,
        hasDateOfBirth: !!dateOfBirth,
        hasPhoneNumber: !!phoneNumber,
        hasAddress: !!address
      });

      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fullName, dateOfBirth, phoneNumber, and address are required'
      });
    }

    // Validate address structure
    const requiredAddressFields = ['street', 'city', 'state', 'country', 'postalCode'];
    const missingAddressFields = requiredAddressFields.filter(field => !address[field]);
    
    if (missingAddressFields.length > 0) {
      logger.warn('❌ KYC validation failed - incomplete address', {
        userId,
        missingAddressFields
      });

      return res.status(400).json({
        success: false,
        message: `Missing address fields: ${missingAddressFields.join(', ')}`
      });
    }

    // Validate document URLs (uploaded via Cloudinary)
    if (!validIdUrl || !passportUrl) {
      logger.warn('❌ KYC validation failed - missing document URLs', {
        userId,
        hasValidIdUrl: !!validIdUrl,
        hasPassportUrl: !!passportUrl
      });

      return res.status(400).json({
        success: false,
        message: 'Both valid ID and passport document URLs are required. Please upload documents first.'
      });
    }

    // Validate Cloudinary URLs
    const validIdUrlPattern = /^https:\/\/res\.cloudinary\.com\/.+/;
    const passportUrlPattern = /^https:\/\/res\.cloudinary\.com\/.+/;

    if (!validIdUrlPattern.test(validIdUrl) || !passportUrlPattern.test(passportUrl)) {
      logger.warn('❌ KYC validation failed - invalid document URLs', {
        userId,
        validIdUrl: validIdUrl?.substring(0, 50),
        passportUrl: passportUrl?.substring(0, 50)
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid document URLs. Please ensure files are uploaded through the proper upload service.'
      });
    }

    // Check if user already has KYC
    const existingKYC = await KYC.findOne({ userId });
    
    if (existingKYC && !existingKYC.canResubmit()) {
      logger.warn('❌ KYC submission blocked - already exists or max resubmissions reached', {
        userId,
        existingStatus: existingKYC.status,
        resubmissionCount: existingKYC.resubmissionCount
      });

      return res.status(409).json({
        success: false,
        message: existingKYC.status === 'approved' 
          ? 'KYC already approved'
          : 'Maximum resubmission limit reached'
      });
    }

    logger.info('📝 Processing KYC submission with Cloudinary URLs', {
      userId,
      validIdUrl: validIdUrl.substring(0, 50) + '...',
      passportUrl: passportUrl.substring(0, 50) + '...'
    });

    // Prepare KYC data
    const kycData = {
      userId,
      fullName: fullName.trim(),
      dateOfBirth: new Date(dateOfBirth),
      phoneNumber: phoneNumber.trim(),
      address: {
        street: address.street.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        country: address.country.trim(),
        postalCode: address.postalCode.trim()
      },
      documents: {
        validId: {
          fileName: validIdFileName || 'valid-id-document',
          fileUrl: validIdUrl,
          fileSize: parseInt(validIdFileSize) || 0,
          uploadedAt: new Date()
        },
        passport: {
          fileName: passportFileName || 'passport-document',
          fileUrl: passportUrl,
          fileSize: parseInt(passportFileSize) || 0,
          uploadedAt: new Date()
        }
      },
      status: 'pending',
      submittedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Create or update KYC
    let kyc;
    if (existingKYC) {
      // Delete old documents if resubmitting
      if (existingKYC.documents?.validId?.fileUrl) {
        const oldValidIdKey = extractFileKeyFromUrl(existingKYC.documents.validId.fileUrl);
        if (oldValidIdKey) await deleteKYCDocument(oldValidIdKey);
      }
      if (existingKYC.documents?.passport?.fileUrl) {
        const oldPassportKey = extractFileKeyFromUrl(existingKYC.documents.passport.fileUrl);
        if (oldPassportKey) await deleteKYCDocument(oldPassportKey);
      }

      // Update existing KYC
      Object.assign(existingKYC, kycData);
      kyc = await existingKYC.save();
      
      logger.info('📝 KYC resubmitted', {
        userId,
        kycId: kyc._id,
        resubmissionCount: kyc.resubmissionCount
      });
    } else {
      // Create new KYC
      kyc = new KYC(kycData);
      await kyc.save();
      
      logger.info('✅ New KYC submitted', {
        userId,
        kycId: kyc._id
      });
    }

    // Create notification for admin
    await createNotification({
      action: 'kyc_submitted',
      description: `User ${req.user.email || 'Unknown'} submitted KYC application for review`,
      metadata: {
        userId,
        userEmail: req.user.email,
        kycId: kyc._id.toString(),
        referenceId: kyc._id.toString(),
        additionalInfo: {
          submissionType: existingKYC ? 'resubmission' : 'new_submission',
          submissionTime: new Date().toISOString(),
          documentCount: 2,
          uploadMethod: 'cloudinary'
        }
      }
    });

    logger.info('🎉 KYC submission successful', {
      userId,
      kycId: kyc._id,
      status: kyc.status
    });

    // Return success response (without sensitive document URLs)
    res.status(201).json({
      success: true,
      message: existingKYC ? 'KYC resubmitted successfully' : 'KYC submitted successfully',
      kyc: {
        id: kyc._id,
        status: kyc.status,
        submittedAt: kyc.submittedAt,
        resubmissionCount: kyc.resubmissionCount,
        canResubmit: kyc.canResubmit()
      }
    });

  } catch (error) {
    logger.error('❌ KYC submission error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during KYC submission'
    });
  }
};

// User endpoint - Get user's KYC status
export const getUserKYC = async (req, res) => {
  try {
    const userId = req.user.userId;

    const kyc = await KYC.getUserKYC(userId);

    if (!kyc) {
      return res.json({
        success: true,
        kyc: null,
        message: 'No KYC application found'
      });
    }

    // Return KYC data without document URLs for security
    const kycResponse = {
      id: kyc._id,
      status: kyc.status,
      fullName: kyc.fullName,
      dateOfBirth: kyc.dateOfBirth,
      phoneNumber: kyc.phoneNumber,
      address: kyc.address,
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt,
      reviewNotes: kyc.reviewNotes,
      rejectionReason: kyc.rejectionReason,
      resubmissionCount: kyc.resubmissionCount,
      canResubmit: kyc.canResubmit(),
      age: kyc.age,
      daysSinceSubmission: kyc.daysSinceSubmission,
      documentCount: kyc.documentCount
    };

    logger.info('📋 User KYC status retrieved', {
      userId,
      kycId: kyc._id,
      status: kyc.status
    });

    res.json({
      success: true,
      kyc: kycResponse
    });

  } catch (error) {
    logger.error('❌ Get user KYC error', {
      error: error.message,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving KYC'
    });
  }
};

// Admin endpoint - Get all KYC applications
export const getAllKYCs = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, sortBy = 'submittedAt', sortOrder = 'desc' } = req.query;

    logger.info('🔍 Admin retrieving KYC applications', {
      adminId: req.admin?.id,
      filters: { status, page, limit, sortBy, sortOrder }
    });

    const query = status ? { status } : {};
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [kycs, total] = await Promise.all([
      KYC.find(query)
        .populate('userId', 'email firstName lastName createdAt')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      KYC.countDocuments(query)
    ]);

    // Add virtual fields manually for lean queries
    const enrichedKYCs = kycs.map(kyc => ({
      ...kyc,
      age: kyc.dateOfBirth ? Math.floor((Date.now() - new Date(kyc.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
      daysSinceSubmission: kyc.submittedAt ? Math.ceil((Date.now() - new Date(kyc.submittedAt).getTime()) / (24 * 60 * 60 * 1000)) : 0,
      documentCount: (kyc.documents?.validId?.fileUrl ? 1 : 0) + (kyc.documents?.passport?.fileUrl ? 1 : 0),
      canResubmit: kyc.resubmissionCount < 3 && ['rejected', 'resubmission_required'].includes(kyc.status)
    }));

    await createAuditLog(req, res, {
      action: 'kyc_applications_view_all',
      resourceType: 'kyc',
      description: `Admin viewed KYC applications with filters: ${JSON.stringify({ status, page, limit })}`,
      changes: {
        totalResults: total,
        filters: { status, page, limit, sortBy, sortOrder }
      }
    });

    logger.info('✅ KYC applications retrieved successfully', {
      adminId: req.admin?.id,
      count: kycs.length,
      total,
      page
    });

    res.json({
      success: true,
      kycs: enrichedKYCs,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: kycs.length,
        totalRecords: total
      }
    });

  } catch (error) {
    logger.error('❌ Get all KYCs error', {
      error: error.message,
      adminId: req.admin?.id
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving KYCs'
    });
  }
};

// Admin endpoint - Get specific KYC application
export const getKYCById = async (req, res) => {
  try {
    const { id } = req.params;

    const kyc = await KYC.findById(id)
      .populate('userId', 'email firstName lastName createdAt lastLogin');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC application not found'
      });
    }

    await createAuditLog(req, res, {
      action: 'kyc_application_viewed',
      resourceType: 'kyc',
      resourceId: id,
      description: `Admin viewed KYC application for user ${kyc.userId.email}`,
      changes: {
        kycStatus: kyc.status,
        userId: kyc.userId._id
      }
    });

    logger.info('📋 KYC application retrieved by admin', {
      adminId: req.admin?.id,
      kycId: id,
      userId: kyc.userId._id,
      status: kyc.status
    });

    res.json({
      success: true,
      kyc
    });

  } catch (error) {
    logger.error('❌ Get KYC by ID error', {
      error: error.message,
      kycId: req.params.id,
      adminId: req.admin?.id
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving KYC'
    });
  }
};

// Admin endpoint - Update KYC status
export const updateKYCStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes, rejectionReason } = req.body;

    const validStatuses = ['pending', 'under_review', 'approved', 'rejected', 'resubmission_required'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const kyc = await KYC.findById(id).populate('userId', 'email firstName lastName');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC application not found'
      });
    }

    const oldStatus = kyc.status;

    // Update KYC status
    kyc.status = status;
    kyc.reviewedBy = req.admin.id;
    kyc.reviewedAt = new Date();
    
    if (reviewNotes) {
      kyc.reviewNotes = reviewNotes.trim();
    }
    
    if (status === 'rejected' && rejectionReason) {
      kyc.rejectionReason = rejectionReason.trim();
    }

    await kyc.save();

    // Sync user's kycStatus field with KYC approval status
    const userKycStatus = status === 'approved';
    await User.findByIdAndUpdate(
      kyc.userId._id,
      { kycStatus: userKycStatus },
      { new: true }
    );

    logger.info('🔄 User kycStatus synchronized', {
      userId: kyc.userId._id,
      kycStatus: userKycStatus,
      kycRecordStatus: status
    });

    // Send notification to user about KYC status change
    if (status === 'approved') {
      await createNotification({
        action: 'kyc_approved',
        userId: kyc.userId._id,
        description: 'Your KYC application has been approved. You now have full access to all platform features.',
        metadata: {
          kycId: kyc._id,
          approvedAt: kyc.reviewedAt,
          userEmail: kyc.userId.email
        }
      });
    } else if (status === 'rejected') {
      await createNotification({
        action: 'kyc_rejected',
        userId: kyc.userId._id,
        description: rejectionReason || 'Your KYC application has been rejected. Please review the feedback and resubmit.',
        metadata: {
          kycId: kyc._id,
          rejectionReason,
          reviewNotes,
          userEmail: kyc.userId.email
        }
      });
    } else if (status === 'resubmission_required') {
      await createNotification({
        action: 'kyc_resubmission_required',
        userId: kyc.userId._id,
        description: 'Please resubmit your KYC application with the requested corrections.',
        metadata: {
          kycId: kyc._id,
          reviewNotes,
          userEmail: kyc.userId.email
        }
      });
    }

    // Create audit log
    await createAuditLog(req, res, {
      action: 'kyc_status_updated',
      resourceType: 'kyc',
      resourceId: id,
      description: `KYC status changed from ${oldStatus} to ${status} for user ${kyc.userId.email}`,
      changes: {
        oldStatus,
        newStatus: status,
        userId: kyc.userId._id,
        reviewNotes,
        rejectionReason
      }
    });

    logger.info('✅ KYC status updated by admin', {
      adminId: req.admin?.id,
      kycId: id,
      userId: kyc.userId._id,
      oldStatus,
      newStatus: status
    });

    res.json({
      success: true,
      message: 'KYC status updated successfully',
      kyc: {
        id: kyc._id,
        status: kyc.status,
        reviewedAt: kyc.reviewedAt,
        reviewNotes: kyc.reviewNotes,
        rejectionReason: kyc.rejectionReason
      }
    });

  } catch (error) {
    logger.error('❌ Update KYC status error', {
      error: error.message,
      kycId: req.params.id,
      adminId: req.admin?.id
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating KYC status'
    });
  }
};

// Admin endpoint - Delete KYC application
export const deleteKYC = async (req, res) => {
  try {
    const { id } = req.params;

    const kyc = await KYC.findById(id).populate('userId', 'email firstName lastName');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC application not found'
      });
    }

    // Delete documents from Cloudinary (optional - files can be kept for audit purposes)
    // Note: Cloudinary files will be automatically cleaned up or can be manually deleted from dashboard
    
    // Delete KYC record
    await KYC.findByIdAndDelete(id);

    await createAuditLog(req, res, {
      action: 'kyc_application_deleted',
      resourceType: 'kyc',
      resourceId: id,
      description: `Admin deleted KYC application for user ${kyc.userId.email}`,
      changes: {
        deletedKycStatus: kyc.status,
        userId: kyc.userId._id,
        documentsDeleted: 0 // Documents kept in Cloudinary for audit purposes
      }
    });

    logger.info('🗑️ KYC application deleted by admin', {
      adminId: req.admin?.id,
      kycId: id,
      userId: kyc.userId._id,
      status: kyc.status
    });

    res.json({
      success: true,
      message: 'KYC application deleted successfully'
    });

  } catch (error) {
    logger.error('❌ Delete KYC error', {
      error: error.message,
      kycId: req.params.id,
      adminId: req.admin?.id
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting KYC'
    });
  }
};