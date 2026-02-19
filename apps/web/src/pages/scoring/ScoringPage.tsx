import { useState, useEffect } from 'react';
import {
  Brain,
  Users,
  Target,
  TrendingUp,
  Activity,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Zap,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { apiFetch, apiPost } from '@/lib/api';

// ==========================================
// TYPES
// ==========================================

interface ScoringModel {
  version: number;
  isActive: boolean;
  totalScored: number;
  totalConverted: number;
  avgConvertedScore: number;
  weights: Record<string, number>;
  createdAt: string;
}

interface TrainingStatus {
  currentModel: ScoringModel;
  retraining: {
    shouldRetrain: boolean;
    reason: string;
  };
  topPredictiveFactors: FactorAnalysis[];
  bottomPredictiveFactors: FactorAnalysis[];
}

interface FactorAnalysis {
  factor: string;
  convertedAvg: number;
  nonConvertedAvg: number;
  lift: number;
  sampleSize: number;
}

interface ScoreDistribution {
  range: string;
  count: number;
  percentage: number;
}

interface ConversionsByRange {
  range: string;
  min: number;
  max: number;
  totalLeads: number;
  conversions: number;
  rate: number;
}

interface TopLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  currentScore: number | null;
  status: string;
  source: string;
}

interface ScoringAnalytics {
  scoreDistribution: ScoreDistribution[];
  conversionsByRange: ConversionsByRange[];
  conversionStats: {
    totalConversions: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    conversionRate: number;
  };
}

// ==========================================
// STAT CARD COMPONENT
// ==========================================

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  color?: string;
}

function StatCard({ title, value, icon, subtitle, color = 'bg-white' }: StatCardProps) {
  return (
    <div className={`${color} shadow rounded-lg p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
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
  showPercentage?: boolean;
}

function ProgressBar({ label, value, max, color, showPercentage = true }: ProgressBarProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">
          {value} {showPercentage && `(${percentage.toFixed(1)}%)`}
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
// FACTOR ROW COMPONENT
// ==========================================

interface FactorRowProps {
  factor: FactorAnalysis;
  isPositive: boolean;
}

function FactorRow({ factor, isPositive }: FactorRowProps) {
  const formatFactorName = (name: string) => {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        {isPositive ? (
          <ChevronUp className="h-5 w-5 text-green-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-red-500" />
        )}
        <span className="font-medium">{formatFactorName(factor.factor)}</span>
      </div>
      <div className="text-right">
        <span
          className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}
        >
          {factor.lift > 0 ? '+' : ''}
          {(factor.lift * 100).toFixed(0)}%
        </span>
        <span className="text-gray-500 text-sm ml-2">lift</span>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function ScoringPage() {
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null);
  const [analytics, setAnalytics] = useState<ScoringAnalytics | null>(null);
  const [topLeads, setTopLeads] = useState<TopLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTraining, setIsTraining] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, analyticsRes, leadsRes] = await Promise.all([
        apiFetch('/api/scoring/model/status'),
        apiFetch('/api/scoring/analytics'),
        apiFetch('/api/scoring/top-leads?limit=10'),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setTrainingStatus(data);
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setTopLeads(data);
      }
    } catch (error) {
      console.error('Error fetching scoring data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrainModel = async () => {
    setIsTraining(true);
    try {
      await apiPost('/api/scoring/model/train', { force: true });
      await fetchAllData();
    } catch (error) {
      console.error('Error training model:', error);
    } finally {
      setIsTraining(false);
    }
  };

  const handleRescoreAll = async () => {
    setIsRescoring(true);
    try {
      await apiPost('/api/scoring/rescore');
      await fetchAllData();
    } catch (error) {
      console.error('Error rescoring leads:', error);
    } finally {
      setIsRescoring(false);
    }
  };

  const RANGE_COLORS: Record<string, string> = {
    '0-20': 'bg-red-500',
    '21-40': 'bg-orange-500',
    '41-60': 'bg-yellow-500',
    '61-80': 'bg-blue-500',
    '81-100': 'bg-green-500',
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading scoring data...</div>
      </div>
    );
  }

  const model = trainingStatus?.currentModel;
  const conversionRate = model && model.totalScored > 0
    ? ((model.totalConverted / model.totalScored) * 100).toFixed(1)
    : '0';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead Scoring</h1>
          <p className="text-gray-500 mt-1">
            AI-powered lead scoring with automatic improvement
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAllData}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleRescoreAll}
            disabled={isRescoring}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {isRescoring ? 'Rescoring...' : 'Rescore All'}
          </button>
          <button
            onClick={handleTrainModel}
            disabled={isTraining}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Brain className="h-4 w-4" />
            {isTraining ? 'Training...' : 'Train Model'}
          </button>
        </div>
      </div>

      {/* Model Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Model Version"
          value={`v${model?.version || 1}`}
          icon={<Brain className="h-6 w-6 text-purple-600" />}
          subtitle={model?.isActive ? 'Active' : 'Inactive'}
        />
        <StatCard
          title="Leads Scored"
          value={model?.totalScored || 0}
          icon={<Users className="h-6 w-6 text-blue-600" />}
          subtitle="Total scored leads"
        />
        <StatCard
          title="Conversions"
          value={model?.totalConverted || 0}
          icon={<Target className="h-6 w-6 text-green-600" />}
          subtitle={`${conversionRate}% conversion rate`}
        />
        <StatCard
          title="Avg Converted Score"
          value={model?.avgConvertedScore?.toFixed(1) || '0'}
          icon={<TrendingUp className="h-6 w-6 text-orange-600" />}
          subtitle="Average score of converted leads"
        />
      </div>

      {/* Retraining Status */}
      {trainingStatus?.retraining && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            trainingStatus.retraining.shouldRetrain
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          {trainingStatus.retraining.shouldRetrain ? (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <span className="font-medium text-yellow-800">
                  Retraining recommended:
                </span>{' '}
                <span className="text-yellow-700">
                  {trainingStatus.retraining.reason}
                </span>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <span className="font-medium text-green-800">Model is up to date:</span>{' '}
                <span className="text-green-700">
                  {trainingStatus.retraining.reason}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Score Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-500" />
            Score Distribution
          </h3>
          {analytics?.scoreDistribution && analytics.scoreDistribution.length > 0 ? (
            <div className="space-y-2">
              {analytics.scoreDistribution.map((item) => (
                <ProgressBar
                  key={item.range}
                  label={item.range}
                  value={item.count}
                  max={model?.totalScored || 100}
                  color={RANGE_COLORS[item.range] || 'bg-gray-500'}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No distribution data available</p>
          )}
        </div>

        {/* Conversions by Score Range */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-gray-500" />
            Conversion Rate by Score
          </h3>
          {analytics?.conversionsByRange && analytics.conversionsByRange.length > 0 ? (
            <div className="space-y-3">
              {analytics.conversionsByRange.map((item) => (
                <div
                  key={item.range}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        RANGE_COLORS[item.range] || 'bg-gray-500'
                      }`}
                    />
                    <span className="font-medium">Score {item.range}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg">{item.rate}%</span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({item.conversions}/{item.totalLeads})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No conversion data available</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Predictive Factors */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ChevronUp className="h-5 w-5 text-green-500" />
            Top Predictive Factors
          </h3>
          {trainingStatus?.topPredictiveFactors &&
          trainingStatus.topPredictiveFactors.length > 0 ? (
            <div className="space-y-2">
              {trainingStatus.topPredictiveFactors.map((factor) => (
                <FactorRow key={factor.factor} factor={factor} isPositive={true} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Not enough conversion data to analyze
            </p>
          )}
        </div>

        {/* Bottom Predictive Factors */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ChevronDown className="h-5 w-5 text-red-500" />
            Least Predictive Factors
          </h3>
          {trainingStatus?.bottomPredictiveFactors &&
          trainingStatus.bottomPredictiveFactors.length > 0 ? (
            <div className="space-y-2">
              {trainingStatus.bottomPredictiveFactors.map((factor) => (
                <FactorRow key={factor.factor} factor={factor} isPositive={false} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Not enough conversion data to analyze
            </p>
          )}
        </div>
      </div>

      {/* Top Leads to Contact */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Top Leads to Contact
        </h3>
        {topLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-500 text-sm border-b">
                  <th className="pb-3 font-medium">Lead</th>
                  <th className="pb-3 font-medium">Company</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {topLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-b-0">
                    <td className="py-3">
                      <div>
                        <div className="font-medium">
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{lead.email}</div>
                      </div>
                    </td>
                    <td className="py-3 text-gray-600">{lead.company || '-'}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                          (lead.currentScore || 0) >= 70
                            ? 'bg-green-100 text-green-800'
                            : (lead.currentScore || 0) >= 40
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {lead.currentScore || 0}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="capitalize text-gray-600">{lead.status}</span>
                    </td>
                    <td className="py-3 text-gray-600">{lead.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No leads have been scored yet</p>
        )}
      </div>

      {/* Model Weights */}
      {model?.weights && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-500" />
            Current Model Weights
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(model.weights).map(([factor, weight]) => {
              const formatFactorName = (name: string) => {
                return name
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase())
                  .trim();
              };

              return (
                <div key={factor} className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">
                    {formatFactorName(factor)}
                  </div>
                  <div className="text-xl font-bold text-gray-800">{weight}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
