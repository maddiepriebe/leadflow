import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

// Processes jobs from the hunter queue
// Docs: https://hunter.io/api-documentation

dotenv.config();

const HUNTER_API_KEY = process.env.HUNTER_API_KEY || '';
const HUNTER_API_BASE_URL = 'https://api.hunter.io/v2';

const prisma = new PrismaClient();

// Create Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

// Helper to call Hunter API
async function callHunterAPI(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${HUNTER_API_BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', HUNTER_API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({}));
    throw new Error(`Hunter API error: ${error.errors?.[0]?.details || response.statusText}`);
  }

  return response.json();
}

// Create worker
export const hunterWorker = new Worker(
  'hunter',  // Queue name
  async (job) => {
    console.log(`🔄 Processing Hunter job ${job.id}...`);

    const { type, data } = job.data;

    try {
      switch (type) {
        case 'enrich-lead':
          return await enrichLead(data);

        case 'verify-email':
          return await verifyEmail(data);

        case 'find-email':
          return await findEmail(data);

        case 'domain-search':
          return await domainSearch(data);

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process Hunter job ${job.id}:`, error);
      throw error;  // Job will retry
    }
  },
  {
    connection,
    concurrency: 3  // Hunter has stricter rate limits
  }
);

// Enrich a single lead with Hunter data
async function enrichLead(data: { leadId: string; email?: string }) {
  const { leadId, email } = data;

  console.log(`🔍 Enriching lead ${leadId} with Hunter...`);

  // Fetch lead if email not provided
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const leadEmail = email || lead.email;

  // Call Hunter email finder API
  const hunterData = await callHunterAPI('/email-finder', { email: leadEmail });

  if (!hunterData.data) {
    console.log(`⚠️ No Hunter data found for lead ${leadId}`);
    return { success: false, leadId, reason: 'No data found' };
  }

  const personData = hunterData.data;

  // Update lead in database
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstName: personData.first_name || lead.firstName,
      lastName: personData.last_name || lead.lastName,
      company: personData.organization || lead.company,
      position: personData.position || lead.position,
      linkedinUrl: personData.linkedin || lead.linkedinUrl,
      enrichmentData: {
        source: 'hunter',
        person: {
          firstName: personData.first_name,
          lastName: personData.last_name,
          email: personData.email,
          position: personData.position,
          seniority: personData.seniority,
          department: personData.department,
          linkedin: personData.linkedin,
          twitter: personData.twitter,
          phone: personData.phone_number
        },
        company: {
          name: personData.organization,
          domain: personData.domain
        },
        confidence: personData.confidence,
        enrichedAt: new Date().toISOString()
      },
      status: 'enriched'
    }
  });

  console.log(`✅ Lead ${leadId} enriched successfully with Hunter`);

  return { success: true, leadId, confidence: personData.confidence };
}

// Verify an email address
async function verifyEmail(data: { leadId: string; email: string }) {
  const { leadId, email } = data;

  console.log(`🔍 Verifying email ${email} for lead ${leadId}...`);

  const result = await callHunterAPI('/email-verifier', { email });

  if (!result.data) {
    return { success: false, leadId, email, reason: 'Verification failed' };
  }

  const verification = result.data;

  // Update lead with verification status
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const existingEnrichment = (lead.enrichmentData as any) || {};

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      enrichmentData: {
        ...existingEnrichment,
        emailVerification: {
          status: verification.status,
          result: verification.result,
          score: verification.score,
          regexp: verification.regexp,
          gibberish: verification.gibberish,
          disposable: verification.disposable,
          webmail: verification.webmail,
          mxRecords: verification.mx_records,
          smtpServer: verification.smtp_server,
          smtpCheck: verification.smtp_check,
          acceptAll: verification.accept_all,
          block: verification.block,
          verifiedAt: new Date().toISOString()
        }
      }
    }
  });

  console.log(`✅ Email ${email} verified: ${verification.result}`);

  return {
    success: true,
    leadId,
    email,
    status: verification.status,
    result: verification.result,
    score: verification.score
  };
}

// Find email for a person at a company
async function findEmail(data: {
  leadId: string;
  firstName: string;
  lastName: string;
  domain: string;
}) {
  const { leadId, firstName, lastName, domain } = data;

  console.log(`🔍 Finding email for ${firstName} ${lastName} at ${domain}...`);

  const result = await callHunterAPI('/email-finder', {
    first_name: firstName,
    last_name: lastName,
    domain: domain
  });

  if (!result.data?.email) {
    return { success: false, leadId, reason: 'Email not found' };
  }

  const emailData = result.data;

  // Update lead with found email
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      email: emailData.email,
      enrichmentData: {
        source: 'hunter',
        emailFound: true,
        confidence: emailData.confidence,
        position: emailData.position,
        seniority: emailData.seniority,
        department: emailData.department,
        linkedin: emailData.linkedin,
        twitter: emailData.twitter,
        foundAt: new Date().toISOString()
      }
    }
  });

  console.log(`✅ Found email ${emailData.email} with ${emailData.confidence}% confidence`);

  return {
    success: true,
    leadId,
    email: emailData.email,
    confidence: emailData.confidence
  };
}

// Search for all emails at a domain
async function domainSearch(data: { domain: string; icpId?: string }) {
  const { domain, icpId } = data;

  console.log(`🔍 Searching for emails at ${domain}...`);

  const result = await callHunterAPI('/domain-search', { domain });

  if (!result.data) {
    return { success: false, domain, reason: 'No data found' };
  }

  const domainData = result.data;
  const emails = domainData.emails || [];

  console.log(`✅ Found ${emails.length} emails at ${domain}`);

  // Save leads to database
  let createdCount = 0;
  let skippedCount = 0;

  for (const person of emails) {
    try {
      if (!person.value) {
        skippedCount++;
        continue;
      }

      await prisma.lead.upsert({
        where: { email: person.value },
        update: {
          enrichmentData: {
            source: 'hunter',
            hunterData: person,
            lastUpdated: new Date().toISOString()
          }
        },
        create: {
          firstName: person.first_name || '',
          lastName: person.last_name || '',
          email: person.value,
          company: domainData.organization,
          position: person.position,
          linkedinUrl: person.linkedin,
          source: 'hunter',
          status: 'new',
          icpId: icpId,
          enrichmentData: {
            source: 'hunter',
            confidence: person.confidence,
            seniority: person.seniority,
            department: person.department,
            linkedin: person.linkedin,
            twitter: person.twitter,
            phone: person.phone_number,
            discoveredAt: new Date().toISOString()
          }
        }
      });

      createdCount++;
    } catch (error: any) {
      console.error(`Failed to save lead ${person.value}:`, error.message);
      skippedCount++;
    }
  }

  return {
    success: true,
    domain,
    organization: domainData.organization,
    totalFound: emails.length,
    created: createdCount,
    skipped: skippedCount
  };
}

// Event handlers
hunterWorker.on('completed', (job) => {
  console.log(`✅ Hunter job ${job.id} completed`);
});

hunterWorker.on('failed', (job, err) => {
  console.error(`❌ Hunter job ${job?.id} failed:`, err.message);
});

hunterWorker.on('error', (err) => {
  console.error('Hunter worker error:', err);
});

console.log('👷 Hunter worker started');
