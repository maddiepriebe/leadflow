import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// TYPES
// ==========================================

export type ConversionType = 'reply' | 'qualified' | 'converted' | 'meeting_booked' | 'clicked' | 'opened';

export interface ConversionData {
  leadId: string;
  type: ConversionType;
  channel?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversionStats {
  totalConversions: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
  conversionRate: number;
}

// ==========================================
// TRACK CONVERSION
// ==========================================

export async function trackConversion(data: ConversionData): Promise<void> {
  const { leadId, type, channel, metadata } = data;

  // Verify lead exists
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    console.error(`Cannot track conversion: Lead not found: ${leadId}`);
    return;
  }

  // Check for duplicate recent conversion (within 1 hour)
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const existingConversion = await prisma.conversionEvent.findFirst({
    where: {
      leadId,
      type,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (existingConversion) {
    console.log(`Duplicate conversion ignored for lead ${leadId}, type: ${type}`);
    return;
  }

  // Create conversion event
  await prisma.conversionEvent.create({
    data: {
      leadId,
      type,
      channel,
      metadata: metadata || {},
    },
  });

  console.log(`✅ Conversion tracked: ${type} for lead ${leadId}`);

  // Update scoring model stats if this is a significant conversion
  if (['reply', 'qualified', 'converted'].includes(type)) {
    await updateModelConversionStats(leadId);
  }
}

// ==========================================
// UPDATE MODEL CONVERSION STATS
// ==========================================

async function updateModelConversionStats(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { currentScore: true },
  });

  if (!lead || lead.currentScore === null) return;

  const activeModel = await prisma.scoringModel.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });

  if (!activeModel) return;

  // Calculate new average converted score
  const newTotalConverted = activeModel.totalConverted + 1;
  const newAvgScore =
    (activeModel.avgConvertedScore * activeModel.totalConverted + lead.currentScore) /
    newTotalConverted;

  await prisma.scoringModel.update({
    where: { id: activeModel.id },
    data: {
      totalConverted: newTotalConverted,
      avgConvertedScore: newAvgScore,
    },
  });
}

// ==========================================
// GET CONVERSIONS BY SCORE RANGE
// ==========================================

export async function getConversionsByScoreRange(): Promise<
  {
    range: string;
    min: number;
    max: number;
    totalLeads: number;
    conversions: number;
    rate: number;
  }[]
> {
  const ranges = [
    { label: '0-20', min: 0, max: 20 },
    { label: '21-40', min: 21, max: 40 },
    { label: '41-60', min: 41, max: 60 },
    { label: '61-80', min: 61, max: 80 },
    { label: '81-100', min: 81, max: 100 },
  ];

  const results = [];

  for (const range of ranges) {
    // Count leads in this score range
    const leadsInRange = await prisma.lead.count({
      where: {
        currentScore: {
          gte: range.min,
          lte: range.max,
        },
      },
    });

    // Count leads with conversions in this range
    const leadsWithConversions = await prisma.lead.count({
      where: {
        currentScore: {
          gte: range.min,
          lte: range.max,
        },
        conversions: {
          some: {
            type: { in: ['reply', 'qualified', 'converted'] },
          },
        },
      },
    });

    results.push({
      range: range.label,
      min: range.min,
      max: range.max,
      totalLeads: leadsInRange,
      conversions: leadsWithConversions,
      rate: leadsInRange > 0 ? Math.round((leadsWithConversions / leadsInRange) * 100) : 0,
    });
  }

  return results;
}

// ==========================================
// GET LEAD CONVERSIONS
// ==========================================

export async function getLeadConversions(leadId: string) {
  return prisma.conversionEvent.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
  });
}

// ==========================================
// GET CONVERSION STATS
// ==========================================

export async function getConversionStats(): Promise<ConversionStats> {
  const totalLeads = await prisma.lead.count();
  const leadsWithConversions = await prisma.lead.count({
    where: {
      conversions: {
        some: {},
      },
    },
  });

  // Count by type
  const typeResults = await prisma.$queryRaw<{ type: string; count: bigint }[]>`
    SELECT type, COUNT(*) as count
    FROM "ConversionEvent"
    GROUP BY type
    ORDER BY count DESC
  `;

  const byType: Record<string, number> = {};
  for (const row of typeResults) {
    byType[row.type] = Number(row.count);
  }

  // Count by channel
  const channelResults = await prisma.$queryRaw<{ channel: string; count: bigint }[]>`
    SELECT channel, COUNT(*) as count
    FROM "ConversionEvent"
    WHERE channel IS NOT NULL
    GROUP BY channel
    ORDER BY count DESC
  `;

  const byChannel: Record<string, number> = {};
  for (const row of channelResults) {
    byChannel[row.channel] = Number(row.count);
  }

  const totalConversions = Object.values(byType).reduce((sum, count) => sum + count, 0);

  return {
    totalConversions,
    byType,
    byChannel,
    conversionRate: totalLeads > 0 ? Math.round((leadsWithConversions / totalLeads) * 100) : 0,
  };
}

// ==========================================
// GET CONVERTED LEADS DATA (for analysis)
// ==========================================

export async function getConvertedLeadsData(): Promise<
  {
    leadId: string;
    score: number | null;
    scoreBreakdown: Record<string, number> | null;
    conversionType: string;
    conversionDate: Date;
  }[]
> {
  const conversions = await prisma.conversionEvent.findMany({
    where: {
      type: { in: ['reply', 'qualified', 'converted'] },
    },
    include: {
      lead: {
        select: {
          id: true,
          currentScore: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get score breakdowns for these leads
  const leadIds = [...new Set(conversions.map((c) => c.leadId))];
  const scoreHistory = await prisma.leadScore.findMany({
    where: {
      leadId: { in: leadIds },
    },
    orderBy: { scoredAt: 'desc' },
    distinct: ['leadId'],
  });

  const scoreMap = new Map(scoreHistory.map((s) => [s.leadId, s.breakdown as Record<string, number>]));

  return conversions.map((c) => ({
    leadId: c.leadId,
    score: c.lead.currentScore,
    scoreBreakdown: scoreMap.get(c.leadId) || null,
    conversionType: c.type,
    conversionDate: c.createdAt,
  }));
}

// ==========================================
// GET NON-CONVERTED LEADS DATA (for comparison)
// ==========================================

export async function getNonConvertedLeadsData(limit: number = 500): Promise<
  {
    leadId: string;
    score: number | null;
    scoreBreakdown: Record<string, number> | null;
  }[]
> {
  const leads = await prisma.lead.findMany({
    where: {
      conversions: { none: {} },
      currentScore: { not: null },
    },
    select: {
      id: true,
      currentScore: true,
    },
    take: limit,
  });

  const leadIds = leads.map((l) => l.id);
  const scoreHistory = await prisma.leadScore.findMany({
    where: {
      leadId: { in: leadIds },
    },
    orderBy: { scoredAt: 'desc' },
    distinct: ['leadId'],
  });

  const scoreMap = new Map(scoreHistory.map((s) => [s.leadId, s.breakdown as Record<string, number>]));

  return leads.map((l) => ({
    leadId: l.id,
    score: l.currentScore,
    scoreBreakdown: scoreMap.get(l.id) || null,
  }));
}

export default {
  trackConversion,
  getConversionsByScoreRange,
  getLeadConversions,
  getConversionStats,
  getConvertedLeadsData,
  getNonConvertedLeadsData,
};
