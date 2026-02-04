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

// Enrich Queue - Legacy, kept for backwards compatibility
// Use provider-specific queues instead (apolloQueue, clearbitQueue, etc.)
export const enrichQueue = new Queue('enrich', {
  connection
});

// Google Search Queue - Search for Leads using ICP
export const googleQueue = new Queue('googleSearch', {
  connection
});

// Instagram Search Queue - Search for Leads using ICP
export const instaQueue = new Queue('instaSearch',  {
  connection
});

// LinkedIn Search Queue - Search for Leads using ICP
export const linkedInQueue = new Queue('likedInSearch', {
  connection
});

// Apollo Queue - Search and Enrich via Apollo.io
export const apolloQueue = new Queue('apollo', {
  connection
});

// Clearbit Queue - Enrich via Clearbit
export const clearbitQueue = new Queue('clearbit', {
  connection
});

// Hunter Queue - Email finding and verification via Hunter.io
export const hunterQueue = new Queue('hunter', {
  connection
});

// People Data Labs Queue - Enrich via PDL
export const peopleDataLabsQueue = new Queue('peopledatalabs', {
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

// Sequence Queue - Execute sequence steps
export const sequenceQueue = new Queue('sequence', {
  connection
});

console.log('📬 Queues initialized');

export { connection };