import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import dotenv from "dotenv";
import { discoverQueue } from "../queues";

// Processes jobs from the google search queue
// listen to a queue, worker picks up job, processes job, marks complete, retries if failed

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || '';
const GOOGLE_PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const GOOGLE_CUSTOM_SEARCH_API_URL = 'https://www.googleapis.com/customsearch/v1';

// Helper to call Google Custom Search API
async function callGoogleCustomSearchAPI(params: any){
    const url = new URL(GOOGLE_CUSTOM_SEARCH_API_URL);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
    });
    if (!response.ok) {
        const error: any = await response.json();
        throw new Error(`Google Custom Search API error: ${error.error.message || response.statusText}`);
    }
    return response.json();
}

// Helper to call Google Places API
async function callGooglePlacesAPI(params: any){
    const url = new URL(GOOGLE_PLACES_API_URL);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
    });
    if (!response.ok) {
        const error: any = await response.json();
        throw new Error(`Google Places API error: ${error.error_message || response.statusText}`);
    }
    return response.json();
}


dotenv.config()

const prisma = new PrismaClient();

// Create Redis connection 
const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null
});



// Convert ICP criteria to multiple Google search queries
// Returns an array of search queries combining different criteria
function convertICPToGoogleQueries(criteria: any): string[] {
    const queries: string[] = [];
    const locations = criteria.locations || [];

    // Generate queries for each industry + location combination
    if (criteria.industries && criteria.industries.length > 0) {
        criteria.industries.forEach((industry: string) => {
            if (locations.length > 0) {
                locations.forEach((location: string) => {
                    queries.push(`${industry} in ${location}`);
                });
            } else {
                queries.push(industry);
            }
        });
    }

    // Generate queries for each job title + location combination
    if (criteria.jobTitles && criteria.jobTitles.length > 0) {
        criteria.jobTitles.forEach((jobTitle: string) => {
            if (locations.length > 0) {
                locations.forEach((location: string) => {
                    queries.push(`${jobTitle} in ${location}`);
                });
            } else {
                queries.push(jobTitle);
            }
        });
    }

    // Generate queries for each keyword + location combination
    if (criteria.keywords && criteria.keywords.length > 0) {
        criteria.keywords.forEach((keyword: string) => {
            if (locations.length > 0) {
                locations.forEach((location: string) => {
                    queries.push(`${keyword} ${location}`);
                });
            } else {
                queries.push(keyword);
            }
        });
    }

    // If no queries generated, create location-only queries or fallback
    if (queries.length === 0) {
        if (locations.length > 0) {
            locations.forEach((location: string) => {
                queries.push(`business in ${location}`);
            });
        } else {
            queries.push('business');
        }
    }

    return queries;
}

// Process Custom LinkedIn Search via Google Custom Search
async function processCustomLinkedInSearch(data: {
    icpId: string;
    page?: number;
    perPage?: number;
}) {
    const { icpId, page = 1, perPage = 10 } = data;

    console.log(`🔍 Searching Google Custom Search for LinkedIn profiles matching ICP ${icpId}...`);

    // Fetch the ICP profile from database
    const icp = await prisma.iCP.findUnique({
        where: { id: icpId }
    });

    if (!icp) {
        throw new Error(`ICP profile ${icpId} not found`);
    }

    // Build multiple search queries for LinkedIn profiles
    const searchQueries = convertICPToGoogleQueries(icp.criteria);
    console.log(`📋 Generated ${searchQueries.length} search queries`);

    let totalCreatedCount = 0;
    let totalSkippedCount = 0;
    let totalResults = 0;
    let allSearchQueries: string[] = [];

    // Iterate through each search query
    for (const searchQuery of searchQueries) {
        const linkedinQuery = `site:linkedin.com/in ${searchQuery}`;
        allSearchQueries.push(linkedinQuery);

        console.log(`🔎 Searching: ${linkedinQuery}`);

        try {
    // Call Google Custom Search API
    const googleData: any = await callGoogleCustomSearchAPI({
        key: GOOGLE_API_KEY,
        cx: GOOGLE_CSE_ID,
        q: linkedinQuery,
        start: ((page - 1) * perPage) + 1,
        num: perPage
    });

    const items = googleData.items || [];
            console.log(`  ✅ Found ${items.length} LinkedIn profiles for query: ${searchQuery}`);
            totalResults += parseInt(googleData.searchInformation?.totalResults || '0');

    // Queue leads to be saved by leads worker
    for (const item of items) {
        try {
            const linkedinUrl = item.link;

            // Extract name from title (usually "Name - Job Title - Company | LinkedIn")
            const titleParts = item.title.split('-');
            const name = titleParts[0]?.trim() || 'Unknown';
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Queue lead to be saved by leads worker
            await discoverQueue.add('save-lead', {
                type: 'save-lead',
                data: {
                    firstName,
                    lastName,
                    linkedinUrl,
                    source: 'google-linkedin',
                    status: 'new',
                    icpId: icpId,
                    enrichmentData: {
                        googleSearchData: item,
                        icpName: icp.name,
                        snippet: item.snippet,
                        searchQuery
                    }
                }
            });

                    totalCreatedCount++;
                } catch (error: any) {
                    console.error(`  Failed to queue LinkedIn lead:`, error.message);
                    totalSkippedCount++;
                }
            }
        } catch (error: any) {
            console.error(`  ❌ Failed to search query "${linkedinQuery}":`, error.message);
            totalSkippedCount++;
        }
    }

    console.log(`✅ Total: Queued ${totalCreatedCount} leads, skipped ${totalSkippedCount} across ${searchQueries.length} queries`);

    return {
        success: true,
        icpId,
        totalResults,
        returnedResults: totalCreatedCount,
        queuedLeads: totalCreatedCount,
        skippedLeads: totalSkippedCount,
        page,
        perPage,
        queriesExecuted: searchQueries.length,
        searchQueries: allSearchQueries
    };
}

// Process Google Places Search
async function processGooglePlacesSearch(data: {
    icpId: string;
    page?: number;
    perPage?: number;
}) {
    const { icpId, page = 1, perPage = 20 } = data;

    console.log(`🔍 Searching Google Places for businesses matching ICP ${icpId}...`);

    // Fetch the ICP profile from database
    const icp = await prisma.iCP.findUnique({
        where: { id: icpId }
    });

    if (!icp) {
        throw new Error(`ICP profile ${icpId} not found`);
    }

    // Build multiple search queries for places
    const searchQueries = convertICPToGoogleQueries(icp.criteria);
    console.log(`📋 Generated ${searchQueries.length} search queries`);

    let totalCreatedCount = 0;
    let totalSkippedCount = 0;
    let totalPlaces = 0;

    // Iterate through each search query
    for (const searchQuery of searchQueries) {
        console.log(`🔎 Searching: ${searchQuery}`);

        try {
    // Call Google Places Text Search API
    const googleData: any = await callGooglePlacesAPI({
        key: GOOGLE_API_KEY,
        query: searchQuery,
        type: 'establishment'
    });

    const places = googleData.results || [];
            console.log(`  ✅ Found ${places.length} places for query: ${searchQuery}`);
            totalPlaces += places.length;

    // Queue businesses to be saved by leads worker
    for (const place of places) {
        try {
            const company = place.name || 'Unknown Business';

            // Queue lead to be saved by leads worker
            await discoverQueue.add('save-lead', {
                type: 'save-lead',
                data: {
                    firstName: '',
                    lastName: '',
                    company: company,
                    position: 'Business Owner',
                    source: 'google-places',
                    status: 'new',
                    icpId: icpId,
                    enrichmentData: {
                        googlePlaceId: place.place_id,
                        googlePlaceData: place,
                        icpName: icp.name,
                        businessName: company,
                        address: place.formatted_address,
                        rating: place.rating,
                        userRatingsTotal: place.user_ratings_total,
                        types: place.types,
                        location: place.geometry?.location,
                        searchQuery
                    }
                }
            });

                    totalCreatedCount++;
                } catch (error: any) {
                    console.error(`  Failed to queue place ${place.name}:`, error.message);
                    totalSkippedCount++;
                }
            }
        } catch (error: any) {
            console.error(`  ❌ Failed to search query "${searchQuery}":`, error.message);
            totalSkippedCount++;
        }
    }

    console.log(`✅ Total: Queued ${totalCreatedCount} businesses, skipped ${totalSkippedCount} across ${searchQueries.length} queries`);

    return {
        success: true,
        icpId,
        totalResults: totalPlaces,
        returnedResults: totalPlaces,
        queuedLeads: totalCreatedCount,
        skippedLeads: totalSkippedCount,
        page,
        perPage,
        queriesExecuted: searchQueries.length,
        searchQueries
    };
}

// Create worker
export const googleWorker = new Worker(
    'googleSearch', // Queue name
    async (job) => {
        console.log(`🔄 Processing Google job ${job.id}...`);

        const { type, data } = job.data;
        try {
            switch (type) {
                case 'search-by-icp':
                    // Default to Google Places search for search-by-icp
                    return await processGooglePlacesSearch(data);

                case 'custom-linkedin-search':
                    return await processCustomLinkedInSearch(data);

                case 'google-places-search':
                    return await processGooglePlacesSearch(data);

                default:
                    throw new Error(`Unknown job type: ${type}`);
            }
        } catch (error) {
            console.error(`❌ Failed to process Google job ${job.id}:`, error);
            throw error;  // Job will retry
        }
    },
    {
        connection,
        concurrency: 2  // Process 2 jobs at once (Google has rate limits)
    }
);

// Event handlers
googleWorker.on('completed', (job) => {
    console.log(`✅ Google job ${job.id} completed`);
});

googleWorker.on('failed', (job, err) => {
    console.error(`❌ Google job ${job?.id} failed:`, err.message);
});

googleWorker.on('error', (err) => {
    console.error('Google worker error:', err);
});

console.log('👷 Google worker started');