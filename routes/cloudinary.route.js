import express from 'express';
import {
  uploadKYCDocument,
  uploadToCloudinary,
  getSignedKycUrl
} from '../config/cloudinary.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import logger from '../utils/logger.js';
import { createAuditLog } from '../utils/auditHelper.js';

const router = express.Router();

router.post('/upload', requireUserAuth, uploadKYCDocument.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const userId = req.user.userId;
    const filename = req.file.originalname;

    logger.info('📤 Uploading private KYC file to Cloudinary', {
      userId,
      filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const result = await uploadToCloudinary(req.file.buffer, filename, userId);
    const previewUrl = getSignedKycUrl(result.public_id, {
      resourceType: result.resource_type || 'image',
      ttlSeconds: 15 * 60
    });

    await createAuditLog(req, res, {
      action: 'file_upload',
      resourceType: 'document',
      description: 'Private KYC document uploaded',
      changes: {
        filename,
        cloudinaryId: result.public_id,
        size: result.bytes,
        resourceType: result.resource_type
      }
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        // Prefer publicId for submit; signed preview for short-lived UI display
        publicId: result.public_id,
        url: previewUrl,
        previewUrl,
        filename,
        size: result.bytes,
        format: result.format,
        resourceType: result.resource_type
      }
    });
  } catch (error) {
    logger.error('❌ File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: error.message
    });
  }
});

router.post(
  '/upload-multiple',
  requireUserAuth,
  uploadKYCDocument.array('documents', 5),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const userId = req.user.userId;
      const uploadResults = [];

      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            userId
          );
          const previewUrl = getSignedKycUrl(result.public_id, {
            resourceType: result.resource_type || 'image',
            ttlSeconds: 15 * 60
          });

          uploadResults.push({
            publicId: result.public_id,
            url: previewUrl,
            previewUrl,
            filename: file.originalname,
            size: result.bytes,
            format: result.format,
            resourceType: result.resource_type
          });

          await createAuditLog(req, res, {
            action: 'file_upload',
            resourceType: 'document',
            description: 'Private KYC document uploaded',
            changes: {
              filename: file.originalname,
              cloudinaryId: result.public_id,
              size: result.bytes
            }
          });
        } catch (uploadError) {
          logger.error(`❌ Error uploading ${file.originalname}:`, uploadError);
          uploadResults.push({
            filename: file.originalname,
            error: uploadError.message
          });
        }
      }

      res.json({
        success: true,
        message: `${uploadResults.filter((r) => !r.error).length} files uploaded successfully`,
        data: uploadResults
      });
    } catch (error) {
      logger.error('❌ Multiple file upload error:', error);
      res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: error.message
      });
    }
  }
);

export default router;
