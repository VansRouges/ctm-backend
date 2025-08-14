import mongoose from 'mongoose';
import User from '../model/user.model.js';

/**
 * Validate that a provided user id is a valid ObjectId and that the user exists.
 * @param {string} userId - The user ObjectId string.
 * @returns {Promise<{ok: true} | {ok:false,status:number,message:string}>}
 */
export async function validateUserExists(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { ok: false, status: 400, message: 'Invalid userId' };
  }
  const exists = await User.exists({ _id: userId });
  if (!exists) {
    return { ok: false, status: 404, message: 'User not found' };
  }
  return { ok: true };
}

/**
 * Validate a user id coming from request body (field usually named 'user').
 * Semantic difference is only in the error message wording.
 */
export async function validateBodyUser(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { ok: false, status: 400, message: 'Invalid user' };
  }
  const exists = await User.exists({ _id: userId });
  if (!exists) {
    return { ok: false, status: 404, message: 'User not found' };
  }
  return { ok: true };
}
