import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ==========================================
// GET DASHBOARD STATS - GET /api/analytics/dashboard
// ==========================================

router.get('/dashboard', async (_req, res) => {
  try {
    // Run multiple queries in parallel
    const [totalLeads, qualifiedLeads, totalMessages] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'qualified' } }),
      prisma.message.count(),
    ]);

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;

    res.json({
      totalLeads,
      qualifiedLeads,
      totalMessages,
      conversionRate,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ==========================================
// GET SEQUENCE STATS - GET /api/analytics/sequences
// ==========================================

router.get('/sequences', async (_req, res) => {
  try {
    // Use raw queries to avoid Prisma client type issues
    const sequenceCounts = await prisma.$queryRaw<{ total: bigint; active: bigint }[]>`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active
      FROM "Sequence"
    `;

    const enrollmentCounts = await prisma.$queryRaw<{ total: bigint; completed: bigint }[]>`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM "SequenceEnrollment"
    `;

    const seqStats = sequenceCounts[0] || { total: 0n, active: 0n };
    const enrollStats = enrollmentCounts[0] || { total: 0n, completed: 0n };

    res.json({
      totalSequences: Number(seqStats.total),
      activeSequences: Number(seqStats.active),
      totalEnrollments: Number(enrollStats.total),
      completedEnrollments: Number(enrollStats.completed),
    });
  } catch (error) {
    console.error('Error fetching sequence stats:', error);
    res.status(500).json({ error: 'Failed to fetch sequence stats' });
  }
});

// ==========================================
// GET LEADS BY STATUS - GET /api/analytics/leads-by-status
// ==========================================

router.get('/leads-by-status', async (_req, res) => {
  try {
    const statusCounts = await prisma.$queryRaw<{ status: string; count: bigint }[]>`
      SELECT status, COUNT(*) as count
      FROM "Lead"
      GROUP BY status
      ORDER BY count DESC
    `;

    const result = statusCounts.map((item) => ({
      status: item.status,
      count: Number(item.count),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching leads by status:', error);
    res.status(500).json({ error: 'Failed to fetch leads by status' });
  }
});

// ==========================================
// GET LEADS OVER TIME - GET /api/analytics/leads-timeline
// ==========================================

router.get('/leads-timeline', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get leads created in the time period
    const leads = await prisma.lead.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by date
    const dateMap = new Map<string, number>();
    leads.forEach((lead) => {
      const dateStr = lead.createdAt.toISOString().split('T')[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    });

    // Convert to array
    const result = Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching leads timeline:', error);
    res.status(500).json({ error: 'Failed to fetch leads timeline' });
  }
});

// ==========================================
// GET MESSAGE STATS OVER TIME - GET /api/analytics/messages-timeline
// ==========================================

router.get('/messages-timeline', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get messages in the time period
    const messages = await prisma.message.findMany({
      where: {
        sentAt: {
          gte: startDate,
        },
      },
      select: {
        sentAt: true,
        direction: true,
      },
      orderBy: {
        sentAt: 'asc',
      },
    });

    // Group by date and direction
    const dateMap = new Map<string, { inbound: number; outbound: number }>();
    messages.forEach((msg) => {
      const dateStr = msg.sentAt.toISOString().split('T')[0];
      const current = dateMap.get(dateStr) || { inbound: 0, outbound: 0 };
      if (msg.direction === 'inbound') {
        current.inbound++;
      } else {
        current.outbound++;
      }
      dateMap.set(dateStr, current);
    });

    // Convert to array
    const result = Array.from(dateMap.entries()).map(([date, counts]) => ({
      date,
      inbound: counts.inbound,
      outbound: counts.outbound,
      total: counts.inbound + counts.outbound,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching messages timeline:', error);
    res.status(500).json({ error: 'Failed to fetch messages timeline' });
  }
});

// ==========================================
// GET TOP PERFORMING SEQUENCES - GET /api/analytics/top-sequences
// ==========================================

router.get('/top-sequences', async (_req, res) => {
  try {
    // Get sequences with their enrollment counts using raw query
    const sequences = await prisma.$queryRaw<
      {
        id: string;
        name: string;
        status: string;
        total_enrollments: bigint;
        completed_enrollments: bigint;
      }[]
    >`
      SELECT
        s.id,
        s.name,
        s.status,
        COUNT(e.id) as total_enrollments,
        COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as completed_enrollments
      FROM "Sequence" s
      LEFT JOIN "SequenceEnrollment" e ON s.id = e."sequenceId"
      GROUP BY s.id, s.name, s.status
      ORDER BY total_enrollments DESC
      LIMIT 5
    `;

    const result = sequences.map((seq) => {
      const total = Number(seq.total_enrollments);
      const completed = Number(seq.completed_enrollments);
      return {
        id: seq.id,
        name: seq.name,
        status: seq.status,
        totalEnrollments: total,
        completedEnrollments: completed,
        completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0',
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching top sequences:', error);
    res.status(500).json({ error: 'Failed to fetch top sequences' });
  }
});

// ==========================================
// GET LEADS BY SOURCE - GET /api/analytics/leads-by-source
// ==========================================

router.get('/leads-by-source', async (_req, res) => {
  try {
    const sourceCounts = await prisma.$queryRaw<{ source: string; count: bigint }[]>`
      SELECT source, COUNT(*) as count
      FROM "Lead"
      GROUP BY source
      ORDER BY count DESC
    `;

    const result = sourceCounts.map((item) => ({
      source: item.source,
      count: Number(item.count),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching leads by source:', error);
    res.status(500).json({ error: 'Failed to fetch leads by source' });
  }
});

export default router;
