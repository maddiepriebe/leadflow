import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    qualifiedLeads: 0,
    totalMessages: 0,
    conversionRate: 0
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get('/api/analytics/dashboard');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Analytics</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-gray-500 text-sm font-medium">Total Leads</h3>
          <p className="text-3xl font-bold mt-2">{stats.totalLeads}</p>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-gray-500 text-sm font-medium">Qualified</h3>
          <p className="text-3xl font-bold mt-2">{stats.qualifiedLeads}</p>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-gray-500 text-sm font-medium">Messages</h3>
          <p className="text-3xl font-bold mt-2">{stats.totalMessages}</p>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-gray-500 text-sm font-medium">Conversion</h3>
          <p className="text-3xl font-bold mt-2">
            {stats.conversionRate.toFixed(1)}%
          </p>
        </div>
      </div>
      
      <div className="bg-white shadow sm:rounded-lg p-6">
        <p className="text-gray-500">Charts and graphs will go here.</p>
      </div>
    </div>
  );
}