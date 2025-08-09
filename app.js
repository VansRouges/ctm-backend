import express from 'express';
import cookieParser from 'cookie-parser';
import requestLogger from './middlewares/logger.middleware.js'

import { PORT } from './config/env.js';
import connectToDatabase from './database/mongodb.js';
import userRouter from './routes/user.route.js';
import { requireAuthNonStrict, requireAuthStrict } from './middlewares/auth.middleware.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); 
app.use(requestLogger);

app.get('/', (req, res) => {
  res.send('Welcome to the Uptions Backend API!');
});

app.get("/protected-optional", requireAuthNonStrict, (req, res) => {
  res.send("This is a protected route, accessible only to authenticated users.");
});

app.get("/protected-auth-required", requireAuthStrict, (req, res) => {
  res.send("This is a protected route, accessible only to authenticated users.");
});

app.use('/api/v1/users', userRouter); 

app.listen(PORT, async () => {
  console.log(`CTM API is running on http://localhost:${PORT}`); 

  await connectToDatabase();
});

export default app;