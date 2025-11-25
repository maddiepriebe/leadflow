import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { enrichQueue } from '../queues';

// ==========================================
// LEADS ROUTER
// ==========================================
// Handles all /api/leads endpoints

const router = Router();
const prisma = new PrismaClient();

// GET /api/leads - Get all leads
router.get('/', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      include: { 
        campaign: true,  // Include related campaign
        messages: true   // Include related messages
      },
      orderBy: { 
        createdAt: 'desc'  // Newest first
      }
    });
    
    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/leads/:id - Get single lead
router.get('/:id', async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { 
        campaign: true, 
        messages: true 
      }
    });
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// POST /api/leads - Create new lead
router.post('/', async (req, res) => {
  try {
    // Validate required fields
    const { firstName, lastName, email, source } = req.body;
    
    if (!firstName || !lastName || !email || !source) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }
    
    // Create lead in database
    const lead = await prisma.lead.create({
      data: {
        firstName,
        lastName,
        email,
        phone: req.body.phone,
        company: req.body.company,
        position: req.body.position,
        linkedinUrl: req.body.linkedinUrl,
        source,
        status: 'new'
      }
    });
    
    // Queue enrichment job (run in background)
    await enrichQueue.add('enrich-lead', { 
      leadId: lead.id 
    });
    
    res.status(201).json(lead);
  } catch (error: any) {
    console.error('Error creating lead:', error);
    
    // Handle unique constraint violation (duplicate email)
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'Email already exists' 
      });
    }
    
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// PUT /api/leads/:id - Update lead
router.put('/:id', async (req, res) => {
  try {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: req.body
    });
    
    res.json(lead);
  } catch (error: any) {
    console.error('Error updating lead:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', async (req, res) => {
  try {
    await prisma.lead.delete({
      where: { id: req.params.id }
    });
    
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting lead:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

export default router;