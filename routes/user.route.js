import express from 'express';
import {
  getUsers,
  getUserById,
  getUserByClerkId,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/user.controller.js';

const userRouter = express.Router();

// More specific routes first
userRouter.get('/clerk/:clerkId', getUserByClerkId);

// General routes
userRouter.get('/', getUsers);
userRouter.post('/', createUser);

// ID-based routes last
userRouter.get('/:id', getUserById);
userRouter.put('/:id', updateUser);
userRouter.delete('/:id', deleteUser);

export default userRouter;