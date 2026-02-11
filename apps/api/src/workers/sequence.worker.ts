import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { sendQueue } from '../queues/index';

dotenv.config();

const prisma = new PrismaClient();

// ==========================================
// CONFIGURATION
// ==========================================

// Create Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// ==========================================
// TYPES
// ==========================================

interface SequenceStep {
  id: string;
  order: number;
  type: 'email' | 'whatsapp' | 'dms' | 'wait';
  content: string;
  delayDays?: number;  // Days to wait before this step (default: 1)
  delayHours?: number; // Hours to wait (alternative to days)
}

interface SequenceJob {
  type: 'execute-step' | 'process-due-steps' | 'enroll-lead' | 'enroll-leads-bulk';
  data: {
    enrollmentId?: string;
    sequenceId?: string;
    leadId?: string;
    leadIds?: string[];
  };
}

// ==========================================
// STEP EXECUTION
// ==========================================

async function executeSequenceStep(enrollmentId: string): Promise<{
  success: boolean;
  message: string;
  nextStepScheduled?: boolean;
}> {
  console.log(`\n📋 Executing sequence step for enrollment ${enrollmentId}...`);

  // Get enrollment with sequence and lead
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      sequence: true,
      lead: true,
    },
  });

  if (!enrollment) {
    return { success: false, message: 'Enrollment not found' };
  }

  if (enrollment.status !== 'active') {
    return { success: false, message: `Enrollment is ${enrollment.status}, not active` };
  }

  // Parse sequence steps
  const steps = enrollment.sequence.steps as unknown as SequenceStep[];
  const currentStep = steps[enrollment.currentStepIndex];

  if (!currentStep) {
    // No more steps, mark as completed
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        nextStepAt: null,
      },
    });
    console.log(`✅ Sequence completed for lead ${enrollment.lead.firstName} ${enrollment.lead.lastName}`);
    return { success: true, message: 'Sequence completed', nextStepScheduled: false };
  }

  console.log(`📨 Executing step ${enrollment.currentStepIndex + 1}/${steps.length}: ${currentStep.type}`);

  // Create step execution record
  const stepExecution = await prisma.stepExecution.create({
    data: {
      enrollmentId,
      stepIndex: enrollment.currentStepIndex,
      status: 'pending',
      scheduledFor: new Date(),
    },
  });

  try {
    // Handle different step types
    if (currentStep.type === 'wait') {
      // Wait step - just schedule next step
      console.log(`⏳ Wait step - scheduling next step`);
      await prisma.stepExecution.update({
        where: { id: stepExecution.id },
        data: { status: 'sent', executedAt: new Date() },
      });
    } else {
      // Message step - queue the message send
      const channel = currentStep.type === 'dms' ? 'instagram' : currentStep.type;

      // Add job to send queue
      await sendQueue.add(
        'sequence-message',
        {
          type: 'send-message',
          data: {
            leadId: enrollment.leadId,
            channel,
            customPrompt: currentStep.content,
          },
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      );

      console.log(`📤 Queued ${channel} message for lead ${enrollment.lead.email}`);

      // Update step execution
      await prisma.stepExecution.update({
        where: { id: stepExecution.id },
        data: { status: 'sent', executedAt: new Date() },
      });
    }

    // Calculate next step time
    const nextStepIndex = enrollment.currentStepIndex + 1;
    const nextStep = steps[nextStepIndex];

    let nextStepAt: Date | null = null;

    if (nextStep) {
      // Calculate delay for next step
      const delayMs = calculateStepDelay(nextStep);
      nextStepAt = new Date(Date.now() + delayMs);
      console.log(`⏰ Next step scheduled for: ${nextStepAt.toISOString()}`);
    }

    // Update enrollment to next step
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStepIndex: nextStepIndex,
        nextStepAt,
        ...(nextStepIndex >= steps.length
          ? { status: 'completed', completedAt: new Date() }
          : {}),
      },
    });

    return {
      success: true,
      message: `Step ${enrollment.currentStepIndex + 1} executed`,
      nextStepScheduled: !!nextStepAt,
    };
  } catch (error: any) {
    console.error(`❌ Step execution failed:`, error.message);

    // Update step execution with error
    await prisma.stepExecution.update({
      where: { id: stepExecution.id },
      data: { status: 'failed', error: error.message },
    });

    // Don't fail the whole enrollment, try again later
    return { success: false, message: error.message };
  }
}

// ==========================================
// PROCESS DUE STEPS
// ==========================================

async function processDueSteps(): Promise<{
  processed: number;
  failed: number;
}> {
  console.log(`\n🔍 Checking for due sequence steps...`);

  // Find all enrollments with due steps
  const dueEnrollments = await prisma.sequenceEnrollment.findMany({
    where: {
      status: 'active',
      nextStepAt: {
        lte: new Date(),
      },
    },
    include: {
      sequence: true,
      lead: true,
    },
    take: 50, // Process in batches
  });

  console.log(`📋 Found ${dueEnrollments.length} due enrollments`);

  let processed = 0;
  let failed = 0;

  for (const enrollment of dueEnrollments) {
    try {
      const result = await executeSequenceStep(enrollment.id);
      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    } catch (error: any) {
      console.error(`❌ Error processing enrollment ${enrollment.id}:`, error.message);
      failed++;
    }

    // Small delay between executions
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`✅ Processed: ${processed}, Failed: ${failed}`);
  return { processed, failed };
}

// ==========================================
// ENROLL LEAD
// ==========================================

async function enrollLead(
  sequenceId: string,
  leadId: string
): Promise<{
  success: boolean;
  enrollmentId?: string;
  message: string;
}> {
  console.log(`\n➕ Enrolling lead ${leadId} in sequence ${sequenceId}...`);

  // Check if sequence exists and is active
  const sequence = await prisma.sequence.findUnique({
    where: { id: sequenceId },
  });

  if (!sequence) {
    return { success: false, message: 'Sequence not found' };
  }

  if (sequence.status !== 'active') {
    return { success: false, message: `Sequence is ${sequence.status}, not active` };
  }

  // Check if lead exists
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    return { success: false, message: 'Lead not found' };
  }

  // Check if already enrolled
  const existingEnrollment = await prisma.sequenceEnrollment.findUnique({
    where: {
      sequenceId_leadId: {
        sequenceId,
        leadId,
      },
    },
  });

  if (existingEnrollment) {
    return {
      success: false,
      message: `Lead already enrolled (status: ${existingEnrollment.status})`,
    };
  }

  // Parse steps to get first step delay
  const steps = sequence.steps as unknown as SequenceStep[];
  const firstStep = steps[0];

  // Calculate when to execute first step
  const firstStepDelay = firstStep ? calculateStepDelay(firstStep) : 0;
  const nextStepAt = new Date(Date.now() + firstStepDelay);

  // Create enrollment
  const enrollment = await prisma.sequenceEnrollment.create({
    data: {
      sequenceId,
      leadId,
      currentStepIndex: 0,
      status: 'active',
      nextStepAt,
    },
  });

  console.log(`✅ Lead enrolled, first step at: ${nextStepAt.toISOString()}`);

  return {
    success: true,
    enrollmentId: enrollment.id,
    message: 'Lead enrolled successfully',
  };
}

// ==========================================
// BULK ENROLL
// ==========================================

async function enrollLeadsBulk(
  sequenceId: string,
  leadIds: string[]
): Promise<{
  success: boolean;
  enrolled: number;
  failed: number;
  results: any[];
}> {
  console.log(`\n➕ Bulk enrolling ${leadIds.length} leads in sequence ${sequenceId}...`);

  const results: any[] = [];
  let enrolled = 0;
  let failed = 0;

  for (const leadId of leadIds) {
    const result = await enrollLead(sequenceId, leadId);
    results.push({ leadId, ...result });

    if (result.success) {
      enrolled++;
    } else {
      failed++;
    }
  }

  console.log(`✅ Enrolled: ${enrolled}, Failed: ${failed}`);

  return {
    success: true,
    enrolled,
    failed,
    results,
  };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function calculateStepDelay(step: SequenceStep): number {
  // Default delay is 1 day
  const defaultDelayMs = 24 * 60 * 60 * 1000;

  if (step.delayHours !== undefined) {
    return step.delayHours * 60 * 60 * 1000;
  }

  if (step.delayDays !== undefined) {
    return step.delayDays * 24 * 60 * 60 * 1000;
  }

  // Wait steps have their own delay
  if (step.type === 'wait') {
    return defaultDelayMs;
  }

  // First step executes immediately, subsequent steps have 1 day delay
  return 0;
}

// ==========================================
// WORKER DEFINITION
// ==========================================

export const sequenceWorker = new Worker(
  'sequence',
  async (job: Job<SequenceJob>) => {
    console.log(`\n🔄 Processing sequence job ${job.id} (${job.data.type})...`);

    const { type, data } = job.data;

    try {
      switch (type) {
        case 'execute-step':
          if (!data.enrollmentId) {
            throw new Error('Missing enrollmentId');
          }
          return await executeSequenceStep(data.enrollmentId);

        case 'process-due-steps':
          return await processDueSteps();

        case 'enroll-lead':
          if (!data.sequenceId || !data.leadId) {
            throw new Error('Missing sequenceId or leadId');
          }
          return await enrollLead(data.sequenceId, data.leadId);

        case 'enroll-leads-bulk':
          if (!data.sequenceId || !data.leadIds) {
            throw new Error('Missing sequenceId or leadIds');
          }
          return await enrollLeadsBulk(data.sequenceId, data.leadIds);

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error: any) {
      console.error(`❌ Sequence job ${job.id} failed:`, error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

// ==========================================
// SCHEDULED JOB: Process due steps every minute
// ==========================================

import { sequenceQueue } from '../queues/index';

// Add repeating job to process due steps
async function setupScheduledJobs() {
  // Remove any existing repeating jobs
  const existingJobs = await sequenceQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await sequenceQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeating job - runs every minute
  await sequenceQueue.add(
    'process-due-steps',
    {
      type: 'process-due-steps',
      data: {},
    },
    {
      repeat: {
        every: 60000, // Every 60 seconds
      },
    }
  );

  console.log('⏰ Scheduled job: process-due-steps (every 1 minute)');
}

// Set up scheduled jobs when worker starts
setupScheduledJobs().catch(console.error);

// ==========================================
// EVENT HANDLERS
// ==========================================

sequenceWorker.on('completed', (job) => {
  console.log(`✅ Sequence job ${job.id} completed`);
});

sequenceWorker.on('failed', (job, err) => {
  console.error(`❌ Sequence job ${job?.id} failed:`, err.message);
});

sequenceWorker.on('error', (err) => {
  console.error('❌ Sequence worker error:', err);
});

console.log('📋 Sequence worker started');
