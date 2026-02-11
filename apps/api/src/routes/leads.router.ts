import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  apolloQueue,
  clearbitQueue,
  hunterQueue,
  peopleDataLabsQueue
} from '../queues';

// ==========================================
// LEADS ROUTER
// ==========================================
// Handles all /api/leads endpoints

const router = Router();
const prisma = new PrismaClient();

// Supported enrichment providers
type EnrichmentProvider = 'apollo' | 'clearbit' | 'hunter' | 'peopledatalabs';

// Map provider names to their queues
const providerQueues: Record<EnrichmentProvider, typeof apolloQueue> = {
  apollo: apolloQueue,
  clearbit: clearbitQueue,
  hunter: hunterQueue,
  peopledatalabs: peopleDataLabsQueue
};

// Check which providers are configured via environment variables
function getConfiguredProviders(): EnrichmentProvider[] {
  const configured: EnrichmentProvider[] = [];
  if (process.env.APOLLO_API_KEY) configured.push('apollo');
  if (process.env.CLEARBIT_API_KEY) configured.push('clearbit');
  if (process.env.HUNTER_API_KEY) configured.push('hunter');
  if (process.env.PDL_API_KEY) configured.push('peopledatalabs');
  return configured;
}

const reservedLeadIds = new Set(['enrich', 'enrichment']);

router.param('id', (req, res, next, id: string) => {
  if (reservedLeadIds.has(id.toLowerCase())) {
    return res.status(400).json({ error: `Invalid lead id: ${id}` });
  }

  next();
});

// GET /api/leads - Get all leads
router.get('/', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        campaign: true,  // Include related campaign
        messages: true   // Include related messages
      },
      orderBy: {
        createdAt: 'desc'  // Newest first
      }
    });

    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/leads/enrichment/providers - Get available enrichment providers
router.get('/enrichment/providers', async (req, res) => {
  try {
    const configured = getConfiguredProviders();
    const all: EnrichmentProvider[] = ['apollo', 'clearbit', 'hunter', 'peopledatalabs'];

    res.json({
      configured,
      available: all,
      unconfigured: all.filter(p => !configured.includes(p))
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// GET /api/leads/:id - Get single lead
router.get('/:id', async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: true,
        messages: true
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// POST /api/leads - Create new lead
router.post('/', async (req, res) => {
  try {
    // Validate required fields
    const { firstName, lastName, email, source } = req.body;

    if (!firstName || !lastName || !email || !source) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Create lead in database
    const lead = await prisma.lead.create({
      data: {
        firstName,
        lastName,
        email,
        phone: req.body.phone,
        company: req.body.company,
        position: req.body.position,
        linkedinUrl: req.body.linkedinUrl,
        source,
        status: 'new'
      }
    });

    // Auto-enrich with first configured provider (optional)
    const configured = getConfiguredProviders();
    if (configured.length > 0) {
      const defaultProvider = configured[0];
      await providerQueues[defaultProvider].add('enrich-lead', {
        type: 'enrich-lead',
        data: { leadId: lead.id }
      });
    }

    res.status(201).json(lead);
  } catch (error: any) {
    console.error('Error creating lead:', error);

    // Handle unique constraint violation (duplicate email)
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Email already exists'
      });
    }

    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// PUT /api/leads/:id - Update lead
router.put('/:id', async (req, res) => {
  try {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json(lead);
  } catch (error: any) {
    console.error('Error updating lead:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', async (req, res) => {
  try {
    await prisma.lead.delete({
      where: { id: req.params.id }
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting lead:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// ==========================================
// ENRICHMENT ENDPOINTS
// ==========================================

// POST /api/leads/:id/enrich - Enrich a single lead with specified provider
router.post('/:id/enrich', async (req, res) => {
  try {
    const { id } = req.params;
    const { provider } = req.body as { provider: EnrichmentProvider };

    // Validate provider
    if (!provider || !providerQueues[provider]) {
      return res.status(400).json({
        error: 'Invalid or missing provider',
        validProviders: Object.keys(providerQueues)
      });
    }

    // Check if provider is configured
    const configured = getConfiguredProviders();
    if (!configured.includes(provider)) {
      return res.status(400).json({
        error: `Provider ${provider} is not configured`,
        configuredProviders: configured
      });
    }

    // Verify lead exists
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Queue enrichment job to the specific provider queue
    const queue = providerQueues[provider];
    const job = await queue.add('enrich-lead', {
      type: 'enrich-lead',
      data: { leadId: id, email: lead.email }
    });

    res.json({
      success: true,
      message: `Enrichment job queued with ${provider}`,
      jobId: job.id,
      leadId: id,
      provider
    });
  } catch (error) {
    console.error('Error queuing enrichment:', error);
    res.status(500).json({ error: 'Failed to queue enrichment' });
  }
});

// POST /api/leads/:id/enrich/all - Enrich with all configured providers
router.post('/:id/enrich/all', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify lead exists
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const configured = getConfiguredProviders();
    if (configured.length === 0) {
      return res.status(400).json({
        error: 'No enrichment providers configured'
      });
    }

    // Queue enrichment job to each configured provider
    const jobs: { provider: string; jobId: string | undefined }[] = [];

    for (const provider of configured) {
      const queue = providerQueues[provider];
      const job = await queue.add('enrich-lead', {
        type: 'enrich-lead',
        data: { leadId: id, email: lead.email }
      });
      jobs.push({ provider, jobId: job.id });
    }

    res.json({
      success: true,
      message: 'Enrichment jobs queued with all providers',
      leadId: id,
      jobs
    });
  } catch (error) {
    console.error('Error queuing multi-provider enrichment:', error);
    res.status(500).json({ error: 'Failed to queue enrichment' });
  }
});

// POST /api/leads/enrich/batch - Enrich multiple leads with specified provider
router.post('/enrich/batch', async (req, res) => {
  try {
    const { leadIds, provider } = req.body as {
      leadIds: string[];
      provider: EnrichmentProvider;
    };

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds array is required' });
    }

    if (!provider || !providerQueues[provider]) {
      return res.status(400).json({
        error: 'Invalid or missing provider',
        validProviders: Object.keys(providerQueues)
      });
    }

    // Check if provider is configured
    const configured = getConfiguredProviders();
    if (!configured.includes(provider)) {
      return res.status(400).json({
        error: `Provider ${provider} is not configured`,
        configuredProviders: configured
      });
    }

    // Queue enrichment jobs for each lead
    const queue = providerQueues[provider];
    const jobs: { leadId: string; jobId: string | undefined }[] = [];

    for (const leadId of leadIds) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (lead) {
        const job = await queue.add('enrich-lead', {
          type: 'enrich-lead',
          data: { leadId, email: lead.email }
        });
        jobs.push({ leadId, jobId: job.id });
      }
    }

    res.json({
      success: true,
      message: `Batch enrichment jobs queued with ${provider}`,
      provider,
      totalRequested: leadIds.length,
      jobsQueued: jobs.length,
      jobs
    });
  } catch (error) {
    console.error('Error queuing batch enrichment:', error);
    res.status(500).json({ error: 'Failed to queue batch enrichment' });
  }
});

// GET /api/leads/enrich/job/:provider/:jobId - Get enrichment job status
router.get('/enrich/job/:provider/:jobId', async (req, res) => {
  try {
    const { provider, jobId } = req.params;

    if (!providerQueues[provider as EnrichmentProvider]) {
      return res.status(400).json({
        error: 'Invalid provider',
        validProviders: Object.keys(providerQueues)
      });
    }

    const queue = providerQueues[provider as EnrichmentProvider];
    const job = await queue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();

    res.json({
      jobId: job.id,
      provider,
      state,
      progress: job.progress,
      result: job.returnvalue,
      error: job.failedReason,
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      finishedAt: job.finishedOn
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// ==========================================
// HUNTER-SPECIFIC ENDPOINTS
// ==========================================

// POST /api/leads/:id/verify-email - Verify email with Hunter
router.post('/:id/verify-email', async (req, res) => {
  try {
    const { id } = req.params;

    if (!getConfiguredProviders().includes('hunter')) {
      return res.status(400).json({ error: 'Hunter is not configured' });
    }

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const job = await hunterQueue.add('verify-email', {
      type: 'verify-email',
      data: { leadId: id, email: lead.email }
    });

    res.json({
      success: true,
      message: 'Email verification job queued',
      jobId: job.id,
      leadId: id,
      email: lead.email
    });
  } catch (error) {
    console.error('Error queuing email verification:', error);
    res.status(500).json({ error: 'Failed to queue verification' });
  }
});

// POST /api/leads/:id/find-email - Find email with Hunter
router.post('/:id/find-email', async (req, res) => {
  try {
    const { id } = req.params;
    const { domain } = req.body;

    if (!getConfiguredProviders().includes('hunter')) {
      return res.status(400).json({ error: 'Hunter is not configured' });
    }

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (!domain && !lead.company) {
      return res.status(400).json({ error: 'Domain or company is required' });
    }

    const job = await hunterQueue.add('find-email', {
      type: 'find-email',
      data: {
        leadId: id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        domain: domain || lead.company
      }
    });

    res.json({
      success: true,
      message: 'Email finder job queued',
      jobId: job.id,
      leadId: id
    });
  } catch (error) {
    console.error('Error queuing email finder:', error);
    res.status(500).json({ error: 'Failed to queue email finder' });
  }
});

export default router;
