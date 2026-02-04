import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sequenceQueue } from '../queues/index';

const router = Router();
const prisma = new PrismaClient();

// ==========================================
// GET ALL SEQUENCES - GET /api/sequences
// ==========================================

router.get('/', async (req, res) => {
  try {
    const sequences = await prisma.sequence.findMany({
      include: {
        campaign: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include enrollment count
    const sequencesWithStats = sequences.map((seq) => ({
      ...seq,
      enrollmentCount: seq._count.enrollments,
      _count: undefined,
    }));

    res.json(sequencesWithStats);
  } catch (error) {
    console.error('Error fetching sequences:', error);
    res.status(500).json({ error: 'Failed to fetch sequences' });
  }
});

// ==========================================
// GET SINGLE SEQUENCE - GET /api/sequences/:id
// ==========================================

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const sequence = await prisma.sequence.findUnique({
      where: { id },
      include: {
        campaign: true,
        enrollments: {
          include: {
            lead: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                company: true,
              },
            },
          },
          orderBy: { enrolledAt: 'desc' },
          take: 50,
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    res.json({
      ...sequence,
      enrollmentCount: sequence._count.enrollments,
      _count: undefined,
    });
  } catch (error) {
    console.error('Error fetching sequence:', error);
    res.status(500).json({ error: 'Failed to fetch sequence' });
  }
});

// ==========================================
// CREATE SEQUENCE - POST /api/sequences
// ==========================================

router.post('/', async (req, res) => {
  try {
    const { name, description, steps, prompt, campaignId, status } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Sequence name is required' });
      return;
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ error: 'At least one step is required' });
      return;
    }

    // Validate steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.type || !['email', 'whatsapp', 'dms', 'wait'].includes(step.type)) {
        res.status(400).json({
          error: `Invalid step type at index ${i}. Must be email, whatsapp, dms, or wait`,
        });
        return;
      }
      if (step.type !== 'wait' && !step.content) {
        res.status(400).json({ error: `Step ${i + 1} requires content` });
        return;
      }
    }

    // Add IDs and order to steps if not present
    const processedSteps = steps.map((step: any, index: number) => ({
      id: step.id || `step_${Date.now()}_${index}`,
      order: index,
      type: step.type,
      content: step.content || '',
      delayDays: step.delayDays,
      delayHours: step.delayHours,
    }));

    const sequence = await prisma.sequence.create({
      data: {
        name,
        description,
        steps: processedSteps,
        prompt,
        campaignId: campaignId || null,
        status: status || 'draft',
      },
      include: {
        campaign: true,
      },
    });

    console.log(`✅ Sequence created: ${sequence.name}`);
    res.status(201).json(sequence);
  } catch (error) {
    console.error('Error creating sequence:', error);
    res.status(500).json({ error: 'Failed to create sequence' });
  }
});

// ==========================================
// UPDATE SEQUENCE - PUT /api/sequences/:id
// ==========================================

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, steps, prompt, campaignId, status } = req.body;

    // Check if sequence exists
    const existing = await prisma.sequence.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    // Build update data
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (campaignId !== undefined) updateData.campaignId = campaignId || null;
    if (status !== undefined) updateData.status = status;

    if (steps !== undefined) {
      // Validate and process steps
      if (!Array.isArray(steps) || steps.length === 0) {
        res.status(400).json({ error: 'At least one step is required' });
        return;
      }

      const processedSteps = steps.map((step: any, index: number) => ({
        id: step.id || `step_${Date.now()}_${index}`,
        order: index,
        type: step.type,
        content: step.content || '',
        delayDays: step.delayDays,
        delayHours: step.delayHours,
      }));

      updateData.steps = processedSteps;
    }

    const sequence = await prisma.sequence.update({
      where: { id },
      data: updateData,
      include: {
        campaign: true,
      },
    });

    console.log(`✅ Sequence updated: ${sequence.name}`);
    res.json(sequence);
  } catch (error) {
    console.error('Error updating sequence:', error);
    res.status(500).json({ error: 'Failed to update sequence' });
  }
});

// ==========================================
// DELETE SEQUENCE - DELETE /api/sequences/:id
// ==========================================

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if sequence exists
    const existing = await prisma.sequence.findUnique({
      where: { id },
      include: {
        _count: { select: { enrollments: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    // Warn if there are active enrollments
    if (existing._count.enrollments > 0) {
      console.log(`⚠️ Deleting sequence with ${existing._count.enrollments} enrollments`);
    }

    // Delete sequence (cascades to enrollments)
    await prisma.sequence.delete({ where: { id } });

    console.log(`✅ Sequence deleted: ${existing.name}`);
    res.json({ message: 'Sequence deleted successfully' });
  } catch (error) {
    console.error('Error deleting sequence:', error);
    res.status(500).json({ error: 'Failed to delete sequence' });
  }
});

// ==========================================
// ACTIVATE SEQUENCE - POST /api/sequences/:id/activate
// ==========================================

router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    const sequence = await prisma.sequence.update({
      where: { id },
      data: { status: 'active' },
    });

    console.log(`✅ Sequence activated: ${sequence.name}`);
    res.json({ message: 'Sequence activated', sequence });
  } catch (error) {
    console.error('Error activating sequence:', error);
    res.status(500).json({ error: 'Failed to activate sequence' });
  }
});

// ==========================================
// PAUSE SEQUENCE - POST /api/sequences/:id/pause
// ==========================================

router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    const sequence = await prisma.sequence.update({
      where: { id },
      data: { status: 'paused' },
    });

    // Also pause all active enrollments
    await prisma.sequenceEnrollment.updateMany({
      where: { sequenceId: id, status: 'active' },
      data: { status: 'paused', pausedAt: new Date() },
    });

    console.log(`✅ Sequence paused: ${sequence.name}`);
    res.json({ message: 'Sequence paused', sequence });
  } catch (error) {
    console.error('Error pausing sequence:', error);
    res.status(500).json({ error: 'Failed to pause sequence' });
  }
});

// ==========================================
// ENROLL LEAD - POST /api/sequences/:id/enroll
// ==========================================

router.post('/:id/enroll', async (req, res) => {
  try {
    const { id } = req.params;
    const { leadId, leadIds } = req.body;

    // Check if sequence exists and is active
    const sequence = await prisma.sequence.findUnique({ where: { id } });

    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    if (sequence.status !== 'active') {
      res.status(400).json({ error: `Sequence is ${sequence.status}, must be active to enroll leads` });
      return;
    }

    // Single lead enrollment
    if (leadId) {
      const job = await sequenceQueue.add('enroll-lead', {
        type: 'enroll-lead',
        data: { sequenceId: id, leadId },
      });

      res.json({
        message: 'Lead enrollment queued',
        jobId: job.id,
      });
      return;
    }

    // Bulk enrollment
    if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
      const job = await sequenceQueue.add('enroll-leads-bulk', {
        type: 'enroll-leads-bulk',
        data: { sequenceId: id, leadIds },
      });

      res.json({
        message: `${leadIds.length} leads enrollment queued`,
        jobId: job.id,
      });
      return;
    }

    res.status(400).json({ error: 'leadId or leadIds required' });
  } catch (error) {
    console.error('Error enrolling lead:', error);
    res.status(500).json({ error: 'Failed to enroll lead' });
  }
});

// ==========================================
// GET ENROLLMENTS - GET /api/sequences/:id/enrollments
// ==========================================

router.get('/:id/enrollments', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit = '50', offset = '0' } = req.query;

    const where: any = { sequenceId: id };
    if (status) where.status = status;

    const enrollments = await prisma.sequenceEnrollment.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            status: true,
          },
        },
        stepExecutions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { enrolledAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.sequenceEnrollment.count({ where });

    res.json({
      enrollments,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// ==========================================
// UNENROLL LEAD - DELETE /api/sequences/:id/enrollments/:enrollmentId
// ==========================================

router.delete('/:id/enrollments/:enrollmentId', async (req, res) => {
  try {
    const { enrollmentId } = req.params;

    const enrollment = await prisma.sequenceEnrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' });
      return;
    }

    // Mark as unsubscribed instead of deleting (preserves history)
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'unsubscribed' },
    });

    res.json({ message: 'Lead unenrolled from sequence' });
  } catch (error) {
    console.error('Error unenrolling lead:', error);
    res.status(500).json({ error: 'Failed to unenroll lead' });
  }
});

// ==========================================
// GET SEQUENCE STATS - GET /api/sequences/:id/stats
// ==========================================

router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const [totalEnrollments, statusCounts, stepStats] = await Promise.all([
      // Total enrollments
      prisma.sequenceEnrollment.count({ where: { sequenceId: id } }),

      // Count by status
      prisma.sequenceEnrollment.groupBy({
        by: ['status'],
        where: { sequenceId: id },
        _count: true,
      }),

      // Step execution stats
      prisma.stepExecution.groupBy({
        by: ['status'],
        where: {
          enrollment: { sequenceId: id },
        },
        _count: true,
      }),
    ]);

    // Transform status counts
    const enrollmentsByStatus: Record<string, number> = {};
    for (const item of statusCounts) {
      enrollmentsByStatus[item.status] = item._count;
    }

    const stepsByStatus: Record<string, number> = {};
    for (const item of stepStats) {
      stepsByStatus[item.status] = item._count;
    }

    res.json({
      totalEnrollments,
      enrollmentsByStatus,
      stepsByStatus,
      completionRate:
        totalEnrollments > 0
          ? ((enrollmentsByStatus['completed'] || 0) / totalEnrollments) * 100
          : 0,
    });
  } catch (error) {
    console.error('Error fetching sequence stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
