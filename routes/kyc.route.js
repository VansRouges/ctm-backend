import express from 'express';
import { 
  submitKYC, 
  getUserKYC, 
  getAllKYCs, 
  getKYCById, 
  updateKYCStatus, 
  deleteKYC 
} from '../controllers/kyc.controller.js';
import { requireUserAuth } from '../middlewares/user-auth.middleware.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import arcjetMiddleware from '../middlewares/arcjet.middleware.js';

const router = express.Router();

// Apply rate limiting to all routes
router.use(arcjetMiddleware);

// User Routes (protected with user authentication)
/**
 * @route POST /api/v1/kyc/submit
 * @desc Submit KYC application with Cloudinary document URLs
 * @access Private (User)
 * @body {string} fullName - Full legal name
 * @body {string} dateOfBirth - Date of birth (YYYY-MM-DD)
 * @body {string} phoneNumber - Phone number
 * @body {object} address - Address object with street, city, state, country, postalCode
 * @body {string} validIdUrl - Cloudinary URL for valid ID document
 * @body {string} passportUrl - Cloudinary URL for passport document
 * @body {string} [validIdFileName] - Original file name for valid ID
 * @body {string} [passportFileName] - Original file name for passport
 * @body {number} [validIdFileSize] - File size in bytes for valid ID
 * @body {number} [passportFileSize] - File size in bytes for passport
 */
router.post('/submit', 
  requireUserAuth,
  submitKYC
);

/**
 * @route GET /api/v1/kyc/my-kyc
 * @desc Get current user's KYC status and details
 * @access Private (User)
 */
router.get('/my-kyc', requireUserAuth, getUserKYC);

// Admin Routes (protected with admin authentication)
/**
 * @route GET /api/v1/kyc/admin/all
 * @desc Get all KYC applications with pagination and filtering
 * @access Private (Admin)
 * @query {string} [status] - Filter by status (pending, under_review, approved, rejected, resubmission_required)
 * @query {number} [page=1] - Page number for pagination
 * @query {number} [limit=20] - Number of records per page
 * @query {string} [sortBy=submittedAt] - Field to sort by
 * @query {string} [sortOrder=desc] - Sort order (asc/desc)
 */
router.get('/admin/all', requireAdminAuth, getAllKYCs);

/**
 * @route GET /api/v1/kyc/admin/:id
 * @desc Get specific KYC application by ID (with document URLs)
 * @access Private (Admin)
 * @param {string} id - KYC application ID
 */
router.get('/admin/:id', requireAdminAuth, getKYCById);

/**
 * @route PUT /api/v1/kyc/admin/:id/status
 * @desc Update KYC application status
 * @access Private (Admin)
 * @param {string} id - KYC application ID
 * @body {string} status - New status (pending, under_review, approved, rejected, resubmission_required)
 * @body {string} [reviewNotes] - Optional review notes
 * @body {string} [rejectionReason] - Required if status is 'rejected'
 */
router.put('/admin/:id/status', requireAdminAuth, updateKYCStatus);

/**
 * @route DELETE /api/v1/kyc/admin/:id
 * @desc Delete KYC application and associated documents
 * @access Private (Admin)
 * @param {string} id - KYC application ID
 */
router.delete('/admin/:id', requireAdminAuth, deleteKYC);

export default router;