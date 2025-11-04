import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Connect to Redis
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

// Create queues for background jobs
export const enrichQueue = new Queue('enrich', { connection });
export const scoreQueue = new Queue('score', { connection });