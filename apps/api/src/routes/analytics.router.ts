import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/analytics/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Run multiple queries in parallel
    const [totalLeads, qualifiedLeads, totalMessages] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'qualified' } }),
      prisma.message.count()
    ]);

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 
      ? (qualifiedLeads / totalLeads) * 100 
      : 0;

    res.json({
      totalLeads,
      qualifiedLeads,
      totalMessages,
      conversionRate
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;