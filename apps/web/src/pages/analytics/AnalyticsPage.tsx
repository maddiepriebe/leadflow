import { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  MessageCircle,
  TrendingUp,
  Mail,
  Send,
  ArrowUp,
  ArrowDown,
  Activity,
  Target,
  Clock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ==========================================
// TYPES
// ==========================================

interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  totalMessages: number;
  conversionRate: number;
}

interface SequenceStats {
  totalSequences: number;
  activeSequences: number;
  totalEnrollments: number;
  completedEnrollments: number;
}

interface MessageStats {
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  byChannel: Record<string, number>;
}

interface LeadsByStatus {
  status: string;
  count: number;
}

// ==========================================
// STAT CARD COMPONENT
// ==========================================

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: number;
  subtitle?: string;
  color?: string;
}

function StatCard({ title, value, icon, trend, subtitle, color = 'bg-white' }: StatCardProps) {
  return (
    <div className={`${color} shadow rounded-lg p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className="flex items-center mt-2">
              {trend >= 0 ? (
                <ArrowUp className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm ml-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(trend)}% from last period
              </span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-full bg-gray-100">{icon}</div>
      </div>
    </div>
  );
}

// ==========================================
// PROGRESS BAR COMPONENT
// ==========================================

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

function ProgressBar({ label, value, max, color }: ProgressBarProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">
          {value} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`${color} h-2.5 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    qualifiedLeads: 0,
    totalMessages: 0,
    conversionRate: 0,
  });
  const [sequenceStats, setSequenceStats] = useState<SequenceStats>({
    totalSequences: 0,
    activeSequences: 0,
    totalEnrollments: 0,
    completedEnrollments: 0,
  });
  const [messageStats, setMessageStats] = useState<MessageStats>({
    totalMessages: 0,
    inboundMessages: 0,
    outboundMessages: 0,
    byChannel: {},
  });
  const [leadsByStatus, setLeadsByStatus] = useState<LeadsByStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllAnalytics();
  }, []);

  const fetchAllAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch all stats in parallel
      const [dashboardRes, sequencesRes, inboxRes, leadsRes] = await Promise.all([
        apiFetch('/api/analytics/dashboard'),
        apiFetch('/api/analytics/sequences'),
        apiFetch('/api/inbox/stats'),
        apiFetch('/api/analytics/leads-by-status'),
      ]);

      if (dashboardRes.ok) {
        const dashboardData = await dashboardRes.json();
        setStats(dashboardData);
      }

      if (sequencesRes.ok) {
        const sequenceData = await sequencesRes.json();
        setSequenceStats(sequenceData);
      }

      if (inboxRes.ok) {
        const inboxData = await inboxRes.json();
        setMessageStats(inboxData);
      }

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeadsByStatus(leadsData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate derived metrics
  const responseRate =
    messageStats.outboundMessages > 0
      ? ((messageStats.inboundMessages / messageStats.outboundMessages) * 100).toFixed(1)
      : '0';

  const sequenceCompletionRate =
    sequenceStats.totalEnrollments > 0
      ? ((sequenceStats.completedEnrollments / sequenceStats.totalEnrollments) * 100).toFixed(1)
      : '0';

  const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-500',
    contacted: 'bg-yellow-500',
    qualified: 'bg-green-500',
    unqualified: 'bg-red-500',
    converted: 'bg-purple-500',
  };

  const CHANNEL_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    whatsapp: { label: 'WhatsApp', color: 'bg-green-500', icon: <MessageCircle className="h-4 w-4" /> },
    email: { label: 'Email', color: 'bg-blue-500', icon: <Mail className="h-4 w-4" /> },
    instagram: { label: 'Instagram', color: 'bg-pink-500', icon: <Send className="h-4 w-4" /> },
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track your sales performance and lead engagement</p>
        </div>
        <button
          onClick={fetchAllAnalytics}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-gray-700"
        >
          <Activity className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Leads"
          value={stats.totalLeads}
          icon={<Users className="h-6 w-6 text-blue-600" />}
          subtitle="All leads in system"
        />
        <StatCard
          title="Qualified Leads"
          value={stats.qualifiedLeads}
          icon={<UserCheck className="h-6 w-6 text-green-600" />}
          subtitle={`${stats.conversionRate.toFixed(1)}% of total`}
        />
        <StatCard
          title="Total Messages"
          value={stats.totalMessages}
          icon={<MessageCircle className="h-6 w-6 text-purple-600" />}
          subtitle={`${messageStats.inboundMessages} inbound, ${messageStats.outboundMessages} outbound`}
        />
        <StatCard
          title="Response Rate"
          value={`${responseRate}%`}
          icon={<TrendingUp className="h-6 w-6 text-orange-600" />}
          subtitle="Inbound / Outbound"
        />
      </div>

      {/* Sequence Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Sequences"
          value={sequenceStats.activeSequences}
          icon={<Activity className="h-6 w-6 text-blue-600" />}
          subtitle={`of ${sequenceStats.totalSequences} total`}
        />
        <StatCard
          title="Leads in Sequences"
          value={sequenceStats.totalEnrollments}
          icon={<Target className="h-6 w-6 text-indigo-600" />}
          subtitle="Currently enrolled"
        />
        <StatCard
          title="Completed Sequences"
          value={sequenceStats.completedEnrollments}
          icon={<Clock className="h-6 w-6 text-green-600" />}
          subtitle={`${sequenceCompletionRate}% completion rate`}
        />
        <StatCard
          title="Conversion Rate"
          value={`${stats.conversionRate.toFixed(1)}%`}
          icon={<TrendingUp className="h-6 w-6 text-emerald-600" />}
          subtitle="Leads → Qualified"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Leads by Status */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            Leads by Status
          </h3>
          {leadsByStatus.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No lead data available</p>
          ) : (
            <div className="space-y-2">
              {leadsByStatus.map((item) => (
                <ProgressBar
                  key={item.status}
                  label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  value={item.count}
                  max={stats.totalLeads}
                  color={STATUS_COLORS[item.status] || 'bg-gray-500'}
                />
              ))}
            </div>
          )}
        </div>

        {/* Messages by Channel */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-gray-500" />
            Messages by Channel
          </h3>
          {Object.keys(messageStats.byChannel).length === 0 ? (
            <p className="text-gray-500 text-center py-8">No message data available</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(messageStats.byChannel).map(([channel, count]) => {
                const config = CHANNEL_CONFIG[channel] || {
                  label: channel,
                  color: 'bg-gray-500',
                  icon: <Mail className="h-4 w-4" />,
                };
                return (
                  <div key={channel} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${config.color} text-white`}>
                        {config.icon}
                      </div>
                      <span className="font-medium">{config.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{count}</span>
                      <span className="text-gray-500 text-sm ml-2">
                        ({((count / messageStats.totalMessages) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-500" />
          Performance Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-4xl font-bold text-blue-600">{stats.totalLeads}</div>
            <div className="text-gray-600 mt-1">Total Leads</div>
            <div className="text-sm text-gray-500 mt-2">
              {stats.qualifiedLeads} qualified ({stats.conversionRate.toFixed(1)}%)
            </div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-4xl font-bold text-green-600">{messageStats.totalMessages}</div>
            <div className="text-gray-600 mt-1">Messages Sent/Received</div>
            <div className="text-sm text-gray-500 mt-2">
              {responseRate}% response rate
            </div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-4xl font-bold text-purple-600">{sequenceStats.totalEnrollments}</div>
            <div className="text-gray-600 mt-1">Sequence Enrollments</div>
            <div className="text-sm text-gray-500 mt-2">
              {sequenceCompletionRate}% completed
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
