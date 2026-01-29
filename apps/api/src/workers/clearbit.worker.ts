import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

// Processes jobs from the clearbit queue
// Docs: https://clearbit.com/docs

dotenv.config();

const CLEARBIT_API_KEY = process.env.CLEARBIT_API_KEY || '';

const prisma = new PrismaClient();

// Create Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

// Helper to call Clearbit Person API
async function callClearbitPersonAPI(email: string): Promise<any> {
  const url = `https://person.clearbit.com/v2/combined/find?email=${encodeURIComponent(email)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CLEARBIT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 404) {
    return null; // No data found
  }

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({}));
    throw new Error(`Clearbit API error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

// Helper to call Clearbit Company API
async function callClearbitCompanyAPI(domain: string): Promise<any> {
  const url = `https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(domain)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CLEARBIT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({}));
    throw new Error(`Clearbit API error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

// Create worker
export const clearbitWorker = new Worker(
  'clearbit',  // Queue name
  async (job) => {
    console.log(`🔄 Processing Clearbit job ${job.id}...`);

    const { type, data } = job.data;

    try {
      switch (type) {
        case 'enrich-lead':
          return await enrichLead(data);

        case 'enrich-company':
          return await enrichCompany(data);

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process Clearbit job ${job.id}:`, error);
      throw error;  // Job will retry
    }
  },
  {
    connection,
    concurrency: 5  // Clearbit allows decent rate limits
  }
);

// Enrich a single lead with Clearbit data
async function enrichLead(data: { leadId: string; email?: string }) {
  const { leadId, email } = data;

  console.log(`🔍 Enriching lead ${leadId} with Clearbit...`);

  // Fetch lead if email not provided
  let leadEmail = email;
  if (!leadEmail) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }
    leadEmail = lead.email;
  }

  // Call Clearbit API
  const clearbitData = await callClearbitPersonAPI(leadEmail);

  if (!clearbitData) {
    console.log(`⚠️ No Clearbit data found for lead ${leadId}`);
    return { success: false, leadId, reason: 'No data found' };
  }

  const person = clearbitData.person;
  const company = clearbitData.company;

  // Update lead in database
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstName: person?.name?.givenName || undefined,
      lastName: person?.name?.familyName || undefined,
      company: company?.name || undefined,
      position: person?.employment?.title || undefined,
      linkedinUrl: person?.linkedin?.handle ? `https://linkedin.com/in/${person.linkedin.handle}` : undefined,
      enrichmentData: {
        clearbitId: person?.id,
        source: 'clearbit',
        person: {
          name: person?.name?.fullName,
          title: person?.employment?.title,
          seniority: person?.employment?.seniority,
          bio: person?.bio,
          location: person?.location,
          linkedin: person?.linkedin?.handle,
          twitter: person?.twitter?.handle
        },
        company: {
          name: company?.name,
          domain: company?.domain,
          industry: company?.category?.industry,
          subIndustry: company?.category?.subIndustry,
          employeesRange: company?.metrics?.employeesRange,
          employees: company?.metrics?.employees,
          annualRevenue: company?.metrics?.annualRevenue,
          raised: company?.metrics?.raised,
          foundedYear: company?.foundedYear,
          description: company?.description,
          location: company?.location,
          tech: company?.tech
        },
        enrichedAt: new Date().toISOString()
      },
      status: 'enriched'
    }
  });

  console.log(`✅ Lead ${leadId} enriched successfully with Clearbit`);

  return { success: true, leadId };
}

// Enrich company data by domain
async function enrichCompany(data: { leadId: string; domain: string }) {
  const { leadId, domain } = data;

  console.log(`🔍 Enriching company ${domain} for lead ${leadId} with Clearbit...`);

  const companyData = await callClearbitCompanyAPI(domain);

  if (!companyData) {
    console.log(`⚠️ No Clearbit company data found for ${domain}`);
    return { success: false, leadId, domain, reason: 'No data found' };
  }

  // Update lead with company data
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const existingEnrichment = (lead.enrichmentData as any) || {};

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      company: companyData.name || lead.company,
      enrichmentData: {
        ...existingEnrichment,
        companySource: 'clearbit',
        company: {
          name: companyData.name,
          domain: companyData.domain,
          industry: companyData.category?.industry,
          subIndustry: companyData.category?.subIndustry,
          employeesRange: companyData.metrics?.employeesRange,
          employees: companyData.metrics?.employees,
          annualRevenue: companyData.metrics?.annualRevenue,
          raised: companyData.metrics?.raised,
          foundedYear: companyData.foundedYear,
          description: companyData.description,
          location: companyData.location,
          tech: companyData.tech,
          linkedin: companyData.linkedin?.handle
        },
        companyEnrichedAt: new Date().toISOString()
      }
    }
  });

  console.log(`✅ Company ${domain} enriched for lead ${leadId}`);

  return { success: true, leadId, domain };
}

// Event handlers
clearbitWorker.on('completed', (job) => {
  console.log(`✅ Clearbit job ${job.id} completed`);
});

clearbitWorker.on('failed', (job, err) => {
  console.error(`❌ Clearbit job ${job?.id} failed:`, err.message);
});

clearbitWorker.on('error', (err) => {
  console.error('Clearbit worker error:', err);
});

console.log('👷 Clearbit worker started');
