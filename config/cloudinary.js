import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import logger from '../utils/logger.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create multer upload middleware for memory storage
export const uploadKYCDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Check file type
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

// Helper function to upload buffer to Cloudinary
export const uploadToCloudinary = async (buffer, filename, userId) => {
  return new Promise((resolve, reject) => {
    const uniqueFilename = `${userId}_${Date.now()}_${filename}`;
    
    cloudinary.uploader.upload_stream(
      {
        folder: 'kyc-documents',
        public_id: uniqueFilename,
        resource_type: 'auto',
        quality: 'auto:good',
        fetch_format: 'auto'
      },
      (error, result) => {
        if (error) {
          logger.error('❌ Cloudinary upload error:', error);
          reject(error);
        } else {
          logger.info('✅ File uploaded to Cloudinary', {
            publicId: result.public_id,
            url: result.secure_url,
            userId
          });
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

// Helper function to delete file from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info('🗑️ File deleted from Cloudinary', { publicId, result });
    return result;
  } catch (error) {
    logger.error('❌ Error deleting file from Cloudinary:', error);
    throw error;
  }
};

// Helper function to get file info from Cloudinary
export const getCloudinaryFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    logger.error('❌ Error getting file info from Cloudinary:', error);
    throw error;
  }
};

export default cloudinary;