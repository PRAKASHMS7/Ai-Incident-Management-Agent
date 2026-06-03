import React from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Cpu, CircleDollarSign, Clock, CheckCircle2, Activity, AlertTriangle } from 'lucide-react';
import { DashboardMetrics } from '../../api/types';

const mockLatencyData = [
  { day: 'Mon', latency: 450, cost: 0.12 },
  { day: 'Tue', latency: 510, cost: 0.15 },
  { day: 'Wed', latency: 420, cost: 0.11 },
  { day: 'Thu', latency: 380, cost: 0.09 },
  { day: 'Fri', latency: 620, cost: 0.22 },
  { day: 'Sat', latency: 390, cost: 0.10 },
  { day: 'Sun', latency: 410, cost: 0.11 }
];

interface HealthMetricsPanelProps {
  metrics?: DashboardMetrics;
}

export const HealthMetricsPanel: React.FC<HealthMetricsPanelProps> = ({ metrics }) => {
  return (
    <div className="flex flex-col gap-6">
      
      {/* 6 Stats Cards Grid (3 Columns on Large Screens) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Metric 1 */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Analysis Accuracy</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">97.8%</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-success/10 rounded-xl border border-success/20 text-success">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Mean Time to Triage</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">42 secs</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-warning/10 rounded-xl border border-warning/20 text-warning">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">LLM Concurrency</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">2 / 10</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-info/10 rounded-xl border border-info/20 text-info">
            <CircleDollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Daily LLM API Cost</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">$0.80</p>
          </div>
        </div>

        {/* Metric 5 - Incidents Detected / Hour */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-info/10 rounded-xl border border-info/20 text-info">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">INCIDENTS DETECTED / HOUR</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">{metrics?.incidents_detected_per_hour ?? 0}</p>
            <p className="text-[9.5px] text-slate-400 mt-0.5 font-medium leading-none">Real-time detection throughput</p>
          </div>
        </div>

        {/* Metric 6 - False Positive Rate */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-warning/10 rounded-xl border border-warning/20 text-warning">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">FALSE POSITIVE RATE</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">
              {metrics?.false_positive_rate !== undefined 
                ? `${(metrics.false_positive_rate * 100).toFixed(1)}%` 
                : '5.0%'}
              <span className="text-[10px] text-slate-400 font-semibold ml-1.5">(est.)</span>
            </p>
            <p className="text-[9.5px] text-slate-400 mt-0.5 font-medium leading-none">Estimated detection quality metric</p>
          </div>
        </div>

      </div>

      {/* Latency and API Cost Trends graph */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Latency Area Chart */}
        <div className="glass-panel p-5 rounded-xl border border-border flex flex-col gap-4">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
              LLM Inference Latency Trend
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Average execution latency of Llama 3.1 70B via Groq API</p>
          </div>

          <div className="h-56 w-full text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockLatencyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis unit="ms" stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                  labelClassName="text-slate-400"
                />
                <Area type="monotone" dataKey="latency" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLatency)" name="Latency (ms)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* API Cost Area Chart */}
        <div className="glass-panel p-5 rounded-xl border border-border flex flex-col gap-4">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
              Token Expenditure Trend
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Daily reasoning engine usage cost mapping based on token volume</p>
          </div>

          <div className="h-56 w-full text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockLatencyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis unit="$" stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                  labelClassName="text-slate-400"
                />
                <Area type="monotone" dataKey="cost" stroke="#10b981" fillOpacity={1} fill="url(#colorCost)" name="Tokens Cost" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
