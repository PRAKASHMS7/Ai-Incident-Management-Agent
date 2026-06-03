import React, { useState, useCallback } from 'react';
import { api, useIncidentStore, usePolling } from '../api/client';
import { HealthMetricsPanel } from '../components/health/HealthMetricsPanel';
import { CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { DashboardMetrics } from '../api/types';

export const AgentHealthPage: React.FC = () => {
  const { systemHealth, fetchSystemHealth } = useIncidentStore();
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | undefined>(undefined);

  const fetchDashboardMetrics = useCallback(async () => {
    try {
      const res = await api.get<DashboardMetrics>('/dashboard/metrics');
      setDashboardMetrics(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
    }
  }, []);

  usePolling(fetchSystemHealth, 5000, []);
  usePolling(fetchDashboardMetrics, 5000, []);

  const overallHealthy = systemHealth?.status === 'healthy';
  const redisHealth = systemHealth?.components?.redis;
  const neo4jHealth = systemHealth?.components?.neo4j;

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Header */}
      <div className="bg-[#0D1830]/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg">
        <div className="flex flex-col gap-1 z-10">
          <h2 className="text-lg font-extrabold font-sans tracking-tight">Agent Performance & System Health</h2>
          <p className="text-xs text-slate-400 mt-0.5">Monitor AI diagnostics health, API latencies, costs, and state engines connectivity.</p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0">
          <Cpu className="w-5 h-5" />
        </div>
      </div>

      {/* Main Health Status Panel */}
      <div className="border border-slate-800 rounded-2xl bg-[#0D1830]/80 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300"></div>
        <div className="flex items-center gap-4 z-10">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all ${
            overallHealthy 
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-450 shadow-[0_0_16px_rgba(16,185,129,0.15)]' 
              : 'bg-rose-500/10 border-rose-500/25 text-rose-455 shadow-[0_0_16px_rgba(239,68,68,0.15)]'
          }`}>
            {overallHealthy ? <CheckCircle2 className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-200">Watchdog Status:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border
                ${overallHealthy 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-450'}
              `}>
                {overallHealthy ? 'Healthy' : 'Degraded'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {overallHealthy 
                ? 'All background services and database nodes are communicating correctly.' 
                : 'Degraded operations detected. Verify backing database container logs.'}
            </p>
          </div>
        </div>
      </div>

      {/* Component Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Redis Health */}
        <div className="border border-slate-800 rounded-2xl bg-[#0D1830]/80 p-5 flex flex-col gap-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Redis State Engine</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border
              ${redisHealth?.status === 'healthy' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-455'}
            `}>
              {redisHealth?.status === 'healthy' ? 'UP' : 'DOWN'}
            </span>
          </div>
          <div className="flex flex-col gap-2.5 font-mono text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>Ping Status:</span>
              <span className="text-slate-200 font-semibold">{redisHealth?.status || 'unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Latency (Ping):</span>
              <span className="text-slate-250 font-bold">{redisHealth?.latency_ms ? `${redisHealth.latency_ms.toFixed(2)} ms` : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Keys Tracked:</span>
              <span className="text-slate-200 font-semibold">{redisHealth?.keys_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Neo4j Health */}
        <div className="border border-slate-800 rounded-2xl bg-[#0D1830]/80 p-5 flex flex-col gap-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Neo4j Topology DB</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border
              ${neo4jHealth?.status === 'healthy' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-455'}
            `}>
              {neo4jHealth?.status === 'healthy' ? 'UP' : 'DOWN'}
            </span>
          </div>
          <div className="flex flex-col gap-2.5 font-mono text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>Ping Status:</span>
              <span className="text-slate-200 font-semibold">{neo4jHealth?.status || 'unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Latency (Ping):</span>
              <span className="text-slate-250 font-bold">{neo4jHealth?.latency_ms ? `${neo4jHealth.latency_ms.toFixed(2)} ms` : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Nodes / Edges Count:</span>
              <span className="text-slate-200 font-semibold">Seeded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Observability Statistics graphs */}
      <HealthMetricsPanel metrics={dashboardMetrics} />
    </div>
  );
};
