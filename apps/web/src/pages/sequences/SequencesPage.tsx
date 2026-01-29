import { Button } from '@leadflow/ui';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from '@/components/ui/table';
import { Sequence } from '@leadflow/types';
import { Edit2, Trash2 } from 'lucide-react';


const API_BASE_URL = 'http://localhost:5000';

const TESTER_SEQUENCES: Sequence[] = [
  {
    id: 'seq_test_001',
    name: 'Welcome Sequence',
    description: 'A sequence to welcome new leads and introduce our platform',
    steps: [
      { id: 'step_1', order: 0, type: 'email', content: 'Welcome to our service!'},
      { id: 'step_2', order: 1, type: 'email', content: 'Here are some features you might like'},
      { id: 'step_3', order: 2, type: 'dms', content: 'Quick follow-up via SMS'}
    ],
    prompt: 'Generate a personalized welcome message to introduce our eCommerce platform to ${LEAD_NAME} from ${LEAD_COMPANY}. Highlight the benefits of WhatsApp-based sales.',
    campaignId: 'camp_test_001',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 'seq_test_002',
    name: 'Beauty Salon Outreach',
    description: 'Targeted sequence for beauty salon owners in UAE',
    steps: [
      { id: 'step_1', order: 0, type: 'email', content: 'Hi there! We help beauty salons streamline bookings'},
      { id: 'step_2', order: 1, type: 'whatsapp', content: 'Would you like a demo?' }
    ],
    prompt: 'Create a compelling outreach message for ${LEAD_NAME} who owns ${LEAD_COMPANY}. Focus on how our platform helps beauty salons manage appointments and payments via WhatsApp.',
    campaignId: 'camp_test_002',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-05'),
  },
  {
    id: 'seq_test_003',
    name: 'E-commerce Follow-up',
    description: 'Follow-up sequence for e-commerce businesses',
    steps: [
      { id: 'step_1', order: 0, type: 'email', content: 'Following up on our conversation' },
      { id: 'step_2', order: 1, type: 'email', content: 'Case study: How we helped similar businesses'},
      { id: 'step_3', order: 2, type: 'whatsapp', content: 'Quick check-in'},
      { id: 'step_4', order: 3, type: 'email', content: 'Final follow-up'}
    ],
    prompt: 'Generate a follow-up message for ${LEAD_NAME} at ${LEAD_COMPANY}. Reference their industry (${LEAD_INDUSTRY}) and emphasize ROI from using our platform.',
    campaignId: 'camp_test_001',
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-03-15'),
  }
];



export default function SequencesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const testingEnvironment = true; // Set to false to fetch from backend
  
  const [currentSequence, setCurrentSequence] = useState<Sequence>({
    id: '',
    name: '',
    description: '',
    steps: [],
    prompt: '',
    campaignId: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  });


  // Load Sequence from backend on mount 
  useEffect(() => {
    loadSequences();
  }, []);

  const loadSequences = async () => {
    setIsLoading(true)
    if (testingEnvironment) {
      setSequences(TESTER_SEQUENCES);
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/sequences`);
      if (!response.ok) throw new Error('Failed to fetch sequences from database');
      const data = await response.json();
      setSequences(data);
    } catch (error) {
      console.error('Error loading sequences:', error);
    } finally {
      setIsLoading(false)
    }
  };

  // User changes to prompt 
  const handlePromptChange = (
    field: keyof Sequence['prompt'],
    value: string
  ) => {
    setCurrentSequence({
      ...currentSequence,
      [field]: value,
    });
  };

  const saveSequence = async () => {
    if (!currentSequence.name) {
      alert('Sequence name is required');
      return;
    }
    
    try {
      const payload = {
        name: currentSequence.name,
        description: currentSequence.description,
        steps: currentSequence.steps,
        prompt: currentSequence.prompt,
        campaignId: currentSequence.campaignId,
      };
      let response;
      
      if (editingSequenceId) {
        // update existing profile 
        response = await fetch(`${API_BASE_URL}/api/sequences/${editingSequenceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // create new profile 
        response = await fetch(`${API_BASE_URL}/api/sequences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      
      if (!response.ok) throw new Error('Failed to save sequence');
      
      // Refresh list
      await loadSequences();
      setIsCreating(false);
      setEditingSequenceId(null);
    } catch (error) {
      console.error('Error saving sequence:', error);
    }
  };

  const editSequence = (sequence: Sequence) => {
    setCurrentSequence(sequence);
    setEditingSequenceId(sequence.id);
    setIsCreating(true)
  }

  const deleteSequence = async (sequenceId: string) => {
    if (!window.confirm('Are you sure you want to delete this sequence?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/sequences/${sequenceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete sequence');
      // Refresh list
      await loadSequences();
    } catch (error) {
      console.error('Error deleting sequence:', error);
      alert(error instanceof Error ? error.message : 'Unknown error');
    }
  }


  // Show loading spinner while fetching sequences 
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading sequences...</div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sequences</h1>
        <Button>+ Create Sequence</Button>
      </div>
      
      <div className="bg-white shadow sm:rounded-lg p-6">
        { sequences.length === 0 ? (
          <p className="text-gray-500">
            No sequences found. Create your first sequence to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sequence Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Map over sequences and render rows here */}
              {sequences.map((sequence) => (
                <TableRow key={sequence.id}>
                  <TableCell>{sequence.name}</TableCell>
                  <TableCell>{sequence.description || '-'}</TableCell>
                  <TableCell>{sequence.steps.length}</TableCell>
                  <TableCell>{sequence.prompt || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button
                        onClick={() => editSequence(sequence)}
                        className="text-blue-600 hover:text-blue-800"
                        title='Edit Sequence'
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteSequence(sequence.id)}
                        className="text-red-600 hover:text-red-800"
                        title='Delete Sequence'
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}