import { useState, useEffect } from 'react'
import { Lead } from '@leadflow/types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Edit2, Save, X, Loader2, Settings2, Trash2, Plus, UserPlus } from 'lucide-react'

const API_BASE_URL = 'http://localhost:5000';

// Define all available columns with their labels
const ALL_COLUMNS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'position', label: 'Position' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'score', label: 'Score' },
  { key: 'linkedinURL', label: 'LinkedIn' },
  { key: 'description', label: 'Description' },
  { key: 'createdAt', label: 'Created' },
] as const;

type ColumnKey = typeof ALL_COLUMNS[number]['key'];

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'firstName', 'lastName', 'email', 'company', 'position', 'status', 'score'
];

const STATUS_OPTIONS = ['new', 'enriched', 'scored', 'contacted', 'unqualified', 'qualified', 'converted'];
const SOURCE_OPTIONS = ['linkedIn', 'website', 'apollo', 'hunter', 'meta', 'other'];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Modal state
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/leads`);
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleColumn = (columnKey: ColumnKey) => {
    setVisibleColumns(prev =>
      prev.includes(columnKey)
        ? prev.filter(c => c !== columnKey)
        : [...prev, columnKey]
    );
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setIsCreating(false);
    setEditForm({ ...lead });
  };

  const openCreateModal = () => {
    setEditingLead(null);
    setIsCreating(true);
    setEditForm({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      company: '',
      position: '',
      source: 'other',
      status: 'new',
      score: undefined,
      linkedinURL: '',
      description: '',
    });
  };

  const closeModal = () => {
    setEditingLead(null);
    setIsCreating(false);
    setEditForm({});
  };

  const handleEditChange = (field: keyof Lead, value: string | number) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const saveLead = async () => {
    if (!editForm.firstName || !editForm.lastName || !editForm.email) {
      alert('First name, last name, and email are required.');
      return;
    }

    setIsSaving(true);
    try {
      let response;
      if (isCreating) {
        // Create new lead
        response = await fetch(`${API_BASE_URL}/api/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        });
      } else if (editingLead) {
        // Update existing lead
        response = await fetch(`${API_BASE_URL}/api/leads/${editingLead.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        });
      } else {
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save lead');
      }

      await fetchLeads();
      closeModal();
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Failed to save lead. Check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLead = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/leads/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete lead');
      }

      await fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Failed to delete lead. Check console for details.');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'qualified':
      case 'converted':
        return 'bg-green-100 text-green-800';
      case 'contacted':
      case 'scored':
        return 'bg-blue-100 text-blue-800';
      case 'enriched':
        return 'bg-purple-100 text-purple-800';
      case 'unqualified':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderCellValue = (lead: Lead, columnKey: ColumnKey) => {
    const value = lead[columnKey as keyof Lead];

    if (columnKey === 'status') {
      return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(value as string)}`}>
          {value}
        </span>
      );
    }

    if (columnKey === 'score') {
      return value !== null && value !== undefined ? (
        <span className="font-medium">{value}</span>
      ) : '-';
    }

    if (columnKey === 'linkedinURL') {
      return value ? (
        <a
          href={value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View
        </a>
      ) : '-';
    }

    if (columnKey === 'createdAt') {
      return new Date(value as Date).toLocaleDateString();
    }

    return value || '-';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <span className="ml-3 text-gray-600">Loading leads...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500">Manage and track your leads pipeline.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Column Selector */}
          <div className="relative">
            <Button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Settings2 size={16} />
              Columns
            </Button>

            {showColumnSelector && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-3 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Toggle Columns</span>
                </div>
                <div className="p-2 max-h-64 overflow-y-auto">
                  {ALL_COLUMNS.map(column => (
                    <label
                      key={column.key}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(column.key)}
                        onChange={() => toggleColumn(column.key)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{column.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add Lead Button */}
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Leads Table */}
      {leads.length > 0 ? (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {ALL_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(column => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openEditModal(lead)}
                  >
                    {ALL_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(column => (
                      <TableCell key={column.key}>
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {renderCellValue(lead, column.key)}
                        </div>
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(lead);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit Lead"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLead(lead.id);
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Lead"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <UserPlus size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Leads Yet</h3>
          <p className="text-gray-600 mb-6">
            Add your first lead to get started.
          </p>
          <Button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus size={20} />
            Add Your First Lead
          </Button>
        </div>
      )}

      {/* Edit/Create Lead Modal */}
      {(editingLead || isCreating) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {isCreating ? 'Add New Lead' : 'Edit Lead'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={editForm.firstName || ''}
                  onChange={(e) => handleEditChange('firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={editForm.lastName || ''}
                  onChange={(e) => handleEditChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) => handleEditChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editForm.phoneNumber || ''}
                  onChange={(e) => handleEditChange('phoneNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={editForm.company || ''}
                  onChange={(e) => handleEditChange('company', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <input
                  type="text"
                  value={editForm.position || ''}
                  onChange={(e) => handleEditChange('position', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <select
                  value={editForm.source || ''}
                  onChange={(e) => handleEditChange('source', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {SOURCE_OPTIONS.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editForm.status || ''}
                  onChange={(e) => handleEditChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Score
                </label>
                <input
                  type="number"
                  value={editForm.score ?? ''}
                  onChange={(e) => handleEditChange('score', e.target.value ? parseInt(e.target.value) : 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={editForm.linkedinURL || ''}
                  onChange={(e) => handleEditChange('linkedinURL', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => handleEditChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Additional notes about this lead..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveLead}
                disabled={isSaving}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {isCreating ? 'Create Lead' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close column selector */}
      {showColumnSelector && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowColumnSelector(false)}
        />
      )}
    </div>
  );
}
