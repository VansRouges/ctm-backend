import { config } from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const { 
    PORT, NODE_ENV, 
    DB_URI,
    PUBLIC_CLERK_PUBLISHABLE_KEY,
    FMP_API_KEY,
    UPDATE_INTERVAL_MINUTES,
    CLERK_SECRET_KEY,
    ARCJET_API_KEY,
    ARCJET_ENV,
    JWT_SECRET
} = process.env;