import express from 'express';
import CryptoPricesController from '../controllers/crypto-prices.controller.js';

const cryptoPricesRouter = express.Router();

// GET /api/v1/crypto-prices - Latest crypto prices (token + price)
cryptoPricesRouter.get('/', CryptoPricesController.getLatestPrices);

export default cryptoPricesRouter;
