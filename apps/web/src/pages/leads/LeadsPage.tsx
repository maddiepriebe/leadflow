import { useState, useEffect } from 'react';
import axios from 'axios';
import { Lead } from '@leadflow/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';

export default function LeadsPage() {
  // STATE: Data that can change
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    company: '',
    position: '',
    linkedinURL: '',
    source: 'other' as Lead['source'],
    status: 'new' as Lead['status'],
    score: 0,
  });

  // EFFECT: Run when component loads
  useEffect(() => {
    fetchLeads();
  }, []);

  // FUNCTION: Fetch leads from API
  const fetchLeads = async () => {
    try {
      const response = await axios.get('/api/leads');
      setLeads(response.data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add new lead
  const handleAddLead = async () => {
    try {
      const response = await axios.post('/api/leads', formData);
      setLeads([...leads, response.data]);
      resetForm();
      setShowModal(false);
    } catch (error) {
      console.error('Error adding lead:', error);
    }
  };

  // Update existing lead
  const handleEditLead = async () => {
    if (!editingLead) return;

    try {
      const response = await axios.put(`/api/leads/${editingLead.id}`, formData);
      setLeads(leads.map(lead =>
        lead.id === editingLead.id ? response.data : lead
      ));
      resetForm();
      setEditingLead(null);
      setShowModal(false);
    } catch (error) {
      console.error('Error updating lead:', error);
    }
  };

  // Delete lead
  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;

    try {
      await axios.delete(`/api/leads/${id}`);
      setLeads(leads.filter(lead => lead.id !== id));
    } catch (error) {
      console.error('Error deleting lead:', error);
    }
  };

  // Open edit modal
  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phoneNumber: lead.phoneNumber || '',
      company: lead.company || '',
      position: lead.position || '',
      linkedinURL: lead.linkedinURL || '',
      source: lead.source,
      status: lead.status,
      score: lead.score || 0,
    });
    setShowModal(true);
  };

  // Open add modal
  const openAddModal = () => {
    resetForm();
    setEditingLead(null);
    setShowModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      company: '',
      position: '',
      linkedinURL: '',
      source: 'other',
      status: 'new',
      score: 0,
    });
  };

  // Filter leads based on search and status
  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      lead.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterStatus === 'All' || lead.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  // Get badge variant based on status
  const getStatusVariant = (status: Lead['status']) => {
    switch (status) {
      case 'qualified':
      case 'converted':
        return 'default';
      case 'contacted':
      case 'scored':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Get score color
  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-600 font-semibold';
    if (score >= 60) return 'text-blue-600 font-semibold';
    if (score >= 40) return 'text-amber-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  // LOADING STATE
  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading leads...</div>
        </div>
      </div>
    );
  }

  // MAIN UI
  return (
    <div className="container mx-auto p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Lead Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage and track your leads with AI-powered scoring
        </p>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button onClick={openAddModal}>
              <Plus className="mr-2 h-4 w-4" />
              New Lead
            </Button>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All Status</option>
              <option value="new">New</option>
              <option value="enriched">Enriched</option>
              <option value="scored">Scored</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="unqualified">Unqualified</option>
            </select>

            <div className="ml-auto text-sm text-muted-foreground font-medium">
              Total: {filteredLeads.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{leads.length}</div>
            <p className="text-sm text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {leads.filter(l => l.status === 'qualified').length}
            </div>
            <p className="text-sm text-muted-foreground">Qualified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {leads.filter(l => l.status === 'contacted').length}
            </div>
            <p className="text-sm text-muted-foreground">Contacted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {Math.round(
                leads.reduce((acc, l) => acc + (l.score || 0), 0) / leads.length
              ) || 0}
            </div>
            <p className="text-sm text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm || filterStatus !== 'All'
                  ? 'No leads match your search.'
                  : 'No leads yet. Add your first lead to get started!'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{lead.firstName} {lead.lastName}</div>
                          {lead.position && (
                            <div className="text-xs text-muted-foreground">
                              {lead.position}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{lead.email}</TableCell>
                      <TableCell className="text-sm">{lead.company || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(lead.status)}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {lead.source}
                      </TableCell>
                      <TableCell>
                        <span className={getScoreColor(lead.score)}>
                          {lead.score || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(lead)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLead(lead.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {editingLead ? 'Edit Lead' : 'Add New Lead'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowModal(false);
                  setEditingLead(null);
                  resetForm();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name *</label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name *</label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Company</label>
                  <Input
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Position</label>
                  <Input
                    value={formData.position}
                    onChange={(e) => setFormData({...formData, position: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as Lead['status']})}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="new">New</option>
                    <option value="enriched">Enriched</option>
                    <option value="scored">Scored</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="converted">Converted</option>
                    <option value="unqualified">Unqualified</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({...formData, source: e.target.value as Lead['source']})}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="linkedIn">LinkedIn</option>
                    <option value="website">Website</option>
                    <option value="apollo">Apollo</option>
                    <option value="hunter">Hunter</option>
                    <option value="meta">Meta</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">LinkedIn URL</label>
                  <Input
                    type="url"
                    value={formData.linkedinURL}
                    onChange={(e) => setFormData({...formData, linkedinURL: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">AI Score (0-100)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.score}
                    onChange={(e) => setFormData({...formData, score: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
            </CardContent>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditingLead(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={editingLead ? handleEditLead : handleAddLead}>
                {editingLead ? 'Update Lead' : 'Add Lead'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}