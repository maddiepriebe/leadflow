import { Button } from '@leadflow/ui';
import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ICP } from '@leadflow/types';
import { Plus, Trash2, Edit2, Search, Save, X, Loader2} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const DEFAULT_ICP_PROFILES: ICP[] = [
  {
    id: 'LS1',
    name: 'High-Intent Instagram Commerce Sellers',
    isActive: true,
    criteria: {
      jobTitles: ['Owner', 'Founder', 'Social Media Manager', 'E-commerce Manager'],
      industries: [
        'Fashion', 'Apparel', 'Beauty', 'Cosmetics', 'Jewelry', 
        'Home Decor', 'Lifestyle Products'
      ],
      companySize: ['1-10', '11-50'],
      locations: ['UAE', 'Saudi Arabia', 'Kuwait', 'Qatar'],
      technologies: ['Instagram Shopping', 'Meta Commerce', 'WhatsApp Business'],
      keywords: [
        'DM to order',
        'WhatsApp order',
        'cash on delivery',
        'handmade',
        'boutique',
        'online shop'
      ],
      fundingStages: ['Bootstrap'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  {
    id: 'LS2',
    name: 'WhatsApp-First SMEs With Manual Sales Processes',
    isActive: true, 
    criteria: {
      jobTitles: ['Sales Manager', 'General Manager', 'Founder', 'Operations Lead'],
      industries: [
        'Electronics', 'Furniture', 'Appliances', 
        'Automotive Accessories', 'Home Services'
      ],
      companySize: ['5-200', '50-500'],
      locations: ['UAE', 'Saudi Arabia', 'Egypt', 'Pakistan'],
      technologies: ['WhatsApp Business API', 'CRM', 'Shopify', 'Zoho'],
      keywords: [
        'send quote',
        'WhatsApp support',
        'manual invoicing',
        'manual sales',
        'COD deliveries'
      ],
      fundingStages: ['Bootstrap', 'Seed', 'Series A'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  {
    id: 'LS3',
    name: 'Service Businesses With High Booking Friction',
    isActive: true,
    criteria: {
      jobTitles: [
        'Owner', 'Clinic Manager', 'Salon Manager', 
        'Customer Service Manager', 'Operations Manager'
      ],
      industries: [
        'Beauty Services', 'Clinics', 'Salons', 'Wellness', 
        'Cleaning Services', 'Maintenance Services', 'Pet Grooming'
      ],
      companySize: ['1-50', '11-100'],
      locations: ['UAE', 'Saudi Arabia', 'Kuwait', 'Bahrain'],
      technologies: ['Booking systems', 'Calendly', 'WhatsApp Business'],
      keywords: [
        'appointment booking',
        'WhatsApp confirmations',
        'deposit required',
        'customer follow-up'
      ],
      fundingStages: ['Bootstrap', 'Seed'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  {
    id: 'LS4',
    name: 'Instagram Micro-Merchants With High Engagement Ratios',
    isActive: true,
    criteria: {
      jobTitles: ['Owner', 'Self-Employed'],
      industries: ['Beauty', 'Gifts', 'Handmade Goods', 'Food Delivery'],
      companySize: ['1-5', '1-10'],
      locations: ['UAE', 'Saudi Arabia', 'Egypt', 'Jordan'],
      technologies: ['Instagram', 'WhatsApp'],
      keywords: [
        'dm for order',
        'handmade business',
        'micro merchant',
        'whatsapp delivery',
        'daily orders'
      ],
      fundingStages: ['Bootstrap'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  {
    id: 'LS5',
    name: 'B2B SMEs Using WhatsApp for Quotations',
    isActive: true, 
    criteria: {
      jobTitles: ['Sales Manager', 'Commercial Manager', 'Operations Lead', 'Founder'],
      industries: [
        'Wholesale', 'Industrial Supplies',
        'Office Supplies', 'Events Equipment',
        'Construction Materials'
      ],
      companySize: ['10-500'],
      locations: ['UAE', 'Saudi Arabia', 'Oman', 'Jordan'],
      technologies: ['ERP', 'CRM', 'WhatsApp Business API'],
      keywords: [
        'RFQ',
        'quotation',
        'invoice link',
        'whatsapp quote',
        'b2b inquiry'
      ],
      fundingStages: ['Bootstrap', 'Seed'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  {
    id: 'LS6',
    name: 'High-Growth D2C Brands Expanding to WhatsApp Sales',
    isActive: true, 
    criteria: {
      jobTitles: ['Founder', 'Head of Growth', 'E-commerce Manager'],
      industries: [
        'Beauty & Cosmetics',
        'Fashion',
        'Fitness & Supplements',
        'Consumer Goods'
      ],
      companySize: ['10-200', '50-500'],
      locations: ['UAE', 'Saudi Arabia', 'Kuwait'],
      technologies: ['Shopify', 'Meta Commerce', 'CRM', 'WhatsApp API'],
      keywords: [
        'scaling',
        'conversion rate',
        'customer retention',
        'abandoned cart',
        'whatsapp checkout'
      ],
      fundingStages: ['Seed', 'Series A', 'Series B'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

type SearchSource = 'apollo' | 'google' | 'google-linkedin' | 'instagram' | 'linkedin';

interface IcpSearchStatusResponse {
  jobId: string;
  source: SearchSource;
  state: string;
  result?: {
    success?: boolean;
    totalResults?: number;
    returnedResults?: number;
    createdLeads?: number;
    skippedLeads?: number;
    page?: number;
    perPage?: number;
    totalPages?: number;
  };
  error?: string;
}

interface IcpTestResult {
  profileId: string;
  profileName: string;
  source: SearchSource;
  jobId: string;
  state: string;
  result?: IcpSearchStatusResponse['result'];
  error?: string;
}

export default function ICPPage() {
  // State for ICP profiles
  const [icpProfiles, setIcpProfiles] = useState<ICP[]>(DEFAULT_ICP_PROFILES);
  const [isCreating, setIsCreating] = useState(false);
  const [editingIcpId, setEditingIcpId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState<IcpTestResult | null>(null);
  const [isTestingProfile, setIsTestingProfile] = useState<string | null>(null);

  const [currentProfile, setCurrentProfile] = useState<ICP>({
    name: '',
    id: '',
    isActive: false,
    criteria: {
      jobTitles: [],
      industries: [],
      companySize: [],
      locations: [],
      technologies: [],
      keywords: [],
      fundingStages: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Reset form fields
  const resetForm = () => {
    setCurrentProfile({
      name: '',
      criteria: {
        jobTitles: [],
        industries: [],
        companySize: [],
        locations: [],
        technologies: [],
        keywords: [],
        fundingStages: [],
      },
      id: '',
      isActive: true, 
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setEditingIcpId(null);
    setIsCreating(false);
  };

  // Load ICPs from backend on mount 
  useEffect(() => {
    loadICPs();
  }, []);

  const loadICPs = async() => {
    setIsLoading(true)
    try {
      const response = await apiFetch('/api/icps');
      if (!response.ok) throw new Error('Failed to fetch ICP profiles');
      const data = await response.json();
      setIcpProfiles(data);
    } catch (error) {
      console.error('Error loading ICP profiles:', error);
      alert('Failed to load ICP profiles. Check server connection.')
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input changes
  const handleInputChange = <K extends keyof ICP>(field: K, value: ICP[K]) => {
    setCurrentProfile(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCriteriaChange = (
    field: keyof ICP['criteria'],
    value: string
  ) => {
    // Split by comma and trim each item, filter out empty strings
    const arrayValue = value
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    setCurrentProfile(prev => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [field]: arrayValue,
      },
    }));
  };

  // Save ICP profile (create or update)
  const saveProfile = async () => {
    if (!currentProfile.name.trim()) {
      alert('Profile name is required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: currentProfile.name,
        criteria: currentProfile.criteria,
        isActive: currentProfile.isActive ?? true,
      };
      let response;
      if (editingIcpId) {
        // update existing profile
        response = await apiFetch(`/api/icps/${editingIcpId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        // create new profile
        response = await apiFetch('/api/icps', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save ICP profile');
      }

      // Reload all ICPs from backend 
      await loadICPs();
      resetForm();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save ICP profile. Check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  // Edit Profile
  const editProfile = (profile: ICP) => {
    setCurrentProfile(profile);
    setEditingIcpId(profile.id);
    setIsCreating(true);
  };

  // Delete Profile
  const deleteProfile = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this ICP profile?')) {
      return;
    }
    try {
      const response = await apiFetch(`/api/icps/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete ICP profile');
      }

      // Reload all ICPs from backend
      await loadICPs();
    } catch (error) {
      console.error('Error deleting profile:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete ICP profile. Check console for details.');
    }
  };

  // Show loading spinner while fetching
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <span className="ml-3 text-gray-600">Loading ICP profiles...</span>
        </div>
      </div>
    );
  }

  const readApiError = async (response: Response, fallback: string): Promise<string> => {
    const payload = await response.json().catch(() => null);
    if (payload && typeof payload.error === 'string') {
      return payload.error;
    }
    if (payload && typeof payload.message === 'string') {
      return payload.message;
    }
    return fallback;
  };

  const pollSearchStatus = async (
    icpId: string,
    source: SearchSource,
    jobId: string,
    maxAttempts = 15
  ): Promise<IcpSearchStatusResponse> => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await apiFetch(`/api/icps/${icpId}/search/status/${source}/${jobId}`);
      if (!response.ok) {
        const message = await readApiError(response, 'Failed to fetch ICP search job status');
        throw new Error(message);
      }

      const status = (await response.json()) as IcpSearchStatusResponse;
      if (status.state === 'completed' || status.state === 'failed') {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return {
      jobId,
      source,
      state: 'timeout',
    };
  };

  // Test profile with Apollo API
  const testProfile = async (profile: ICP) => {
    setIsTestingProfile(profile.id);
    setTestResults(null);
    const source: SearchSource = 'apollo';

    try {
      const response = await apiFetch(`/api/icps/${profile.id}/search`, {
        method: 'POST',
        body: JSON.stringify({
          source,
          page: 1,
          perPage: 10,
        })
      });

      if (!response.ok) {
        const message = await readApiError(response, 'Failed to queue ICP search job');
        throw new Error(message);
      }

      const queued = (await response.json()) as { jobId?: string };
      if (!queued.jobId) {
        throw new Error('Queued search job did not include a job ID');
      }

      setTestResults({
        profileId: profile.id,
        profileName: profile.name,
        source,
        jobId: queued.jobId,
        state: 'queued',
      });

      const finalStatus = await pollSearchStatus(profile.id, source, queued.jobId);
      setTestResults({
        profileId: profile.id,
        profileName: profile.name,
        source,
        jobId: queued.jobId,
        state: finalStatus.state,
        result: finalStatus.result,
        error: finalStatus.error,
      });
    } catch (error) {
      console.error('Error testing profile:', error);
      setTestResults({
        profileId: profile.id,
        profileName: profile.name,
        source,
        jobId: 'n/a',
        state: 'failed',
        error: error instanceof Error ? error.message : 'Failed to test profile',
      });
      alert(error instanceof Error ? error.message : 'Error testing profile. Check console for details.');
    } finally {
      setIsTestingProfile(null);
    }
  };

  
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header with button */}
      <div className="flex justify-between items-center">
        <div> 
        <h1 className="text-3xl font-bold text-gray-900">
          Ideal Customer Profiles
        </h1>
        <p className="text-gray-500">
          Define your ideal customer criteria. This helps target the right leads.
        </p>
        </div>
        {!isCreating && (
          <Button 
              onClick={() => setIsCreating(true)} 
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Create ICP
            </Button> 
        )}
      </div>
        
      {/*creating / edit form */ } 
      {isCreating && (
        <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingIcpId ? 'Edit ICP Profile' : 'Create New ICP Profile'}
            </h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className= "grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Profile Name *
                </label>
                <input
                  type="text"
                  value={currentProfile.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="E.g., SaaS Companies in North America"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Titles
                </label>
                <input
                  type="text"
                  value={currentProfile.criteria.jobTitles?.join(', ') || ''}
                  onChange={(e) => handleCriteriaChange('jobTitles', e.target.value)}
                  placeholder="E.g., CEO, CTO, Marketing Manager"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple job titles with commas.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industries
                </label>
                <input
                  type="text"
                  value={currentProfile.criteria.industries?.join(', ') || ''}
                  onChange={(e) => handleCriteriaChange('industries', e.target.value)}
                  placeholder="E.g., Technology, Healthcare, Finance"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple industries with commas.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Size
                </label>
                <input
                  type="text"
                  value={currentProfile.criteria.companySize?.join(', ') || ''}
                  onChange={(e) => handleCriteriaChange('companySize', e.target.value)}
                  placeholder="E.g., 1-10, 11-50, 51-200"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple sizes with commas.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Locations
                </label>
                <input
                  type="text"
                  value={currentProfile.criteria.locations?.join(', ') || ''}
                  onChange={(e) => handleCriteriaChange('locations', e.target.value)}
                  placeholder="E.g., North America, Europe, Asia"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple locations with commas.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Technologies Used
                </label>
                <input
                  type="text"
                  value={currentProfile.criteria.technologies?.join(', ') || ''}
                  onChange={(e) => handleCriteriaChange('technologies', e.target.value)}
                  placeholder="E.g., React, Node.js, AWS"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple technologies with commas.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords
                </label>
                <input
                  type="text"
                  value={currentProfile.criteria.keywords?.join(', ') || ''}
                  onChange={(e) => handleCriteriaChange('keywords', e.target.value)}
                  placeholder="E.g., Innovation, Growth, Customer Success"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple keywords with commas.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Funding Stage
                </label>
                <input
                  type="text"
                  value={currentProfile.criteria.fundingStages?.join(', ') || ''}
                  onChange={(e) => handleCriteriaChange('fundingStages', e.target.value)}
                  placeholder="E.g., Seed, Series A, Series B"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple funding stages with commas.
                </p>
              </div>    
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveProfile}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                <Save size={16} />
                {editingIcpId ? 'Update Profile' : 'Save Profile'}
              </button>
              <button
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel 
              </button>
            </div>
          </div>
      )}

      {/* Saved Profile Table */}
      {icpProfiles.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-700"> 
              Saved ICP Profile
            </h2> 
          </div>
          {testResults && (
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="text-sm font-medium text-gray-900">
                Last test: {testResults.profileName} ({testResults.source})
              </div>
              <div className="text-sm text-gray-600">
                Job {testResults.jobId} is <span className="font-medium">{testResults.state}</span>
              </div>
              {testResults.result && (
                <div className="text-sm text-gray-600">
                  Found {testResults.result.totalResults ?? 0} total, returned {testResults.result.returnedResults ?? 0}, created {testResults.result.createdLeads ?? 0}, skipped {testResults.result.skippedLeads ?? 0}.
                </div>
              )}
              {testResults.error && (
                <div className="text-sm text-red-600">
                  {testResults.error}
                </div>
              )}
            </div>
          )}
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profile Name</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Industries</TableHead>
                <TableHead>Company Size</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Technologies</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Funding Stages</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {icpProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{profile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(profile.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900 max-w-xs overflow-wrap">
                      {profile.criteria.jobTitles?.join(', ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900 max-w-xs overflow-wrap">
                      {profile.criteria.industries?.join(', ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900 max-w-xs overflow-wrap">
                      {profile.criteria.companySize?.join(', ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900 max-w-xs overflow-wrap">
                      {profile.criteria.locations?.join(', ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900 max-w-xs overflow-wrap">
                      {profile.criteria.technologies?.join(', ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900 max-w-xs overflow-wrap">
                      {profile.criteria.keywords?.join(', ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900 max-w-xs overflow-wrap">
                      {profile.criteria.fundingStages?.join(', ') || '-'}
                    </div>
                  </TableCell>                                   
                  <TableCell>
                    <div className="flex gap-2">
                      <button
                        onClick={() => testProfile(profile)}
                        className="text-gray-600 hover:text-gray-800 disabled:text-gray-400"
                        title='Test ICP Search'
                        disabled={Boolean(isTestingProfile)}
                      >
                        {isTestingProfile === profile.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Search size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => editProfile(profile)}
                        className="text-blue-600 hover:text-blue-800"
                        title='Edit Profile'
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteProfile(profile.id)}
                        className="text-red-600 hover:text-red-800"
                        title='Delete Profile'
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
      )}

      {/*Empty state */}
      {icpProfiles.length === 0 && !isCreating && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <Search size={48} className="mx-auto" />
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No ICP Profiles Yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first ideal customer profile to start targeted lead discovery
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Create Your First ICP Profile
          </button>
        </div>
      )}
    </div>
  );
}
