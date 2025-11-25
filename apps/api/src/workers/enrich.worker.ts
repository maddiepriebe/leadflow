import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

// Processes jobs from the enrich queue
// listen to a queue, worker picks up job, processes job, marks complete, retries if failed

dotenv.config();

const prisma = new PrismaClient();

// Create Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

// Create worker
export const enrichWorker = new Worker(
  'enrich',  // Queue name
  async (job) => {
    console.log(`🔄 Processing job ${job.id}...`);
    
    const { leadId } = job.data;
    
    try {
      // Simulate enrichment (later: call real APIs)
      await new Promise(resolve => setTimeout(resolve, 2000));  // Wait 2 seconds
      
      const enrichedData = {
        companySize: '50-200',
        industry: 'Technology',
        revenue: '$10M-$50M',
        employees: 150,
        founded: 2015
      };
      
      // Update lead in database
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          enrichmentData: enrichedData,
          status: 'enriched'
        }
      });
      
      console.log(`✅ Lead ${leadId} enriched successfully`);
      
      return { success: true, leadId };
    } catch (error) {
      console.error(`❌ Failed to enrich lead ${leadId}:`, error);
      throw error;  // Job will retry
    }
  },
  { 
    connection,
    concurrency: 5  // Process 5 jobs at once
  }
);

// Event handlers
enrichWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

enrichWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

enrichWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('👷 Enrich worker started');