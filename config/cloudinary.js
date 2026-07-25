import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import logger from '../utils/logger.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadKYCDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 16 * 1024 * 1024,
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      logger.warn(`❌ File upload rejected - invalid type: ${file.mimetype}`, {
        userId: req.user?.userId,
        filename: file.originalname
      });
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`), false);
    }
  }
});

/**
 * Upload KYC docs as authenticated (private) Cloudinary assets.
 */
export const uploadToCloudinary = async (buffer, filename, userId) => {
  return new Promise((resolve, reject) => {
    const safeName = String(filename || 'document')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
    const uniqueFilename = `${userId}_${Date.now()}_${safeName}`;

    cloudinary.uploader.upload_stream(
      {
        folder: 'kyc-documents',
        public_id: uniqueFilename,
        resource_type: 'auto',
        type: 'authenticated',
        access_mode: 'authenticated',
        quality: 'auto:good'
      },
      (error, result) => {
        if (error) {
          logger.error('❌ Cloudinary upload error:', error);
          reject(error);
        } else {
          logger.info('✅ Private KYC file uploaded to Cloudinary', {
            publicId: result.public_id,
            resourceType: result.resource_type,
            userId
          });
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

/**
 * Temporary signed URL for viewing authenticated KYC assets (admin review / user preview).
 */
export const getSignedKycUrl = (publicId, options = {}) => {
  if (!publicId) return null;

  const expiresAt =
    options.expiresAt ||
    Math.floor(Date.now() / 1000) + (options.ttlSeconds || 60 * 60);

  const resourceType = options.resourceType || 'image';

  return cloudinary.url(publicId, {
    type: 'authenticated',
    resource_type: resourceType,
    sign_url: true,
    secure: true,
    expires_at: expiresAt
  });
};

/**
 * Validate that a publicId belongs to this user's KYC uploads.
 */
export const isOwnedKycPublicId = (publicId, userId) => {
  if (!publicId || !userId) return false;
  const expectedPrefix = `kyc-documents/${String(userId)}_`;
  return String(publicId).startsWith(expectedPrefix);
};

/**
 * Extract Cloudinary public_id from a delivery URL when possible.
 */
export const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  try {
    // Matches .../authenticated/s--xxx--/v123/kyc-documents/userid_ts_name.ext
    // or .../image/upload/v123/kyc-documents/...
    const match = String(url).match(
      /\/(?:authenticated|upload)\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/
    );
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  } catch {
    return null;
  }
};

export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      type: 'authenticated',
      resource_type: resourceType
    });
    logger.info('🗑️ File deleted from Cloudinary', { publicId, result });
    return result;
  } catch (error) {
    logger.error('❌ Error deleting file from Cloudinary:', error);
    throw error;
  }
};

export const getCloudinaryFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      type: 'authenticated'
    });
    return result;
  } catch (error) {
    logger.error('❌ Error getting file info from Cloudinary:', error);
    throw error;
  }
};

export default cloudinary;
