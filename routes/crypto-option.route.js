import express from 'express';
import CryptoOptionController from '../controllers/crypto-option.controller.js';

const cryptoOptionRouter = express.Router();

// GET /api/crypto-options - Get all crypto options
cryptoOptionRouter.get('/', CryptoOptionController.getAllCryptoOptions);

// POST /api/crypto-options - Create new crypto option
cryptoOptionRouter.post('/', CryptoOptionController.createCryptoOption);

// GET /api/crypto-options/:id - Get crypto option by ID
cryptoOptionRouter.get('/:id', CryptoOptionController.getCryptoOptionById);

// PUT /api/crypto-options/:id - Update crypto option
cryptoOptionRouter.put('/:id', CryptoOptionController.updateCryptoOption);

// DELETE /api/crypto-options/:id - Delete crypto option
cryptoOptionRouter.delete('/:id', CryptoOptionController.deleteCryptoOption);

// GET /api/crypto-options/user/:user_id - Get crypto options by user ID
cryptoOptionRouter.get('/user/:user_id', CryptoOptionController.getCryptoOptionsByUserId);

export default cryptoOptionRouter;