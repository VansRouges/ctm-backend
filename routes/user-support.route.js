import express from 'express';
import UserSupportController from '../controllers/user-support.controller.js';

const userSupportRouter = express.Router();

// GET /api/user-support - Get all user support tickets
userSupportRouter.get('/', UserSupportController.getAllUserSupport);

// POST /api/user-support - Create new user support ticket
userSupportRouter.post('/', UserSupportController.createUserSupport);

// GET /api/user-support/:id - Get user support ticket by ID
userSupportRouter.get('/:id', UserSupportController.getUserSupportById);

// PUT /api/user-support/:id - Update user support ticket
userSupportRouter.put('/:id', UserSupportController.updateUserSupport);

// DELETE /api/user-support/:id - Delete user support ticket
userSupportRouter.delete('/:id', UserSupportController.deleteUserSupport);

// GET /api/user-support/user/:user_id - Get user support tickets by user ID
userSupportRouter.get('/user/:user_id', UserSupportController.getUserSupportByUserId);

// GET /api/user-support/status/:status - Get user support tickets by status
userSupportRouter.get('/status/:status', UserSupportController.getUserSupportByStatus);

// GET /api/user-support/priority/:priority - Get user support tickets by priority
userSupportRouter.get('/priority/:priority', UserSupportController.getUserSupportByPriority);

export default userSupportRouter;