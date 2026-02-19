import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendQueue } from '../queues/index';
import { queueTrackConversion, queueScoreLead } from '../workers/scoring.worker';

const router = Router();
const prisma = new PrismaClient();

// ==========================================
// GET ALL MESSAGES - GET /api/inbox
// ==========================================

router.get('/', async (req, res) => {
  try {
    const { leadId, channel, direction, limit = '100', offset = '0' } = req.query;

    // Build where clause
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (channel) where.channel = channel;
    if (direction) where.direction = direction;

    const messages = await prisma.message.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            phone: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ==========================================
// GET CONVERSATION FOR LEAD - GET /api/inbox/lead/:leadId
// ==========================================

router.get('/lead/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;

    // Get lead info
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        company: true,
        phone: true,
      },
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Get all messages for this lead
    const messages = await prisma.message.findMany({
      where: { leadId },
      orderBy: { sentAt: 'asc' },
    });

    res.json({
      lead,
      messages,
      totalMessages: messages.length,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// ==========================================
// SEND REPLY - POST /api/inbox/reply
// ==========================================

router.post('/reply', async (req, res) => {
  try {
    const { leadId, content, channel } = req.body;

    // Validate required fields
    if (!leadId || !content || !channel) {
      res.status(400).json({
        error: 'Missing required fields',
        details: 'leadId, content, and channel are required',
      });
      return;
    }

    // Validate channel
    if (!['whatsapp', 'email', 'instagram'].includes(channel)) {
      res.status(400).json({
        error: 'Invalid channel',
        details: 'Channel must be whatsapp, email, or instagram',
      });
      return;
    }

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Create message record immediately (will be updated when actually sent)
    const message = await prisma.message.create({
      data: {
        leadId,
        content,
        direction: 'outbound',
        channel,
        status: 'queued',
      },
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
    });

    // Queue the message to be sent via the appropriate channel
    await sendQueue.add(
      'send-reply',
      {
        type: 'send-message',
        data: {
          messageId: message.id,
          leadId,
          channel,
          content,
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );

    console.log(`📤 Reply queued for lead ${lead.email} via ${channel}`);

    res.status(201).json({
      message: 'Reply queued successfully',
      data: message,
    });
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// ==========================================
// MARK MESSAGE AS READ - PUT /api/inbox/:id/read
// ==========================================

router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const message = await prisma.message.update({
      where: { id },
      data: { status: 'read' },
    });

    res.json(message);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// ==========================================
// GET UNREAD COUNT - GET /api/inbox/unread/count
// ==========================================

router.get('/unread/count', async (req, res) => {
  try {
    const count = await prisma.message.count({
      where: {
        direction: 'inbound',
        status: 'sent', // Inbound messages that haven't been read
      },
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// ==========================================
// RECEIVE INBOUND MESSAGE - POST /api/inbox/inbound
// ==========================================
// This endpoint would be called by webhooks from messaging providers
// (WhatsApp, email, etc.) when a lead replies

router.post('/inbound', async (req, res) => {
  try {
    const { leadId, content, channel, trengoMessageId } = req.body;

    // Validate required fields
    if (!leadId || !content || !channel) {
      res.status(400).json({
        error: 'Missing required fields',
        details: 'leadId, content, and channel are required',
      });
      return;
    }

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Create the inbound message record
    const message = await prisma.message.create({
      data: {
        leadId,
        content,
        direction: 'inbound',
        channel,
        status: 'sent',
        trengoMessageId: trengoMessageId || null,
      },
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
    });

    // Track this as a reply conversion
    await queueTrackConversion(leadId, 'reply', channel);
    console.log(`📥 Inbound message received from lead ${lead.email} via ${channel}`);
    console.log(`📈 Tracked 'reply' conversion for lead ${leadId}`);

    // Re-score the lead since they replied (engagement signal)
    await queueScoreLead(leadId);

    res.status(201).json({
      message: 'Inbound message recorded',
      data: message,
    });
  } catch (error) {
    console.error('Error recording inbound message:', error);
    res.status(500).json({ error: 'Failed to record inbound message' });
  }
});

// ==========================================
// GET MESSAGE STATS - GET /api/inbox/stats
// ==========================================

router.get('/stats', async (req, res) => {
  try {
    const [totalMessages, inboundMessages, outboundMessages, channelCounts] = await Promise.all([
      prisma.message.count(),
      prisma.message.count({ where: { direction: 'inbound' } }),
      prisma.message.count({ where: { direction: 'outbound' } }),
      prisma.message.groupBy({
        by: ['channel'],
        _count: true,
      }),
    ]);

    const byChannel: Record<string, number> = {};
    for (const item of channelCounts) {
      byChannel[item.channel] = item._count;
    }

    res.json({
      totalMessages,
      inboundMessages,
      outboundMessages,
      byChannel,
    });
  } catch (error) {
    console.error('Error fetching message stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
