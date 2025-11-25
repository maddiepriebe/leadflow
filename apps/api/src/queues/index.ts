import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Queue configuration - handle background jobs

// Connect to Redis
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

// Log connection status
connection.on('connect', () => {
  console.log('✅ Connected to Redis');
});

connection.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

/// Discover Queue - Find new leads
export const discoverQueue = new Queue('discover', { 
  connection 
});

// Enrich Queue - Add data to leads
export const enrichQueue = new Queue('enrich', { 
  connection 
});

// Score Queue - Score lead quality
export const scoreQueue = new Queue('score', { 
  connection 
});

// Send Queue - Send messages
export const sendQueue = new Queue('send', { 
  connection 
});

console.log('📬 Queues initialized');