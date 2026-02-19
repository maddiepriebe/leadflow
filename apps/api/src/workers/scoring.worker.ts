import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { scoreAndSaveLead, scoreAllLeads } from '../services/scoring.service';
import { trainNewModel, shouldRetrain } from '../services/model-trainer.service';
import { trackConversion, ConversionType } from '../services/conversion.service';
import { scoreQueue } from '../queues/index';

dotenv.config();

// ==========================================
// CONFIGURATION
// ==========================================

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// ==========================================
// TYPES
// ==========================================

interface ScoreLeadJob {
  type: 'score-lead';
  data: {
    leadId: string;
  };
}

interface ScoreAllLeadsJob {
  type: 'score-all-leads';
  data: Record<string, never>;
}

interface TrainModelJob {
  type: 'train-model';
  data: {
    force?: boolean;
  };
}

interface CheckRetrainJob {
  type: 'check-retrain';
  data: Record<string, never>;
}

interface TrackConversionJob {
  type: 'track-conversion';
  data: {
    leadId: string;
    conversionType: ConversionType;
    channel?: string;
    metadata?: Record<string, unknown>;
  };
}

type ScoringJob =
  | ScoreLeadJob
  | ScoreAllLeadsJob
  | TrainModelJob
  | CheckRetrainJob
  | TrackConversionJob;

// ==========================================
// JOB HANDLERS
// ==========================================

async function handleScoreLead(leadId: string) {
  console.log(`📊 Scoring lead ${leadId}...`);
  const result = await scoreAndSaveLead(leadId);
  console.log(`✅ Lead ${leadId} scored: ${result.score}`);
  return result;
}

async function handleScoreAllLeads() {
  console.log(`📊 Scoring all leads...`);
  const result = await scoreAllLeads();
  console.log(`✅ Scored ${result.scored} leads, ${result.failed} failed`);
  return result;
}

async function handleTrainModel(force: boolean = false) {
  if (!force) {
    const check = await shouldRetrain();
    if (!check.shouldRetrain) {
      console.log(`⏸️ Skipping training: ${check.reason}`);
      return { skipped: true, reason: check.reason };
    }
  }

  console.log(`🧠 Training new model...`);
  const result = await trainNewModel();
  console.log(`✅ Model trained: v${result.oldVersion} → v${result.newVersion}`);
  return result;
}

async function handleCheckRetrain() {
  const check = await shouldRetrain();
  console.log(`🔍 Retrain check: ${check.shouldRetrain ? 'YES' : 'NO'} - ${check.reason}`);

  if (check.shouldRetrain) {
    // Queue a training job
    await scoreQueue.add(
      'auto-train',
      {
        type: 'train-model',
        data: { force: false },
      },
      {
        attempts: 1,
      }
    );
  }

  return check;
}

async function handleTrackConversion(
  leadId: string,
  conversionType: ConversionType,
  channel?: string,
  metadata?: Record<string, unknown>
) {
  console.log(`📈 Tracking conversion: ${conversionType} for lead ${leadId}`);
  await trackConversion({
    leadId,
    type: conversionType,
    channel,
    metadata,
  });
  console.log(`✅ Conversion tracked`);
  return { success: true };
}

// ==========================================
// WORKER DEFINITION
// ==========================================

export const scoringWorker = new Worker(
  'score',
  async (job: Job<ScoringJob>) => {
    console.log(`\n🔄 Processing scoring job ${job.id} (${job.data.type})...`);

    const { type, data } = job.data;

    try {
      switch (type) {
        case 'score-lead':
          return await handleScoreLead(data.leadId);

        case 'score-all-leads':
          return await handleScoreAllLeads();

        case 'train-model':
          return await handleTrainModel(data.force);

        case 'check-retrain':
          return await handleCheckRetrain();

        case 'track-conversion':
          return await handleTrackConversion(
            data.leadId,
            data.conversionType,
            data.channel,
            data.metadata
          );

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Scoring job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

// ==========================================
// SCHEDULED JOBS
// ==========================================

async function setupScheduledJobs() {
  // Remove any existing repeating jobs
  const existingJobs = await scoreQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name.startsWith('scheduled-')) {
      await scoreQueue.removeRepeatableByKey(job.key);
    }
  }

  // Check for retraining every 6 hours
  await scoreQueue.add(
    'scheduled-check-retrain',
    {
      type: 'check-retrain',
      data: {},
    },
    {
      repeat: {
        every: 6 * 60 * 60 * 1000, // Every 6 hours
      },
    }
  );

  console.log('⏰ Scheduled jobs configured:');
  console.log('   - Check retrain: every 6 hours');
}

// Set up scheduled jobs when worker starts
setupScheduledJobs().catch(console.error);

// ==========================================
// EVENT HANDLERS
// ==========================================

scoringWorker.on('completed', (job) => {
  console.log(`✅ Scoring job ${job.id} completed`);
});

scoringWorker.on('failed', (job, err) => {
  console.error(`❌ Scoring job ${job?.id} failed:`, err.message);
});

scoringWorker.on('error', (err) => {
  console.error('❌ Scoring worker error:', err);
});

console.log('📊 Scoring worker started');

// ==========================================
// HELPER FUNCTIONS FOR EXTERNAL USE
// ==========================================

export async function queueScoreLead(leadId: string) {
  return scoreQueue.add(
    'score-lead',
    {
      type: 'score-lead',
      data: { leadId },
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  );
}

export async function queueScoreAllLeads() {
  return scoreQueue.add(
    'score-all-leads',
    {
      type: 'score-all-leads',
      data: {},
    },
    {
      attempts: 1,
    }
  );
}

export async function queueTrainModel(force: boolean = false) {
  return scoreQueue.add(
    'train-model',
    {
      type: 'train-model',
      data: { force },
    },
    {
      attempts: 1,
    }
  );
}

export async function queueTrackConversion(
  leadId: string,
  conversionType: ConversionType,
  channel?: string,
  metadata?: Record<string, unknown>
) {
  return scoreQueue.add(
    'track-conversion',
    {
      type: 'track-conversion',
      data: {
        leadId,
        conversionType,
        channel,
        metadata,
      },
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  );
}
