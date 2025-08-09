import { config } from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const { 
    PORT, NODE_ENV, 
    DB_URI,
    PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY,
    JWT_SECRET
} = process.env;