import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { increaseMaxListeners } from 'bullmq';

const router = Router();
const prisma = new PrismaClient();

// GET /api/icps
router.get('/', async (req, res) => {
  try {
    const icps = await prisma.icpProfile.findMany({ 
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
    const icp = await prisma.icpProfile.findUnique({
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
    const icp = await prisma.icpProfile.create({
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
      const icp = await prisma.icpProfile.update({
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
            where: { icpProfileId: req.params.id }
        });
        if (leadCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete ICP profile with associated leads. Please reassign or delete first.' 
            });
    } 
    await prisma.icpProfile.delete({
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
      const icp = await prisma.icpProfile.findUnique({
          where: { id: req.params.id }
      });
      if (!icp) {
        return res.status(404).json({ error: 'ICP profile not found' });
      }
      const icpUpdated = await prisma.icpProfile.update({
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

export default router;

