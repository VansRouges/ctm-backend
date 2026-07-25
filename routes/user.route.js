import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/user.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { requireUserOrAdminAuth } from '../middlewares/user-or-admin-auth.middleware.js';

const userRouter = express.Router();

userRouter.get('/', requireAdminAuth, getUsers);
userRouter.post('/', requireAdminAuth, createUser);

userRouter.get('/:id', requireUserOrAdminAuth, getUserById);
userRouter.put('/:id', requireUserOrAdminAuth, updateUser);
userRouter.delete('/:id', requireAdminAuth, deleteUser);

export default userRouter;
