import { PrismaClient } from '@prisma/client';
import { getConvertedLeadsData, getNonConvertedLeadsData } from './conversion.service';
import { DEFAULT_WEIGHTS, getActiveModel, scoreAllLeads } from './scoring.service';

const prisma = new PrismaClient();

// ==========================================
// TYPES
// ==========================================

export interface FactorAnalysis {
  factor: string;
  convertedAvg: number;
  nonConvertedAvg: number;
  lift: number; // How much more likely converted leads have this factor
  sampleSize: number;
}

export interface TrainingResult {
  success: boolean;
  oldVersion: number;
  newVersion: number;
  weightChanges: Record<string, { old: number; new: number; change: number }>;
  analysisData: FactorAnalysis[];
  leadsRescored: number;
}

export interface ModelPerformance {
  version: number;
  totalScored: number;
  totalConverted: number;
  conversionRate: number;
  avgConvertedScore: number;
  createdAt: Date;
}

// ==========================================
// ANALYZE CONVERSION PATTERNS
// ==========================================

export async function analyzeConversionPatterns(): Promise<FactorAnalysis[]> {
  const convertedData = await getConvertedLeadsData();
  const nonConvertedData = await getNonConvertedLeadsData(500);

  if (convertedData.length === 0) {
    console.log('No converted leads to analyze');
    return [];
  }

  // Get all unique factors from breakdowns
  const allFactors = new Set<string>();
  [...convertedData, ...nonConvertedData].forEach((item) => {
    if (item.scoreBreakdown) {
      Object.keys(item.scoreBreakdown).forEach((f) => allFactors.add(f));
    }
  });

  const analysis: FactorAnalysis[] = [];

  for (const factor of allFactors) {
    // Calculate presence/value of this factor in converted leads
    const convertedValues = convertedData
      .filter((d) => d.scoreBreakdown && d.scoreBreakdown[factor] !== undefined)
      .map((d) => d.scoreBreakdown![factor]);

    const convertedAvg =
      convertedValues.length > 0
        ? convertedValues.reduce((sum, v) => sum + v, 0) / convertedValues.length
        : 0;

    // Calculate presence/value of this factor in non-converted leads
    const nonConvertedValues = nonConvertedData
      .filter((d) => d.scoreBreakdown && d.scoreBreakdown[factor] !== undefined)
      .map((d) => d.scoreBreakdown![factor]);

    const nonConvertedAvg =
      nonConvertedValues.length > 0
        ? nonConvertedValues.reduce((sum, v) => sum + v, 0) / nonConvertedValues.length
        : 0;

    // Calculate lift (how much more prevalent in converted leads)
    let lift = 0;
    if (nonConvertedAvg > 0) {
      lift = (convertedAvg - nonConvertedAvg) / nonConvertedAvg;
    } else if (convertedAvg > 0) {
      lift = 1; // Factor only present in converted leads
    }

    analysis.push({
      factor,
      convertedAvg: Math.round(convertedAvg * 100) / 100,
      nonConvertedAvg: Math.round(nonConvertedAvg * 100) / 100,
      lift: Math.round(lift * 100) / 100,
      sampleSize: convertedValues.length + nonConvertedValues.length,
    });
  }

  // Sort by lift (highest lift = most predictive of conversion)
  return analysis.sort((a, b) => b.lift - a.lift);
}

// ==========================================
// GENERATE OPTIMIZED WEIGHTS
// ==========================================

export async function generateOptimizedWeights(): Promise<Record<string, number>> {
  const analysis = await analyzeConversionPatterns();
  const currentWeights = await prisma.scoringModel
    .findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    })
    .then((m) => (m?.weights as Record<string, number>) || DEFAULT_WEIGHTS);

  const newWeights = { ...currentWeights };

  // Adjustment parameters
  const MAX_ADJUSTMENT = 0.3; // Max 30% change per training cycle
  const MIN_WEIGHT = 1; // Don't let weights go below 1
  const MAX_WEIGHT = 30; // Don't let weights exceed 30

  for (const item of analysis) {
    const factor = item.factor;

    // Skip factors with insufficient data
    if (item.sampleSize < 10) continue;

    // Map breakdown factors to weight factors
    // Some breakdown factors map to multiple weight factors
    const weightFactors = mapBreakdownToWeightFactors(factor);

    for (const weightFactor of weightFactors) {
      if (!(weightFactor in newWeights)) continue;

      const currentWeight = newWeights[weightFactor];

      // Calculate adjustment based on lift
      // Positive lift = increase weight, negative lift = decrease weight
      let adjustment = 0;

      if (item.lift > 0.5) {
        // Strong positive predictor - increase weight
        adjustment = Math.min(item.lift * 0.2, MAX_ADJUSTMENT);
      } else if (item.lift > 0.1) {
        // Moderate positive predictor - small increase
        adjustment = Math.min(item.lift * 0.1, MAX_ADJUSTMENT / 2);
      } else if (item.lift < -0.3) {
        // Negative predictor - decrease weight
        adjustment = Math.max(item.lift * 0.2, -MAX_ADJUSTMENT);
      } else if (item.lift < -0.1) {
        // Slightly negative - small decrease
        adjustment = Math.max(item.lift * 0.1, -MAX_ADJUSTMENT / 2);
      }

      // Apply adjustment
      const newWeight = currentWeight * (1 + adjustment);
      newWeights[weightFactor] = Math.round(Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, newWeight)));
    }
  }

  return newWeights;
}

// ==========================================
// MAP BREAKDOWN FACTORS TO WEIGHT FACTORS
// ==========================================

function mapBreakdownToWeightFactors(breakdownFactor: string): string[] {
  const mapping: Record<string, string[]> = {
    hasEmail: ['hasEmail'],
    hasPhone: ['hasPhone'],
    hasLinkedIn: ['hasLinkedIn'],
    hasCompany: ['hasCompany'],
    hasPosition: ['hasPosition'],
    matchesICP: ['matchesICP'],
    icpMatchBonus: ['icpMatchBonus'],
    sourceQuality: ['sourceHigh', 'sourceMedium', 'sourceLow'],
    hasEnrichmentData: ['hasEnrichmentData'],
    enrichmentComplete: ['enrichmentComplete'],
    hasReplied: ['hasReplied'],
    messageCountBonus: ['messageCountBonus'],
    recentActivity: ['recentActivity'],
  };

  return mapping[breakdownFactor] || [breakdownFactor];
}

// ==========================================
// TRAIN NEW MODEL
// ==========================================

export async function trainNewModel(): Promise<TrainingResult> {
  console.log('\n🧠 Starting model training...\n');

  // Get current model
  const currentModel = await getActiveModel();
  const currentWeights = currentModel.weights as Record<string, number>;

  // Analyze patterns
  console.log('📊 Analyzing conversion patterns...');
  const analysis = await analyzeConversionPatterns();

  if (analysis.length === 0) {
    console.log('⚠️ Not enough data to train model');
    return {
      success: false,
      oldVersion: currentModel.version,
      newVersion: currentModel.version,
      weightChanges: {},
      analysisData: [],
      leadsRescored: 0,
    };
  }

  // Generate new weights
  console.log('⚙️ Generating optimized weights...');
  const newWeights = await generateOptimizedWeights();

  // Calculate weight changes
  const weightChanges: Record<string, { old: number; new: number; change: number }> = {};
  const allKeys = new Set([...Object.keys(currentWeights), ...Object.keys(newWeights)]);

  for (const key of allKeys) {
    const oldVal = currentWeights[key] || 0;
    const newVal = newWeights[key] || 0;
    if (oldVal !== newVal) {
      weightChanges[key] = {
        old: oldVal,
        new: newVal,
        change: Math.round(((newVal - oldVal) / (oldVal || 1)) * 100),
      };
    }
  }

  // Check if there are significant changes
  const hasSignificantChanges = Object.values(weightChanges).some(
    (c) => Math.abs(c.change) > 5
  );

  if (!hasSignificantChanges) {
    console.log('✅ No significant changes needed, keeping current model');
    return {
      success: true,
      oldVersion: currentModel.version,
      newVersion: currentModel.version,
      weightChanges: {},
      analysisData: analysis,
      leadsRescored: 0,
    };
  }

  // Deactivate current model
  await prisma.scoringModel.update({
    where: { id: currentModel.id },
    data: { isActive: false },
  });

  // Create new model
  const newModel = await prisma.scoringModel.create({
    data: {
      version: currentModel.version + 1,
      isActive: true,
      weights: newWeights,
      totalScored: 0,
      totalConverted: 0,
      avgConvertedScore: 0,
    },
  });

  console.log(`📈 Created new model version ${newModel.version}`);

  // Re-score all leads with new model
  console.log('🔄 Re-scoring all leads...');
  const rescoreResult = await scoreAllLeads();

  console.log(`✅ Model training complete!`);
  console.log(`   - Scored: ${rescoreResult.scored} leads`);
  console.log(`   - Failed: ${rescoreResult.failed} leads`);
  console.log(`   - Weight changes: ${Object.keys(weightChanges).length}`);

  return {
    success: true,
    oldVersion: currentModel.version,
    newVersion: newModel.version,
    weightChanges,
    analysisData: analysis,
    leadsRescored: rescoreResult.scored,
  };
}

// ==========================================
// COMPARE MODEL PERFORMANCE
// ==========================================

export async function compareModelPerformance(): Promise<ModelPerformance[]> {
  const models = await prisma.scoringModel.findMany({
    orderBy: { version: 'desc' },
    take: 5,
  });

  return models.map((m) => ({
    version: m.version,
    totalScored: m.totalScored,
    totalConverted: m.totalConverted,
    conversionRate: m.totalScored > 0 ? Math.round((m.totalConverted / m.totalScored) * 100) : 0,
    avgConvertedScore: Math.round(m.avgConvertedScore * 100) / 100,
    createdAt: m.createdAt,
  }));
}

// ==========================================
// CHECK IF RETRAINING NEEDED
// ==========================================

export async function shouldRetrain(): Promise<{
  shouldRetrain: boolean;
  reason: string;
}> {
  const model = await getActiveModel();

  // Check 1: Has enough conversions since last training
  const MIN_CONVERSIONS_FOR_RETRAIN = 20;
  if (model.totalConverted >= MIN_CONVERSIONS_FOR_RETRAIN) {
    return {
      shouldRetrain: true,
      reason: `Reached ${model.totalConverted} conversions (threshold: ${MIN_CONVERSIONS_FOR_RETRAIN})`,
    };
  }

  // Check 2: Model is older than 7 days
  const modelAge = Date.now() - model.createdAt.getTime();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  if (modelAge > SEVEN_DAYS && model.totalConverted >= 5) {
    return {
      shouldRetrain: true,
      reason: `Model is ${Math.round(modelAge / (24 * 60 * 60 * 1000))} days old with ${model.totalConverted} conversions`,
    };
  }

  return {
    shouldRetrain: false,
    reason: `Not enough data yet (${model.totalConverted} conversions, need ${MIN_CONVERSIONS_FOR_RETRAIN})`,
  };
}

// ==========================================
// GET TRAINING STATUS
// ==========================================

export async function getTrainingStatus() {
  const model = await getActiveModel();
  const retrainCheck = await shouldRetrain();
  const recentAnalysis = await analyzeConversionPatterns();

  return {
    currentModel: {
      version: model.version,
      isActive: model.isActive,
      totalScored: model.totalScored,
      totalConverted: model.totalConverted,
      avgConvertedScore: Math.round(model.avgConvertedScore * 100) / 100,
      weights: model.weights,
      createdAt: model.createdAt,
    },
    retraining: retrainCheck,
    topPredictiveFactors: recentAnalysis.slice(0, 5),
    bottomPredictiveFactors: recentAnalysis.slice(-5).reverse(),
  };
}

export default {
  analyzeConversionPatterns,
  generateOptimizedWeights,
  trainNewModel,
  compareModelPerformance,
  shouldRetrain,
  getTrainingStatus,
};
