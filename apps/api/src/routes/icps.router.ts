import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  apolloQueue,
  googleQueue,
  instaQueue,
  linkedInQueue
} from '../queues';

const router = Router();
const prisma = new PrismaClient();

// GET /api/icps
router.get('/', async (req, res) => {
  try {
    const icps = await prisma.iCP.findMany({ 
            orderBy: { createdAt: 'desc' },
            include: { 
                _count: {
                    select: { leads: true }
                }
         }
    });
    
    res.json(icps);
  } catch (error) {
    console.error('Error fetching ICP profiles:', error);
    res.status(500).json({ error: 'Failed to fetch ICP profiles' });
  }
});

// GET /api/icps one by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const icp = await prisma.iCP.findUnique({
        where: { id: req.params.id },
        include: {
            _count: {
                select: { leads: true }
            }
        }
    });
    if (!icp) {
      return res.status(404).json({ error: 'ICP profile not found' });
    }
    res.json(icp);
  } catch (error) {
    console.error('Error fetching ICP profile:', error);
    res.status(500).json({ error: 'Failed to fetch ICP profile' });
  }
});

// POST create new /api/icps
router.post('/', async (req, res) => {
  try {
    const { name, criteria, isActive } = req.body;
    if (!name || !criteria) {
        return res.status(400).json({ error: 'Name and criteria are required' });
    }  
    const icp = await prisma.iCP.create({
        data: {
            name, 
            criteria,
            isActive: isActive ?? true
        }
    });
    res.status(201).json(icp);
  } catch (error) {
    console.error('Error creating ICP profile:', error);
    res.status(500).json({ error: 'Failed to create ICP profile' });
  }
});

// PUT update existing /api/icps/:id
router.put('/:id', async (req, res) => {
    try {
      const { name, criteria, isActive } = req.body;
      const icp = await prisma.iCP.update({
          where: { id: req.params.id },
          data: {
              name, 
              criteria,
              isActive,
              updatedAt: new Date()
          }
      });
      res.json(icp);
    } catch (error) {
      console.error('Error updating ICP profile:', error);
      res.status(500).json({ error: 'Failed to update ICP profile' });
    }
});

// DELETE /api/icps/:id
router.delete('/:id', async (req, res) => {
    try {
        // check if icp has associated leads
        const leadCount = await prisma.lead.count({
            where: { icpId: req.params.id }
        });
        if (leadCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete ICP profile with associated leads. Please reassign or delete first.' 
            });
    } 
    await prisma.iCP.delete({
        where: { id: req.params.id }
    });
    res.json({ success: true, message: 'ICP profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting ICP profile:', error);
    res.status(500).json({ error: 'Failed to delete ICP profile' });
  }
});

// PATCH toggle active status
router.patch('/:id/toggle-active', async (req, res) => {
    try {
      const icp = await prisma.iCP.findUnique({
          where: { id: req.params.id }
      });
      if (!icp) {
        return res.status(404).json({ error: 'ICP profile not found' });
      }
      const icpUpdated = await prisma.iCP.update({
          where: { id: req.params.id },
          data: {
              isActive: !icp.isActive
          }
      });
      res.json(icpUpdated);
    } catch (error) {
      console.error('Error toggling ICP profile active status:', error);
      res.status(500).json({ error: 'Failed to toggle ICP profile active status' });
    }
});

// POST /api/icps/:id/search - Queue a search job for this ICP
router.post('/:id/search', async (req, res) => {
    try {
      const { id } = req.params;
      const { source = 'apollo', page = 1, perPage = 25 } = req.body;

      // Verify ICP exists
      const icp = await prisma.iCP.findUnique({
          where: { id }
      });

      if (!icp) {
        return res.status(404).json({ error: 'ICP profile not found' });
      }

      let job;
      const jobData = {
        type: 'search-by-icp',
        data: {
          icpId: id,
          page,
          perPage
        }
      };

      switch (source) {
        case 'apollo':
          job = await apolloQueue.add('search-by-icp', jobData);
          break;

        case 'google':
          job = await googleQueue.add('search-by-icp', jobData);
          break;

        case 'google-linkedin':
          // Use Google Custom Search to find LinkedIn profiles
          job = await googleQueue.add('custom-linkedin-search', {
            type: 'custom-linkedin-search',
            data: {
              icpId: id,
              page,
              perPage
            }
          });
          break;

        case 'instagram':
          job = await instaQueue.add('search-by-icp', jobData);
          break;

        case 'linkedin':
          job = await linkedInQueue.add('search-by-icp', jobData);
          break;

        default:
          return res.status(400).json({
            error: `Unknown source: ${source}. Supported sources: apollo, google, google-linkedin, instagram, linkedin`
          });
      }

      res.json({
        success: true,
        message: `Search job queued for ICP "${icp.name}" using ${source}`,
        jobId: job.id,
        icpId: id,
        source,
        params: { page, perPage }
      });

    } catch (error) {
      console.error('Error queueing ICP search:', error);
      res.status(500).json({ error: 'Failed to queue search job' });
    }
});

// GET /api/icps/:id/search/status/:source/:jobId - Check search job status
router.get('/:id/search/status/:source/:jobId', async (req, res) => {
    try {
      const { source, jobId } = req.params;

      // Select the appropriate queue based on source
      let queue;
      switch (source) {
        case 'apollo':
          queue = apolloQueue;
          break;
        case 'google':
          queue = googleQueue;
          break;
        case 'instagram':
          queue = instaQueue;
          break;
        case 'linkedin':
          queue = linkedInQueue;
          break;
        default:
          return res.status(400).json({ error: `Unknown source: ${source}` });
      }

      // Get job from the appropriate queue
      const job = await queue.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const state = await job.getState();
      const progress = job.progress;
      const returnValue = job.returnvalue;
      const failedReason = job.failedReason;

      res.json({
        jobId: job.id,
        source,
        state,
        progress,
        result: returnValue,
        error: failedReason,
        createdAt: job.timestamp,
        finishedAt: job.finishedOn,
        processedAt: job.processedOn
      });

    } catch (error) {
      console.error('Error fetching job status:', error);
      res.status(500).json({ error: 'Failed to fetch job status' });
    }
});

export default router;

