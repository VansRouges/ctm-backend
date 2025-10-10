import express from 'express';
import { uploadKYCDocument, uploadToCloudinary } from '../config/cloudinary.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import logger from '../utils/logger.js';
import { createAuditLog } from '../utils/auditHelper.js';

const router = express.Router();

// Upload single document
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

    logger.info('📤 Uploading file to Cloudinary', {
      userId,
      filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, filename, userId);

    // Log the upload
    await createAuditLog(req, res, {
      action: 'file_upload',
      resourceType: 'document',
      description: 'Document uploaded',
      changes: {
        filename,
        cloudinaryId: result.public_id,
        url: result.secure_url,
        size: result.bytes
      }
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        filename: filename,
        size: result.bytes,
        format: result.format
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

// Upload multiple documents
router.post('/upload-multiple', requireUserAuth, uploadKYCDocument.array('documents', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const userId = req.user.userId;
    const uploadResults = [];

    logger.info('📤 Uploading multiple files to Cloudinary', {
      userId,
      fileCount: req.files.length
    });

    // Upload each file to Cloudinary
    for (const file of req.files) {
      try {
        const result = await uploadToCloudinary(file.buffer, file.originalname, userId);
        uploadResults.push({
          url: result.secure_url,
          publicId: result.public_id,
          filename: file.originalname,
          size: result.bytes,
          format: result.format
        });

        // Log each upload
        await createAuditLog(req, res, {
          action: 'file_upload',
          resourceType: 'document',
          description: 'Document uploaded',
          changes: {
            filename: file.originalname,
            cloudinaryId: result.public_id,
            url: result.secure_url,
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
      message: `${uploadResults.filter(r => !r.error).length} files uploaded successfully`,
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
});

export default router;