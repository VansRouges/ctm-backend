import express from 'express';
import {
  getUsers,
  getUserById,
  getUserByClerkId,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/user.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';

const userRouter = express.Router();

// More specific routes first
userRouter.get('/clerk/:clerkId', getUserByClerkId);

// General routes
userRouter.get('/', requireAdminAuth, getUsers);  // Admin only - get all users
userRouter.post('/', createUser);

// ID-based routes last
userRouter.get('/:id', getUserById);
userRouter.put('/:id', updateUser);
userRouter.delete('/:id', requireAdminAuth, deleteUser);  // Admin only - delete user

export default userRouter;