import multer from 'multer';
import logger from '../utils/logger.js';

// Configure multer for memory storage (files will be stored in memory as buffers)
const storage = multer.memoryStorage();

// File filter for KYC documents
const fileFilter = (req, file, cb) => {
  // Allowed MIME types for KYC documents
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ];

  // Check if file type is allowed
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn('❌ Invalid file type uploaded', {
      filename: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });
    
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, GIF, WebP, and PDF files are allowed.`), false);
  }
};

// Configure multer for KYC document uploads
const uploadKYCDocuments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 2, // Maximum 2 files (validId and passport)
    fields: 20, // Maximum number of non-file fields
    fieldNameSize: 100, // Maximum field name size
    fieldSize: 1024 * 1024 // Maximum field value size (1MB)
  }
});

// Middleware to handle KYC document uploads
export const handleKYCUpload = (req, res, next) => {
  const upload = uploadKYCDocuments.fields([
    { name: 'validId', maxCount: 1 },
    { name: 'passport', maxCount: 1 }
  ]);

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      logger.error('❌ Multer upload error', {
        error: err.message,
        code: err.code,
        field: err.field,
        userId: req.user?.userId
      });

      // Handle specific multer errors
      switch (err.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 10MB per file.'
          });
        
        case 'LIMIT_FILE_COUNT':
          return res.status(400).json({
            success: false,
            message: 'Too many files. Maximum 2 files allowed (valid ID and passport).'
          });
        
        case 'LIMIT_FIELD_COUNT':
          return res.status(400).json({
            success: false,
            message: 'Too many fields in the request.'
          });
        
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({
            success: false,
            message: `Unexpected file field: ${err.field}. Only 'validId' and 'passport' fields are allowed.`
          });
        
        default:
          return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`
          });
      }
    } else if (err) {
      logger.error('❌ File upload error', {
        error: err.message,
        userId: req.user?.userId
      });

      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Log successful file reception
    if (req.files) {
      const fileInfo = Object.keys(req.files).map(key => ({
        field: key,
        count: req.files[key].length,
        sizes: req.files[key].map(file => file.size)
      }));

      logger.info('📁 Files received for upload', {
        userId: req.user?.userId,
        files: fileInfo,
        totalFiles: Object.values(req.files).flat().length
      });
    }

    next();
  });
};

// Middleware to validate uploaded files exist
export const validateKYCFiles = (req, res, next) => {
  const { files } = req;

  if (!files) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded. Both valid ID and passport are required.'
    });
  }

  // Check for required files
  const errors = [];

  if (!files.validId || files.validId.length === 0) {
    errors.push('Valid ID document is required');
  }

  if (!files.passport || files.passport.length === 0) {
    errors.push('Passport document is required');
  }

  if (errors.length > 0) {
    logger.warn('❌ Required KYC files missing', {
      userId: req.user?.userId,
      errors,
      receivedFiles: Object.keys(files)
    });

    return res.status(400).json({
      success: false,
      message: 'Missing required documents',
      errors
    });
  }

  // Validate individual files
  const validIdFile = files.validId[0];
  const passportFile = files.passport[0];

  const fileValidationErrors = [];

  // Check file sizes
  if (validIdFile.size < 1024) { // 1KB minimum
    fileValidationErrors.push('Valid ID file is too small (minimum 1KB)');
  }

  if (passportFile.size < 1024) { // 1KB minimum
    fileValidationErrors.push('Passport file is too small (minimum 1KB)');
  }

  // Check if files are actually images/PDFs by examining buffer
  if (!isValidFileType(validIdFile)) {
    fileValidationErrors.push('Valid ID file appears to be corrupted or invalid');
  }

  if (!isValidFileType(passportFile)) {
    fileValidationErrors.push('Passport file appears to be corrupted or invalid');
  }

  if (fileValidationErrors.length > 0) {
    logger.warn('❌ KYC file validation failed', {
      userId: req.user?.userId,
      errors: fileValidationErrors
    });

    return res.status(400).json({
      success: false,
      message: 'File validation failed',
      errors: fileValidationErrors
    });
  }

  logger.info('✅ KYC files validated successfully', {
    userId: req.user?.userId,
    validIdSize: validIdFile.size,
    passportSize: passportFile.size,
    validIdType: validIdFile.mimetype,
    passportType: passportFile.mimetype
  });

  next();
};

// Helper function to validate file type by examining file headers
const isValidFileType = (file) => {
  if (!file || !file.buffer) return false;

  const buffer = file.buffer;
  
  // Check file signatures (magic numbers)
  const signatures = {
    jpeg: [0xFF, 0xD8, 0xFF],
    png: [0x89, 0x50, 0x4E, 0x47],
    gif: [0x47, 0x49, 0x46, 0x38],
    pdf: [0x25, 0x50, 0x44, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46] // RIFF header for WebP
  };

  // Check if buffer starts with any valid signature
  for (const [type, signature] of Object.entries(signatures)) {
    if (signature.every((byte, index) => buffer[index] === byte)) {
      return true;
    }
  }

  // Special check for WebP (needs WEBP after RIFF)
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return true;
  }

  return false;
};

export default { handleKYCUpload, validateKYCFiles };