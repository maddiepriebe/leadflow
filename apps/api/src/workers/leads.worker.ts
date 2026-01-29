import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import dotenv from "dotenv";

// Centralizes all lead database operations
// Other workers send lead data here to be saved/updated

dotenv.config();

const prisma = new PrismaClient();

// Create Redis connection
const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null
});

// Partial lead data that workers can send (for creating/updating leads)
interface LeadInput {
    // Required fields
    source: string;
    icpId?: string;

    // Contact info
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;

    // Company info
    company?: string;
    position?: string;

    // Metadata
    status?: string;
    enrichmentData?: any;
    campaignId?: string;
}

// Save or update a lead in the database
async function saveOrUpdateLead(data: LeadInput) {
    const {
        source,
        icpId,
        firstName = '',
        lastName = '',
        email,
        phone,
        linkedinUrl,
        company,
        position,
        status = 'new',
        enrichmentData = {},
        campaignId
    } = data;

    console.log(`=� Saving lead: ${firstName} ${lastName} (${email || linkedinUrl || 'no identifier'})`);

    // Determine unique identifier
    // Priority: email > linkedinUrl > generate from enrichmentData
    let uniqueId: string;

    if (email) {
        uniqueId = email;
    } else if (linkedinUrl) {
        // Extract LinkedIn username from URL
        const linkedinUsername = linkedinUrl.split('/in/')[1]?.split('/')[0];
        uniqueId = `linkedin_${linkedinUsername || Date.now()}`;
    } else if (enrichmentData.googlePlaceId) {
        uniqueId = `google_place_${enrichmentData.googlePlaceId}`;
    } else {
        // Generate unique ID from available data
        uniqueId = `${source}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    try {
        const lead = await prisma.lead.upsert({
            where: { email: uniqueId },
            update: {
                // Update fields if lead already exists
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                phone: phone || undefined,
                company: company || undefined,
                position: position || undefined,
                linkedinUrl: linkedinUrl || undefined,
                enrichmentData: {
                    ...enrichmentData,
                    source,
                    lastEnriched: new Date().toISOString()
                }
            },
            create: {
                firstName,
                lastName,
                email: uniqueId,
                phone,
                company,
                position,
                linkedinUrl,
                source,
                status,
                icpId,
                campaignId,
                enrichmentData: {
                    ...enrichmentData,
                    source,
                    discoveredAt: new Date().toISOString()
                }
            }
        });

        console.log(` Lead saved: ${lead.id}`);

        return {
            success: true,
            leadId: lead.id,
            action: email ? 'updated' : 'created'
        };
    } catch (error: any) {
        console.error(`L Failed to save lead:`, error.message);
        throw error;
    }
}

// Bulk save leads (for batch operations)
async function bulkSaveLeads(data: { leads: LeadInput[] }) {
    const { leads } = data;

    console.log(`=� Bulk saving ${leads.length} leads...`);

    let savedCount = 0;
    let skippedCount = 0;
    const errors: any[] = [];

    for (const leadData of leads) {
        try {
            await saveOrUpdateLead(leadData);
            savedCount++;
        } catch (error: any) {
            console.error(`Failed to save lead:`, error.message);
            skippedCount++;
            errors.push({
                leadData,
                error: error.message
            });
        }
    }

    console.log(` Bulk save complete: ${savedCount} saved, ${skippedCount} skipped`);

    return {
        success: true,
        savedCount,
        skippedCount,
        errors
    };
}

// Create worker
export const leadsWorker = new Worker(
    'discover', // Queue name (using existing discover queue)
    async (job) => {
        console.log(`= Processing lead job ${job.id}...`);

        const { type, data } = job.data;

        try {
            switch (type) {
                case 'save-lead':
                    return await saveOrUpdateLead(data);

                case 'bulk-save-leads':
                    return await bulkSaveLeads(data);

                default:
                    throw new Error(`Unknown job type: ${type}`);
            }
        } catch (error) {
            console.error(`L Failed to process lead job ${job.id}:`, error);
            throw error; // Job will retry
        }
    },
    {
        connection,
        concurrency: 5 // Process 5 leads at once
    }
);

// Event handlers
leadsWorker.on('completed', (job) => {
    console.log(` Lead job ${job.id} completed`);
});

leadsWorker.on('failed', (job, err) => {
    console.error(`L Lead job ${job?.id} failed:`, err.message);
});

leadsWorker.on('error', (err) => {
    console.error('Leads worker error:', err);
});

console.log('=w Leads worker started');
