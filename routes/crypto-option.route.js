import express from 'express';
import CryptoOptionController from '../controllers/crypto-option.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const cryptoOptionRouter = express.Router();

// GET /api/v1/crypto-options - Get all crypto options (admin only)
cryptoOptionRouter.get('/', CryptoOptionController.getAllCryptoOptions);

// (Place user route BEFORE :id to avoid conflict)
cryptoOptionRouter.get('/user/:userId', CryptoOptionController.getCryptoOptionsByUserId);

// POST /api/v1/crypto-options - Create
cryptoOptionRouter.post('/', requireAdminAuth, CryptoOptionController.createCryptoOption);

// ID-specific routes
cryptoOptionRouter.get('/:id', CryptoOptionController.getCryptoOptionById);
cryptoOptionRouter.put('/:id', requireAdminAuth, CryptoOptionController.updateCryptoOption);
cryptoOptionRouter.delete('/:id', requireAdminAuth, CryptoOptionController.deleteCryptoOption);  // Admin only

export default cryptoOptionRouter;