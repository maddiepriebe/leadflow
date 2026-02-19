import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// TYPES
// ==========================================

export interface ScoringFactors {
  // Contact completeness (0-25 points)
  hasEmail: boolean;
  hasPhone: boolean;
  hasLinkedIn: boolean;
  hasCompany: boolean;
  hasPosition: boolean;

  // ICP match (0-30 points)
  matchesICP: boolean;
  icpMatchScore: number; // 0-1 how well they match

  // Data quality (0-25 points)
  sourceQuality: 'high' | 'medium' | 'low';
  hasEnrichmentData: boolean;
  enrichmentComplete: boolean;

  // Engagement signals (0-20 points)
  hasReplied: boolean;
  messageCount: number;
  recentActivity: boolean;
}

export interface ScoreBreakdown {
  [factor: string]: number;
}

export interface ScoringResult {
  score: number;
  breakdown: ScoreBreakdown;
  factors: ScoringFactors;
}

// ==========================================
// DEFAULT WEIGHTS
// ==========================================

export const DEFAULT_WEIGHTS: Record<string, number> = {
  // Contact completeness (max 25)
  hasEmail: 10,
  hasPhone: 8,
  hasLinkedIn: 4,
  hasCompany: 5,
  hasPosition: 3,

  // ICP match (max 30)
  matchesICP: 15,
  icpMatchBonus: 15, // Multiplied by match score (0-1)

  // Data quality (max 25)
  sourceHigh: 12,
  sourceMedium: 6,
  sourceLow: 2,
  hasEnrichmentData: 8,
  enrichmentComplete: 5,

  // Engagement signals (max 20)
  hasReplied: 15,
  messageCountBonus: 3, // Per message, capped
  recentActivity: 5,
};

// ==========================================
// GET ACTIVE WEIGHTS
// ==========================================

export async function getActiveWeights(): Promise<Record<string, number>> {
  const activeModel = await prisma.scoringModel.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });

  if (activeModel && activeModel.weights) {
    return activeModel.weights as Record<string, number>;
  }

  return DEFAULT_WEIGHTS;
}

// ==========================================
// GET ACTIVE MODEL
// ==========================================

export async function getActiveModel() {
  let model = await prisma.scoringModel.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });

  // Create default model if none exists
  if (!model) {
    model = await prisma.scoringModel.create({
      data: {
        version: 1,
        isActive: true,
        weights: DEFAULT_WEIGHTS,
        totalScored: 0,
        totalConverted: 0,
        avgConvertedScore: 0,
      },
    });
  }

  return model;
}

// ==========================================
// EXTRACT SCORING FACTORS
// ==========================================

export async function extractScoringFactors(leadId: string): Promise<ScoringFactors> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      icp: true,
      messages: {
        orderBy: { sentAt: 'desc' },
        take: 10,
      },
      conversions: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // Check for replies
  const hasReplied = lead.messages.some((m) => m.direction === 'inbound');
  const hasConversionReply = lead.conversions.some((c) => c.type === 'reply');

  // Recent activity (within last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentActivity =
    lead.messages.some((m) => new Date(m.sentAt) > thirtyDaysAgo) ||
    new Date(lead.updatedAt) > thirtyDaysAgo;

  // Determine source quality
  let sourceQuality: 'high' | 'medium' | 'low' = 'low';
  const highQualitySources = ['apollo', 'linkedin', 'clearbit', 'hunter', 'peopledatalabs'];
  const mediumQualitySources = ['manual', 'import', 'referral', 'website'];

  if (highQualitySources.includes(lead.source?.toLowerCase() || '')) {
    sourceQuality = 'high';
  } else if (mediumQualitySources.includes(lead.source?.toLowerCase() || '')) {
    sourceQuality = 'medium';
  }

  // Check enrichment data completeness
  const enrichmentData = lead.enrichmentData as Record<string, unknown> | null;
  const hasEnrichmentData = enrichmentData !== null && Object.keys(enrichmentData || {}).length > 0;
  const enrichmentFields = ['company', 'position', 'industry', 'companySize', 'location'];
  const filledEnrichmentFields = enrichmentFields.filter(
    (field) => enrichmentData && enrichmentData[field]
  );
  const enrichmentComplete = filledEnrichmentFields.length >= 3;

  // ICP matching
  let matchesICP = false;
  let icpMatchScore = 0;

  if (lead.icp && lead.icp.criteria) {
    matchesICP = true;
    const criteria = lead.icp.criteria as {
      jobTitles?: string[];
      industries?: string[];
      companySizes?: string[];
      locations?: string[];
    };

    let matchCount = 0;
    let totalCriteria = 0;

    if (criteria.jobTitles && criteria.jobTitles.length > 0) {
      totalCriteria++;
      if (
        lead.position &&
        criteria.jobTitles.some((t) => lead.position?.toLowerCase().includes(t.toLowerCase()))
      ) {
        matchCount++;
      }
    }

    if (criteria.industries && criteria.industries.length > 0) {
      totalCriteria++;
      const leadIndustry =
        (enrichmentData?.industry as string) || (enrichmentData?.sector as string) || '';
      if (criteria.industries.some((i) => leadIndustry.toLowerCase().includes(i.toLowerCase()))) {
        matchCount++;
      }
    }

    if (totalCriteria > 0) {
      icpMatchScore = matchCount / totalCriteria;
    } else {
      icpMatchScore = 0.5; // Default if no specific criteria
    }
  }

  return {
    hasEmail: !!lead.email,
    hasPhone: !!lead.phone,
    hasLinkedIn: !!lead.linkedinUrl,
    hasCompany: !!lead.company,
    hasPosition: !!lead.position,
    matchesICP,
    icpMatchScore,
    sourceQuality,
    hasEnrichmentData,
    enrichmentComplete,
    hasReplied: hasReplied || hasConversionReply,
    messageCount: lead.messages.length,
    recentActivity,
  };
}

// ==========================================
// CALCULATE LEAD SCORE
// ==========================================

export async function calculateLeadScore(leadId: string): Promise<ScoringResult> {
  const factors = await extractScoringFactors(leadId);
  const weights = await getActiveWeights();
  const breakdown: ScoreBreakdown = {};
  let totalScore = 0;

  // Contact completeness
  if (factors.hasEmail) {
    breakdown.hasEmail = weights.hasEmail || 0;
    totalScore += breakdown.hasEmail;
  }
  if (factors.hasPhone) {
    breakdown.hasPhone = weights.hasPhone || 0;
    totalScore += breakdown.hasPhone;
  }
  if (factors.hasLinkedIn) {
    breakdown.hasLinkedIn = weights.hasLinkedIn || 0;
    totalScore += breakdown.hasLinkedIn;
  }
  if (factors.hasCompany) {
    breakdown.hasCompany = weights.hasCompany || 0;
    totalScore += breakdown.hasCompany;
  }
  if (factors.hasPosition) {
    breakdown.hasPosition = weights.hasPosition || 0;
    totalScore += breakdown.hasPosition;
  }

  // ICP match
  if (factors.matchesICP) {
    breakdown.matchesICP = weights.matchesICP || 0;
    totalScore += breakdown.matchesICP;

    const icpBonus = Math.round((weights.icpMatchBonus || 0) * factors.icpMatchScore);
    if (icpBonus > 0) {
      breakdown.icpMatchBonus = icpBonus;
      totalScore += icpBonus;
    }
  }

  // Source quality
  if (factors.sourceQuality === 'high') {
    breakdown.sourceQuality = weights.sourceHigh || 0;
  } else if (factors.sourceQuality === 'medium') {
    breakdown.sourceQuality = weights.sourceMedium || 0;
  } else {
    breakdown.sourceQuality = weights.sourceLow || 0;
  }
  totalScore += breakdown.sourceQuality;

  // Enrichment data
  if (factors.hasEnrichmentData) {
    breakdown.hasEnrichmentData = weights.hasEnrichmentData || 0;
    totalScore += breakdown.hasEnrichmentData;
  }
  if (factors.enrichmentComplete) {
    breakdown.enrichmentComplete = weights.enrichmentComplete || 0;
    totalScore += breakdown.enrichmentComplete;
  }

  // Engagement signals
  if (factors.hasReplied) {
    breakdown.hasReplied = weights.hasReplied || 0;
    totalScore += breakdown.hasReplied;
  }

  // Message count bonus (capped at 3 messages)
  const messageBonus = Math.min(factors.messageCount, 3) * (weights.messageCountBonus || 0);
  if (messageBonus > 0) {
    breakdown.messageCountBonus = messageBonus;
    totalScore += messageBonus;
  }

  if (factors.recentActivity) {
    breakdown.recentActivity = weights.recentActivity || 0;
    totalScore += breakdown.recentActivity;
  }

  return {
    score: Math.round(totalScore),
    breakdown,
    factors,
  };
}

// ==========================================
// SCORE AND SAVE LEAD
// ==========================================

export async function scoreAndSaveLead(leadId: string): Promise<ScoringResult> {
  const result = await calculateLeadScore(leadId);
  const model = await getActiveModel();

  // Save score to lead
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      currentScore: result.score,
      lastScoredAt: new Date(),
    },
  });

  // Save score history
  await prisma.leadScore.create({
    data: {
      leadId,
      score: result.score,
      breakdown: result.breakdown,
      modelVersion: model.version,
    },
  });

  // Update model stats
  await prisma.scoringModel.update({
    where: { id: model.id },
    data: {
      totalScored: { increment: 1 },
    },
  });

  return result;
}

// ==========================================
// SCORE ALL LEADS
// ==========================================

export async function scoreAllLeads(): Promise<{
  scored: number;
  failed: number;
  errors: string[];
}> {
  const leads = await prisma.lead.findMany({
    select: { id: true },
  });

  let scored = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      await scoreAndSaveLead(lead.id);
      scored++;
    } catch (error) {
      failed++;
      errors.push(`Lead ${lead.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { scored, failed, errors };
}

// ==========================================
// GET TOP LEADS TO CONTACT
// ==========================================

export async function getTopLeadsToContact(
  limit: number = 50,
  options?: {
    minScore?: number;
    excludeStatuses?: string[];
    onlyUncontacted?: boolean;
  }
): Promise<
  {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company: string | null;
    currentScore: number | null;
    status: string;
    source: string;
    lastScoredAt: Date | null;
  }[]
> {
  const where: any = {};

  if (options?.minScore !== undefined) {
    where.currentScore = { gte: options.minScore };
  }

  if (options?.excludeStatuses && options.excludeStatuses.length > 0) {
    where.status = { notIn: options.excludeStatuses };
  }

  if (options?.onlyUncontacted) {
    where.messages = { none: {} };
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { currentScore: 'desc' },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      company: true,
      currentScore: true,
      status: true,
      source: true,
      lastScoredAt: true,
    },
  });

  return leads;
}

// ==========================================
// GET SCORE DISTRIBUTION
// ==========================================

export async function getScoreDistribution(): Promise<
  {
    range: string;
    count: number;
    percentage: number;
  }[]
> {
  const leads = await prisma.lead.findMany({
    where: { currentScore: { not: null } },
    select: { currentScore: true },
  });

  const ranges = [
    { label: '0-20', min: 0, max: 20 },
    { label: '21-40', min: 21, max: 40 },
    { label: '41-60', min: 41, max: 60 },
    { label: '61-80', min: 61, max: 80 },
    { label: '81-100', min: 81, max: 100 },
  ];

  const total = leads.length;
  const distribution = ranges.map((range) => {
    const count = leads.filter(
      (l) => l.currentScore !== null && l.currentScore >= range.min && l.currentScore <= range.max
    ).length;
    return {
      range: range.label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  return distribution;
}

// ==========================================
// GET LEAD SCORE HISTORY
// ==========================================

export async function getLeadScoreHistory(leadId: string) {
  return prisma.leadScore.findMany({
    where: { leadId },
    orderBy: { scoredAt: 'desc' },
    take: 10,
  });
}

export default {
  getActiveWeights,
  getActiveModel,
  extractScoringFactors,
  calculateLeadScore,
  scoreAndSaveLead,
  scoreAllLeads,
  getTopLeadsToContact,
  getScoreDistribution,
  getLeadScoreHistory,
  DEFAULT_WEIGHTS,
};
