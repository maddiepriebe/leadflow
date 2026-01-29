import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/sequences
router.get('/', async (req, res) => {
  try {
    const sequences = await prisma.sequence.findMany({
      include: { campaign: true }
    });
    res.json(sequences);
  } catch (error) {
    console.error('Error fetching sequences:', error);
    res.status(500).json({ error: 'Failed to fetch sequences' });
  }
});

// POST /api/sequences
router.post('/', async (req, res) => {
  try {
    const sequence = await prisma.sequence.create({
      data: req.body
    });
    res.status(201).json(sequence);
  } catch (error) {
    console.error('Error creating sequence:', error);
    res.status(500).json({ error: 'Failed to create sequence' });
  }
});

export default router;