import React from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { HealthMetricsPanel } from '../components/health/HealthMetricsPanel';
import { Heart, Activity, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';

export const AgentHealthPage: React.FC = () => {
  const { systemHealth, fetchSystemHealth } = useIncidentStore();

  usePolling(fetchSystemHealth, 5000, []);

  const overallHealthy = systemHealth?.status === 'healthy';
  const redisHealth = systemHealth?.components?.redis;
  const neo4jHealth = systemHealth?.components?.neo4j;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-100">Agent Performance & System Health</h2>
        <p className="text-xs text-slate-400 mt-1">Monitor AI diagnostics health, API latencies, costs, and state engines connectivity.</p>
      </div>

      {/* Main Health Status Panel */}
      <div className="glass-panel p-6 rounded-xl border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/10">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-xl border flex items-center justify-center
            ${overallHealthy 
              ? 'bg-success/10 border-success/20 text-success' 
              : 'bg-critical/10 border-critical/20 text-critical'
            }
          `}>
            {overallHealthy ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-200">Watchdog Status:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                ${overallHealthy ? 'bg-success/25 text-success' : 'bg-critical/25 text-critical'}
              `}>
                {overallHealthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
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
        <div className="glass-panel p-5 rounded-xl border border-border flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Redis State Engine</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase
              ${redisHealth?.status === 'healthy' ? 'bg-success/20 text-success' : 'bg-critical/20 text-critical'}
            `}>
              {redisHealth?.status === 'healthy' ? 'UP' : 'DOWN'}
            </span>
          </div>
          <div className="flex flex-col gap-2 font-mono text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>Ping Status:</span>
              <span className="text-slate-200 font-semibold">{redisHealth?.status || 'unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Latency (Ping):</span>
              <span className="text-slate-200 font-semibold">{redisHealth?.latency_ms ? `${redisHealth.latency_ms.toFixed(2)} ms` : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Keys Tracked:</span>
              <span className="text-slate-200 font-semibold">{redisHealth?.keys_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Neo4j Health */}
        <div className="glass-panel p-5 rounded-xl border border-border flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Neo4j Topology DB</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase
              ${neo4jHealth?.status === 'healthy' ? 'bg-success/20 text-success' : 'bg-critical/20 text-critical'}
            `}>
              {neo4jHealth?.status === 'healthy' ? 'UP' : 'DOWN'}
            </span>
          </div>
          <div className="flex flex-col gap-2 font-mono text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>Ping Status:</span>
              <span className="text-slate-200 font-semibold">{neo4jHealth?.status || 'unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Latency (Ping):</span>
              <span className="text-slate-200 font-semibold">{neo4jHealth?.latency_ms ? `${neo4jHealth.latency_ms.toFixed(2)} ms` : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Nodes / Edges Count:</span>
              <span className="text-slate-200 font-semibold">Seeded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Observability Statistics graphs */}
      <HealthMetricsPanel />
    </div>
  );
};
