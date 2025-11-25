import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/inbox - Get all messages
router.get('/', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      include: { lead: true },
      orderBy: { sentAt: 'desc' }
    });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;