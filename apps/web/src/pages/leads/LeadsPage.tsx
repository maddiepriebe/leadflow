import * as React from 'react';
import { useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { Lead } from '@leadflow/types';
import { Button } from '@leadflow/ui';

export default function LeadsPage() {
  // STATE: Data that can change
  const [leads, setLeads] = useState<Lead[]>([]);  // Empty array initially
  const [loading, setLoading] = useState(true);     // Show loading spinner

  // EFFECT: Run when component loads
  useEffect(() => {
    fetchLeads();
  }, []);  // Empty array = run once on mount

  // FUNCTION: Fetch leads from API
  const fetchLeads = async () => {
    try {
      // Make GET request to backend
      const response = await axios.get('/api/leads');
      setLeads(response.data);  // Update state with data
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);  // Hide loading spinner
    }
  };

  // CONDITIONAL RENDERING: Show different UI based on state
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading leads...</div>
      </div>
    );
  }

  // MAIN UI
  return (
    <div>
      {/* Header with button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
        <Button onClick={() => alert('Add lead clicked')}>
          Add Lead
        </Button>
      </div>
      
      {/* Leads list */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {leads.length === 0 ? (
          <p className="p-6 text-gray-500 text-center">
            No leads yet. Add your first lead to get started!
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {leads.map((lead) => (
              <li 
                key={lead.id} 
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {lead.firstName} {lead.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{lead.email}</p>
                    {lead.company && (
                      <p className="text-sm text-gray-500">
                        {lead.company} - {lead.position}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {/* Status badge */}
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      lead.status === 'qualified' ? 'bg-green-100 text-green-800' :
                      lead.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {lead.status}
                    </span>
                    
                    {/* Score */}
                    {lead.score && (
                      <span className="text-sm font-medium text-gray-900">
                        Score: {lead.score}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}