import { Button } from '@leadflow/ui';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Edit2,
  Trash2,
  Play,
  Pause,
  Users,
  Plus,
  X,
  Mail,
  MessageCircle,
  Clock,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ==========================================
// TYPES
// ==========================================

interface SequenceStep {
  id: string;
  order: number;
  type: 'email' | 'whatsapp' | 'dms' | 'wait';
  content: string;
  delayDays?: number;
  delayHours?: number;
}

interface Sequence {
  id: string;
  name: string;
  description?: string;
  steps: SequenceStep[];
  prompt?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  campaignId?: string;
  enrollmentCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
}

// ==========================================
// STEP TYPE CONFIG
// ==========================================

const STEP_TYPES = [
  { value: 'email', label: 'Email', icon: Mail, color: 'bg-blue-100 text-blue-700' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'bg-green-100 text-green-700' },
  { value: 'dms', label: 'Instagram DM', icon: Send, color: 'bg-pink-100 text-pink-700' },
  { value: 'wait', label: 'Wait', icon: Clock, color: 'bg-gray-100 text-gray-700' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null);
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    prompt: string;
    steps: SequenceStep[];
  }>({
    name: '',
    description: '',
    prompt: '',
    steps: [{ id: 'step_1', order: 0, type: 'email', content: '', delayDays: 1 }],
  });

  // Load sequences
  useEffect(() => {
    loadSequences();
  }, []);

  const loadSequences = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/sequences');
      if (!response.ok) throw new Error('Failed to fetch sequences');
      const data = await response.json();
      setSequences(data);
    } catch (error) {
      console.error('Error loading sequences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Open create modal
  const handleCreate = () => {
    setEditingSequence(null);
    setFormData({
      name: '',
      description: '',
      prompt: '',
      steps: [{ id: 'step_1', order: 0, type: 'email', content: '', delayDays: 1 }],
    });
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (sequence: Sequence) => {
    setEditingSequence(sequence);
    setFormData({
      name: sequence.name,
      description: sequence.description || '',
      prompt: sequence.prompt || '',
      steps: sequence.steps.length > 0 ? sequence.steps : [{ id: 'step_1', order: 0, type: 'email', content: '', delayDays: 1 }],
    });
    setShowModal(true);
  };

  // Save sequence
  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a sequence name');
      return;
    }

    if (formData.steps.length === 0) {
      alert('Please add at least one step');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        prompt: formData.prompt,
        steps: formData.steps,
      };

      const url = editingSequence
        ? `/api/sequences/${editingSequence.id}`
        : `/api/sequences`;

      const response = await apiFetch(url, {
        method: editingSequence ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save sequence');
      }

      setShowModal(false);
      await loadSequences();
    } catch (error) {
      console.error('Error saving sequence:', error);
      alert(error instanceof Error ? error.message : 'Failed to save sequence');
    }
  };

  // Delete sequence
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this sequence?')) return;

    try {
      const response = await apiFetch(`/api/sequences/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete sequence');
      await loadSequences();
    } catch (error) {
      console.error('Error deleting sequence:', error);
      alert('Failed to delete sequence');
    }
  };

  // Activate sequence
  const handleActivate = async (id: string) => {
    try {
      const response = await apiFetch(`/api/sequences/${id}/activate`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to activate sequence');
      await loadSequences();
    } catch (error) {
      console.error('Error activating sequence:', error);
      alert('Failed to activate sequence');
    }
  };

  // Pause sequence
  const handlePause = async (id: string) => {
    try {
      const response = await apiFetch(`/api/sequences/${id}/pause`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to pause sequence');
      await loadSequences();
    } catch (error) {
      console.error('Error pausing sequence:', error);
      alert('Failed to pause sequence');
    }
  };

  // Open enroll modal
  const handleOpenEnroll = (sequence: Sequence) => {
    setSelectedSequence(sequence);
    setShowEnrollModal(true);
  };

  // Add step
  const addStep = () => {
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        {
          id: `step_${Date.now()}`,
          order: formData.steps.length,
          type: 'email',
          content: '',
          delayDays: 1,
        },
      ],
    });
  };

  // Remove step
  const removeStep = (index: number) => {
    if (formData.steps.length <= 1) return;
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index),
    });
  };

  // Update step
  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, steps: newSteps });
  };

  // Toggle expanded view
  const toggleExpanded = (id: string) => {
    setExpandedSequence(expandedSequence === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading sequences...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sequences</h1>
          <p className="text-gray-500 mt-1">
            Create automated message sequences to engage your leads
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Sequence
        </Button>
      </div>

      {/* Sequences List */}
      <div className="bg-white shadow sm:rounded-lg">
        {sequences.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">
              No sequences found. Create your first sequence to get started.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Sequence
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequences.map((sequence) => (
                <>
                  <TableRow key={sequence.id}>
                    <TableCell>
                      <button
                        onClick={() => toggleExpanded(sequence.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {expandedSequence === sequence.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sequence.name}</div>
                        {sequence.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {sequence.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[sequence.status] || ''}>
                        {sequence.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {sequence.steps.slice(0, 4).map((step, i) => {
                          const stepType = STEP_TYPES.find((t) => t.value === step.type);
                          const Icon = stepType?.icon || Mail;
                          return (
                            <div
                              key={i}
                              className={`p-1 rounded ${stepType?.color || 'bg-gray-100'}`}
                              title={`Step ${i + 1}: ${step.type}`}
                            >
                              <Icon className="h-3 w-3" />
                            </div>
                          );
                        })}
                        {sequence.steps.length > 4 && (
                          <span className="text-gray-500 text-sm">
                            +{sequence.steps.length - 4}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600">
                        {sequence.enrollmentCount || 0} leads
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {sequence.status === 'active' ? (
                          <button
                            onClick={() => handlePause(sequence.id)}
                            className="text-yellow-600 hover:text-yellow-800"
                            title="Pause Sequence"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(sequence.id)}
                            className="text-green-600 hover:text-green-800"
                            title="Activate Sequence"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEnroll(sequence)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Enroll Leads"
                          disabled={sequence.status !== 'active'}
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(sequence)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit Sequence"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sequence.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Sequence"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Expanded Steps View */}
                  {expandedSequence === sequence.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-gray-50">
                        <div className="py-4 px-2">
                          <h4 className="font-medium mb-3">Sequence Steps</h4>
                          <div className="space-y-2">
                            {sequence.steps.map((step, index) => {
                              const stepType = STEP_TYPES.find((t) => t.value === step.type);
                              const Icon = stepType?.icon || Mail;
                              return (
                                <div
                                  key={step.id}
                                  className="flex items-start gap-3 bg-white p-3 rounded border"
                                >
                                  <div className={`p-2 rounded ${stepType?.color || 'bg-gray-100'}`}>
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        Step {index + 1}: {stepType?.label || step.type}
                                      </span>
                                      {step.delayDays && step.delayDays > 0 && (
                                        <span className="text-xs text-gray-500">
                                          (after {step.delayDays} day{step.delayDays > 1 ? 's' : ''})
                                        </span>
                                      )}
                                    </div>
                                    {step.content && (
                                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                                        {step.content}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">
                {editingSequence ? 'Edit Sequence' : 'Create Sequence'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sequence Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Welcome Sequence"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Brief description of this sequence"
                />
              </div>

              {/* AI Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Prompt (Optional)
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Custom AI prompt for message generation. Use ${LEAD_NAME}, ${LEAD_COMPANY}, etc."
                />
              </div>

              {/* Steps */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Sequence Steps *
                  </label>
                  <Button variant="secondary" onClick={addStep}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Step
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.steps.map((step, index) => (
                    <div key={step.id} className="border rounded-md p-3 bg-gray-50">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          Step {index + 1}
                        </span>

                        {/* Step Type */}
                        <select
                          value={step.type}
                          onChange={(e) => updateStep(index, 'type', e.target.value)}
                          className="px-2 py-1 border rounded text-sm"
                        >
                          {STEP_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>

                        {/* Delay */}
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">Wait</span>
                          <input
                            type="number"
                            min="0"
                            value={step.delayDays || 0}
                            onChange={(e) => updateStep(index, 'delayDays', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border rounded text-sm"
                          />
                          <span className="text-sm text-gray-500">days</span>
                        </div>

                        {/* Remove button */}
                        {formData.steps.length > 1 && (
                          <button
                            onClick={() => removeStep(index)}
                            className="ml-auto text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Content (not for wait steps) */}
                      {(step.type as string) !== 'wait' && (
                        <textarea
                          value={step.content}
                          onChange={(e) => updateStep(index, 'content', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          rows={3}
                          placeholder={`Message content for ${step.type}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingSequence ? 'Update Sequence' : 'Create Sequence'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Leads Modal */}
      {showEnrollModal && selectedSequence && (
        <EnrollLeadsModal
          sequence={selectedSequence}
          onClose={() => {
            setShowEnrollModal(false);
            setSelectedSequence(null);
          }}
          onEnrolled={() => {
            loadSequences();
            setShowEnrollModal(false);
            setSelectedSequence(null);
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// ENROLL LEADS MODAL COMPONENT
// ==========================================

interface EnrollLeadsModalProps {
  sequence: Sequence;
  onClose: () => void;
  onEnrolled: () => void;
}

function EnrollLeadsModal({ sequence, onClose, onEnrolled }: EnrollLeadsModalProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const response = await apiFetch('/api/leads');
      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLead = (id: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeads(newSelected);
  };

  const selectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)));
    }
  };

  const handleEnroll = async () => {
    if (selectedLeads.size === 0) {
      alert('Please select at least one lead');
      return;
    }

    setIsEnrolling(true);
    try {
      const response = await apiFetch(`/api/sequences/${sequence.id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ leadIds: Array.from(selectedLeads) }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to enroll leads');
      }

      alert(`${selectedLeads.size} leads enrolled successfully!`);
      onEnrolled();
    } catch (error) {
      console.error('Error enrolling leads:', error);
      alert(error instanceof Error ? error.message : 'Failed to enroll leads');
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden m-4">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Enroll Leads</h2>
            <p className="text-sm text-gray-500">
              Select leads to enroll in "{sequence.name}"
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No leads available</div>
          ) : (
            <>
              <div className="mb-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLeads.size === leads.length}
                    onChange={selectAll}
                    className="rounded"
                  />
                  <span>Select All ({leads.length} leads)</span>
                </label>
              </div>
              <div className="space-y-2">
                {leads.map((lead) => (
                  <label
                    key={lead.id}
                    className={`flex items-center gap-3 p-3 rounded border cursor-pointer hover:bg-gray-50 ${
                      selectedLeads.has(lead.id) ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLeads.has(lead.id)}
                      onChange={() => toggleLead(lead.id)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">
                        {lead.firstName} {lead.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lead.email} {lead.company && `- ${lead.company}`}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <span className="text-sm text-gray-600">
            {selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleEnroll} disabled={isEnrolling || selectedLeads.size === 0}>
              {isEnrolling ? 'Enrolling...' : `Enroll ${selectedLeads.size} Lead${selectedLeads.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
