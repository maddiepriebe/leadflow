import { Worker } from "bullmq";   
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import dotenv from "dotenv";

// Processes jobs from the apollo queue
// listen to a queue, worker picks up job, processes job, marks complete, retries if failed

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';
const APOLLO_API_BASE_URL = 'https://api.apollo.io/v1';

// Helper to call Apollo API
async function callApolloAPI(endpoint: string, params: any){
    const url = `${APOLLO_API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Api-Key': APOLLO_API_KEY  // Apollo uses X-Api-Key, not Bearer token
        },
        body: JSON.stringify(params)
    });
    if (!response.ok) {
        const error: any = await response.json();
        throw new Error(`Apollo API error: ${error.message || response.statusText}`);
    }
    return response.json();
}

// Convert ICP criteria to Apollo search parameters
function convertICPToApolloParams(criteria: any) {
  const params: any = {};

  // Job titles -> person_titles
  if (criteria.jobTitles && criteria.jobTitles.length > 0) {
    params.person_titles = criteria.jobTitles;
  }

  // Industries -> q_organization_keyword_tags (use keyword tags for flexibility)
  if (criteria.industries && criteria.industries.length > 0) {
    params.q_organization_keyword_tags = criteria.industries;
  }

  // Company size -> organization_num_employees_ranges
  if (criteria.companySize && criteria.companySize.length > 0) {
    params.organization_num_employees_ranges = criteria.companySize;
  }

  // Locations -> person_locations
  if (criteria.locations && criteria.locations.length > 0) {
    params.person_locations = criteria.locations;
  }

  // Technologies -> add to keyword tags
  if (criteria.technologies && criteria.technologies.length > 0) {
    params.q_organization_keyword_tags = [
      ...(params.q_organization_keyword_tags || []),
      ...criteria.technologies
    ];
  }

  // Keywords -> q_keywords
  if (criteria.keywords && criteria.keywords.length > 0) {
    params.q_keywords = criteria.keywords.join(' ');
  }

  // Funding stages -> organization_latest_funding_stage_cd
  if (criteria.fundingStages && criteria.fundingStages.length > 0) {
    params.organization_latest_funding_stage_cd = criteria.fundingStages;
  }

  return params;
}

dotenv.config();

const prisma = new PrismaClient();

// Create Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

// Create worker
export const apolloWorker = new Worker(
  'apollo',  // Queue name
  async (job) => {
    console.log(`🔄 Processing Apollo job ${job.id}...`);

    const { type, data } = job.data;

    try {
      switch (type) {
        case 'search-by-icp':
          return await searchLeadsByICP(data);

        case 'enrich-lead':
          return await enrichLead(data);

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process Apollo job ${job.id}:`, error);
      throw error;  // Job will retry
    }
  },
  {
    connection,
    concurrency: 3  // Process 3 jobs at once (Apollo has rate limits)
  }
);

// Search for leads based on ICP criteria
async function searchLeadsByICP(data: {
  icpId: string;
  page?: number;
  perPage?: number;
}) {
  const { icpId, page = 1, perPage = 25 } = data;

  console.log(`🔍 Searching Apollo for leads matching ICP ${icpId}...`);

  // Fetch the ICP profile from database
  const icp = await prisma.iCP.findUnique({
    where: { id: icpId }
  });

  if (!icp) {
    throw new Error(`ICP profile ${icpId} not found`);
  }

  // Convert ICP criteria to Apollo parameters
  const apolloParams = convertICPToApolloParams(icp.criteria);

  // Add pagination
  apolloParams.page = page;
  apolloParams.per_page = perPage;

  console.log('Apollo search params:', JSON.stringify(apolloParams, null, 2));

  // Call Apollo People Search API
  const apolloData: any = await callApolloAPI('/mixed_people/search', apolloParams);

  const people = apolloData.people || [];
  const pagination = apolloData.pagination;

  console.log(`✅ Found ${people.length} people (${pagination?.total_entries || 0} total)`);

  // Save leads to database
  let createdCount = 0;
  let skippedCount = 0;

  for (const person of people) {
    try {
      // Skip if no email
      if (!person.email) {
        skippedCount++;
        continue;
      }

      // Create or update lead
      await prisma.lead.upsert({
        where: { email: person.email },
        update: {
          // Update enrichment data if lead already exists
          enrichmentData: {
            apolloId: person.id,
            source: 'apollo',
            lastEnriched: new Date().toISOString(),
            ...person
          }
        },
        create: {
          firstName: person.first_name || '',
          lastName: person.last_name || '',
          email: person.email,
          phone: person.phone_numbers?.[0]?.sanitized_number,
          company: person.organization?.name,
          position: person.title,
          linkedinUrl: person.linkedin_url,
          source: 'apollo',
          status: 'new',
          icpId: icpId,
          enrichmentData: {
            apolloId: person.id,
            apolloData: person,
            icpName: icp.name,
            discoveredAt: new Date().toISOString()
          }
        }
      });

      createdCount++;
    } catch (error: any) {
      console.error(`Failed to save lead ${person.email}:`, error.message);
      skippedCount++;
    }
  }

  console.log(`✅ Saved ${createdCount} leads, skipped ${skippedCount}`);

  return {
    success: true,
    icpId,
    totalResults: pagination?.total_entries || 0,
    returnedResults: people.length,
    createdLeads: createdCount,
    skippedLeads: skippedCount,
    page,
    perPage,
    totalPages: Math.ceil((pagination?.total_entries || 0) / perPage)
  };
}

// Enrich a single lead with Apollo data
async function enrichLead(data: { leadId: string; email?: string; linkedinUrl?: string }) {
  const { leadId, email, linkedinUrl } = data;

  console.log(`🔍 Enriching lead ${leadId} with Apollo...`);

  // Call Apollo Person Enrichment API
  const apolloData: any = await callApolloAPI('/people/match', {
    email,
    reveal_personal_emails: true,
    linkedin_url: linkedinUrl
  });

  const person = apolloData.person;

  if (!person) {
    console.log(`⚠️ No Apollo data found for lead ${leadId}`);
    return { success: false, leadId, reason: 'No data found' };
  }

  // Update lead in database
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstName: person.first_name || undefined,
      lastName: person.last_name || undefined,
      company: person.organization?.name || undefined,
      position: person.title || undefined,
      phone: person.phone_numbers?.[0]?.sanitized_number || undefined,
      linkedinUrl: person.linkedin_url || undefined,
      enrichmentData: {
        apolloId: person.id,
        title: person.title,
        company: person.organization?.name,
        companyDomain: person.organization?.primary_domain,
        companyIndustry: person.organization?.industry,
        companySize: person.organization?.estimated_num_employees,
        location: person.city ? `${person.city}, ${person.state}, ${person.country}` : null,
        phoneNumbers: person.phone_numbers,
        emailStatus: person.email_status,
        seniority: person.seniority,
        departments: person.departments,
        enrichedAt: new Date().toISOString()
      },
      status: 'enriched'
    }
  });

  console.log(`✅ Lead ${leadId} enriched successfully`);

  return { success: true, leadId };
}

// Event handlers
apolloWorker.on('completed', (job) => {
  console.log(`✅ Apollo job ${job.id} completed`);
});

apolloWorker.on('failed', (job, err) => {
  console.error(`❌ Apollo job ${job?.id} failed:`, err.message);
});

apolloWorker.on('error', (err) => {
  console.error('Apollo worker error:', err);
});

console.log('👷 Apollo worker started');