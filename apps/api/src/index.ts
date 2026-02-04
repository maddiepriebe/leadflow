import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import leadsRouter from './routes/leads.router.js';
import sequencesRouter from './routes/sequences.router.js';
import inboxRouter from './routes/inbox.router.js';
import analyticsRouter from './routes/analytics.router.js';
import icpsrouter from './routes/icps.router.js';
import authRouter from './routes/auth.router.js';
import { requireAuth } from './middleware/auth.middleware.js';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,  // Allow cookies
}));
app.use(express.json());  // Parse JSON bodies
app.use(cookieParser());  // Parse cookies

// Log all requests (for debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();  // Continue to next middleware
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Public routes (no auth required)
app.use('/api/auth', authRouter);

// Protected routes (require authentication)
app.use('/api/leads', requireAuth, leadsRouter);
app.use('/api/sequences', requireAuth, sequencesRouter);
app.use('/api/inbox', requireAuth, inboxRouter);
app.use('/api/analytics', requireAuth, analyticsRouter);
app.use('/api/icps', requireAuth, icpsrouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log('');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log('');
});

// Clean shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});