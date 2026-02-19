import { Router } from 'express';
import {
  getActiveModel,
  getActiveWeights,
  calculateLeadScore,
  scoreAndSaveLead,
  getTopLeadsToContact,
  getScoreDistribution,
  getLeadScoreHistory,
} from '../services/scoring.service';
import {
  getConversionsByScoreRange,
  getConversionStats,
  getLeadConversions,
} from '../services/conversion.service';
import {
  analyzeConversionPatterns,
  trainNewModel,
  compareModelPerformance,
  getTrainingStatus,
} from '../services/model-trainer.service';
import {
  queueScoreLead,
  queueScoreAllLeads,
  queueTrainModel,
} from '../workers/scoring.worker';

const router = Router();

// ==========================================
// GET TOP LEADS TO CONTACT - GET /api/scoring/top-leads
// ==========================================

router.get('/top-leads', async (req, res) => {
  try {
    const { limit = '50', minScore, excludeStatuses, uncontacted } = req.query;

    const options: {
      minScore?: number;
      excludeStatuses?: string[];
      onlyUncontacted?: boolean;
    } = {};

    if (minScore) {
      options.minScore = parseInt(minScore as string);
    }

    if (excludeStatuses) {
      options.excludeStatuses = (excludeStatuses as string).split(',');
    }

    if (uncontacted === 'true') {
      options.onlyUncontacted = true;
    }

    const leads = await getTopLeadsToContact(parseInt(limit as string), options);

    res.json({
      leads,
      total: leads.length,
      filters: options,
    });
  } catch (error) {
    console.error('Error fetching top leads:', error);
    res.status(500).json({ error: 'Failed to fetch top leads' });
  }
});

// ==========================================
// GET LEAD SCORE - GET /api/scoring/lead/:id
// ==========================================

router.get('/lead/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [scoreResult, history, conversions] = await Promise.all([
      calculateLeadScore(id),
      getLeadScoreHistory(id),
      getLeadConversions(id),
    ]);

    res.json({
      currentScore: scoreResult.score,
      breakdown: scoreResult.breakdown,
      factors: scoreResult.factors,
      history,
      conversions,
    });
  } catch (error) {
    console.error('Error fetching lead score:', error);
    res.status(500).json({ error: 'Failed to fetch lead score' });
  }
});

// ==========================================
// SCORE SINGLE LEAD - POST /api/scoring/lead/:id/score
// ==========================================

router.post('/lead/:id/score', async (req, res) => {
  try {
    const { id } = req.params;
    const { async: useAsync } = req.query;

    if (useAsync === 'true') {
      // Queue for background processing
      await queueScoreLead(id);
      res.json({ message: 'Lead scoring queued', leadId: id });
    } else {
      // Score immediately
      const result = await scoreAndSaveLead(id);
      res.json({
        leadId: id,
        score: result.score,
        breakdown: result.breakdown,
      });
    }
  } catch (error) {
    console.error('Error scoring lead:', error);
    res.status(500).json({ error: 'Failed to score lead' });
  }
});

// ==========================================
// RESCORE ALL LEADS - POST /api/scoring/rescore
// ==========================================

router.post('/rescore', async (req, res) => {
  try {
    const { async: useAsync = 'true' } = req.query;

    if (useAsync === 'true') {
      await queueScoreAllLeads();
      res.json({ message: 'Lead rescoring queued' });
    } else {
      // This could take a while for large datasets
      const result = await import('../services/scoring.service').then((m) =>
        m.scoreAllLeads()
      );
      res.json({
        message: 'Rescoring complete',
        scored: result.scored,
        failed: result.failed,
      });
    }
  } catch (error) {
    console.error('Error rescoring leads:', error);
    res.status(500).json({ error: 'Failed to rescore leads' });
  }
});

// ==========================================
// GET CURRENT MODEL - GET /api/scoring/model
// ==========================================

router.get('/model', async (_req, res) => {
  try {
    const model = await getActiveModel();
    const weights = await getActiveWeights();

    res.json({
      id: model.id,
      version: model.version,
      isActive: model.isActive,
      weights,
      stats: {
        totalScored: model.totalScored,
        totalConverted: model.totalConverted,
        avgConvertedScore: Math.round(model.avgConvertedScore * 100) / 100,
        conversionRate:
          model.totalScored > 0
            ? Math.round((model.totalConverted / model.totalScored) * 100)
            : 0,
      },
      createdAt: model.createdAt,
    });
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

// ==========================================
// TRAIN NEW MODEL - POST /api/scoring/model/train
// ==========================================

router.post('/model/train', async (req, res) => {
  try {
    const { force = false, async: useAsync = 'true' } = req.query;

    if (useAsync === 'true') {
      await queueTrainModel(force === 'true');
      res.json({ message: 'Model training queued' });
    } else {
      const result = await trainNewModel();
      res.json({
        message: result.success ? 'Training complete' : 'Training skipped',
        ...result,
      });
    }
  } catch (error) {
    console.error('Error training model:', error);
    res.status(500).json({ error: 'Failed to train model' });
  }
});

// ==========================================
// GET MODEL HISTORY - GET /api/scoring/model/history
// ==========================================

router.get('/model/history', async (_req, res) => {
  try {
    const history = await compareModelPerformance();
    res.json(history);
  } catch (error) {
    console.error('Error fetching model history:', error);
    res.status(500).json({ error: 'Failed to fetch model history' });
  }
});

// ==========================================
// GET TRAINING STATUS - GET /api/scoring/model/status
// ==========================================

router.get('/model/status', async (_req, res) => {
  try {
    const status = await getTrainingStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching training status:', error);
    res.status(500).json({ error: 'Failed to fetch training status' });
  }
});

// ==========================================
// GET ANALYTICS - GET /api/scoring/analytics
// ==========================================

router.get('/analytics', async (_req, res) => {
  try {
    const [distribution, conversionsByScore, conversionStats, factorAnalysis] =
      await Promise.all([
        getScoreDistribution(),
        getConversionsByScoreRange(),
        getConversionStats(),
        analyzeConversionPatterns(),
      ]);

    res.json({
      scoreDistribution: distribution,
      conversionsByScoreRange: conversionsByScore,
      conversionStats,
      factorAnalysis: factorAnalysis.slice(0, 10), // Top 10 factors
    });
  } catch (error) {
    console.error('Error fetching scoring analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ==========================================
// GET SCORE DISTRIBUTION - GET /api/scoring/distribution
// ==========================================

router.get('/distribution', async (_req, res) => {
  try {
    const distribution = await getScoreDistribution();
    res.json(distribution);
  } catch (error) {
    console.error('Error fetching score distribution:', error);
    res.status(500).json({ error: 'Failed to fetch distribution' });
  }
});

// ==========================================
// GET CONVERSIONS BY SCORE - GET /api/scoring/conversions
// ==========================================

router.get('/conversions', async (_req, res) => {
  try {
    const conversions = await getConversionsByScoreRange();
    res.json(conversions);
  } catch (error) {
    console.error('Error fetching conversions:', error);
    res.status(500).json({ error: 'Failed to fetch conversions' });
  }
});

export default router;
