import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

// Processes jobs from the peopledatalabs queue
// Docs: https://docs.peopledatalabs.com/

dotenv.config();

const PDL_API_KEY = process.env.PDL_API_KEY || '';
const PDL_API_BASE_URL = 'https://api.peopledatalabs.com/v5';

const prisma = new PrismaClient();

// Create Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

// Helper to call PDL API
async function callPDLAPI(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${PDL_API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Api-Key': PDL_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({}));
    throw new Error(`PDL API error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

// Create worker
export const peopleDataLabsWorker = new Worker(
  'peopledatalabs',  // Queue name
  async (job) => {
    console.log(`🔄 Processing PDL job ${job.id}...`);

    const { type, data } = job.data;

    try {
      switch (type) {
        case 'enrich-lead':
          return await enrichLead(data);

        case 'enrich-by-linkedin':
          return await enrichByLinkedIn(data);

        case 'enrich-company':
          return await enrichCompany(data);

        case 'search-people':
          return await searchPeople(data);

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process PDL job ${job.id}:`, error);
      throw error;  // Job will retry
    }
  },
  {
    connection,
    concurrency: 5
  }
);

// Enrich a single lead by email
async function enrichLead(data: { leadId: string; email?: string }) {
  const { leadId, email } = data;

  console.log(`🔍 Enriching lead ${leadId} with People Data Labs...`);

  // Fetch lead if email not provided
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const leadEmail = email || lead.email;

  // Call PDL Person Enrichment API
  const pdlData = await callPDLAPI('/person/enrich', { email: leadEmail });

  if (!pdlData) {
    console.log(`⚠️ No PDL data found for lead ${leadId}`);
    return { success: false, leadId, reason: 'No data found' };
  }

  // Update lead in database
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstName: pdlData.first_name || lead.firstName,
      lastName: pdlData.last_name || lead.lastName,
      company: pdlData.job_company_name || lead.company,
      position: pdlData.job_title || lead.position,
      phone: pdlData.mobile_phone || pdlData.phone_numbers?.[0] || lead.phone,
      linkedinUrl: pdlData.linkedin_url || lead.linkedinUrl,
      enrichmentData: {
        source: 'peopledatalabs',
        pdlId: pdlData.id,
        person: {
          fullName: pdlData.full_name,
          firstName: pdlData.first_name,
          lastName: pdlData.last_name,
          gender: pdlData.gender,
          birthYear: pdlData.birth_year,
          linkedinUrl: pdlData.linkedin_url,
          linkedinUsername: pdlData.linkedin_username,
          twitterUrl: pdlData.twitter_url,
          facebookUrl: pdlData.facebook_url,
          githubUrl: pdlData.github_url,
          workEmail: pdlData.work_email,
          personalEmails: pdlData.personal_emails,
          mobilePhone: pdlData.mobile_phone,
          phoneNumbers: pdlData.phone_numbers,
          location: pdlData.location_name,
          locality: pdlData.location_locality,
          region: pdlData.location_region,
          country: pdlData.location_country,
          summary: pdlData.summary,
          skills: pdlData.skills,
          interests: pdlData.interests,
          education: pdlData.education,
          experience: pdlData.experience
        },
        company: {
          name: pdlData.job_company_name,
          website: pdlData.job_company_website,
          size: pdlData.job_company_size,
          industry: pdlData.job_company_industry,
          location: pdlData.job_company_location_name,
          linkedinUrl: pdlData.job_company_linkedin_url,
          founded: pdlData.job_company_founded
        },
        job: {
          title: pdlData.job_title,
          titleRole: pdlData.job_title_role,
          titleLevels: pdlData.job_title_levels,
          startDate: pdlData.job_start_date
        },
        enrichedAt: new Date().toISOString()
      },
      status: 'enriched'
    }
  });

  console.log(`✅ Lead ${leadId} enriched successfully with PDL`);

  return { success: true, leadId };
}

// Enrich by LinkedIn URL
async function enrichByLinkedIn(data: { leadId: string; linkedinUrl: string }) {
  const { leadId, linkedinUrl } = data;

  console.log(`🔍 Enriching lead ${leadId} by LinkedIn with PDL...`);

  const pdlData = await callPDLAPI('/person/enrich', { profile: linkedinUrl });

  if (!pdlData) {
    console.log(`⚠️ No PDL data found for LinkedIn ${linkedinUrl}`);
    return { success: false, leadId, reason: 'No data found' };
  }

  // Update lead in database
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstName: pdlData.first_name,
      lastName: pdlData.last_name,
      email: pdlData.work_email || pdlData.personal_emails?.[0],
      company: pdlData.job_company_name,
      position: pdlData.job_title,
      phone: pdlData.mobile_phone || pdlData.phone_numbers?.[0],
      linkedinUrl: pdlData.linkedin_url,
      enrichmentData: {
        source: 'peopledatalabs',
        pdlId: pdlData.id,
        fullData: pdlData,
        enrichedAt: new Date().toISOString()
      },
      status: 'enriched'
    }
  });

  console.log(`✅ Lead ${leadId} enriched by LinkedIn`);

  return { success: true, leadId, email: pdlData.work_email };
}

// Enrich company data
async function enrichCompany(data: { leadId: string; domain: string }) {
  const { leadId, domain } = data;

  console.log(`🔍 Enriching company ${domain} for lead ${leadId} with PDL...`);

  const companyData = await callPDLAPI('/company/enrich', { website: domain });

  if (!companyData) {
    console.log(`⚠️ No PDL company data found for ${domain}`);
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
        companySource: 'peopledatalabs',
        company: {
          name: companyData.name,
          displayName: companyData.display_name,
          website: companyData.website,
          size: companyData.size,
          employeeCount: companyData.employee_count,
          industry: companyData.industry,
          founded: companyData.founded,
          location: companyData.location?.name,
          linkedinUrl: companyData.linkedin_url,
          twitterUrl: companyData.twitter_url,
          facebookUrl: companyData.facebook_url,
          summary: companyData.summary,
          tags: companyData.tags,
          totalFundingRaised: companyData.total_funding_raised,
          latestFundingStage: companyData.latest_funding_stage
        },
        companyEnrichedAt: new Date().toISOString()
      }
    }
  });

  console.log(`✅ Company ${domain} enriched for lead ${leadId}`);

  return { success: true, leadId, domain };
}

// Search for people matching criteria
async function searchPeople(data: {
  icpId: string;
  query: string;
  size?: number;
}) {
  const { icpId, query, size = 25 } = data;

  console.log(`🔍 Searching PDL for people: ${query}...`);

  // Fetch ICP for criteria
  const icp = await prisma.iCP.findUnique({ where: { id: icpId } });
  if (!icp) {
    throw new Error(`ICP ${icpId} not found`);
  }

  // Build PDL SQL query from ICP criteria
  const criteria = icp.criteria as any;
  const sqlParts: string[] = [];

  if (criteria.jobTitles?.length > 0) {
    const titles = criteria.jobTitles.map((t: string) => `'${t}'`).join(', ');
    sqlParts.push(`job_title IN (${titles})`);
  }

  if (criteria.industries?.length > 0) {
    const industries = criteria.industries.map((i: string) => `'${i}'`).join(', ');
    sqlParts.push(`job_company_industry IN (${industries})`);
  }

  if (criteria.locations?.length > 0) {
    const locations = criteria.locations.map((l: string) => `'${l}'`).join(', ');
    sqlParts.push(`location_country IN (${locations})`);
  }

  if (criteria.companySize?.length > 0) {
    const sizes = criteria.companySize.map((s: string) => `'${s}'`).join(', ');
    sqlParts.push(`job_company_size IN (${sizes})`);
  }

  const sqlQuery = sqlParts.length > 0 ? sqlParts.join(' AND ') : query;

  // Call PDL Person Search API
  const url = new URL(`${PDL_API_BASE_URL}/person/search`);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'X-Api-Key': PDL_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sql: sqlQuery,
      size: size
    })
  });

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({}));
    throw new Error(`PDL Search API error: ${error.error?.message || response.statusText}`);
  }

  const searchResult = await response.json();
  const people = searchResult.data || [];

  console.log(`✅ Found ${people.length} people matching criteria`);

  // Save leads to database
  let createdCount = 0;
  let skippedCount = 0;

  for (const person of people) {
    try {
      const email = person.work_email || person.personal_emails?.[0];
      if (!email) {
        skippedCount++;
        continue;
      }

      await prisma.lead.upsert({
        where: { email },
        update: {
          enrichmentData: {
            source: 'peopledatalabs',
            pdlId: person.id,
            fullData: person,
            lastUpdated: new Date().toISOString()
          }
        },
        create: {
          firstName: person.first_name || '',
          lastName: person.last_name || '',
          email,
          phone: person.mobile_phone || person.phone_numbers?.[0],
          company: person.job_company_name,
          position: person.job_title,
          linkedinUrl: person.linkedin_url,
          source: 'peopledatalabs',
          status: 'new',
          icpId: icpId,
          enrichmentData: {
            source: 'peopledatalabs',
            pdlId: person.id,
            fullData: person,
            discoveredAt: new Date().toISOString()
          }
        }
      });

      createdCount++;
    } catch (error: any) {
      console.error(`Failed to save lead:`, error.message);
      skippedCount++;
    }
  }

  console.log(`✅ Saved ${createdCount} leads, skipped ${skippedCount}`);

  return {
    success: true,
    icpId,
    totalFound: people.length,
    created: createdCount,
    skipped: skippedCount
  };
}

// Event handlers
peopleDataLabsWorker.on('completed', (job) => {
  console.log(`✅ PDL job ${job.id} completed`);
});

peopleDataLabsWorker.on('failed', (job, err) => {
  console.error(`❌ PDL job ${job?.id} failed:`, err.message);
});

peopleDataLabsWorker.on('error', (err) => {
  console.error('PDL worker error:', err);
});

console.log('👷 People Data Labs worker started');
