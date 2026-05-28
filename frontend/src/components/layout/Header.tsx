import React from 'react';
import { useIncidentStore } from '../../api/client';
import { Database, Activity, RefreshCw } from 'lucide-react';

export const Header: React.FC = () => {
  const { systemHealth, fetchSystemHealth, loading } = useIncidentStore();

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    fetchSystemHealth();
  };

  const redisUp = systemHealth?.components?.redis?.status === 'healthy';
  const neo4jUp = systemHealth?.components?.neo4j?.status === 'healthy';
  const watchdogActive = systemHealth?.status === 'healthy';

  return (
    <header className="h-16 bg-card/40 backdrop-blur-md border-b border-border flex items-center justify-between px-8 z-10">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-100 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          AI Incident Command Center
        </h1>
        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700">
          Agent Platform
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Watchdog status indicator */}
        <div className="flex items-center gap-2 bg-slate-900/60 border border-border px-3 py-1.5 rounded-lg text-xs">
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${watchdogActive ? 'bg-success' : 'bg-critical'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${watchdogActive ? 'bg-success' : 'bg-critical'}`}></span>
          </div>
          <span className="font-medium text-slate-300">Watchdog Heartbeat</span>
        </div>

        {/* Database connectivity indicators */}
        <div className="flex items-center gap-4 text-xs border-r border-border pr-6">
          <div className="flex items-center gap-1.5" title={`Redis: ${redisUp ? 'Connected' : 'Disconnected'}`}>
            <Database className={`w-3.5 h-3.5 ${redisUp ? 'text-success' : 'text-slate-500'}`} />
            <span className={redisUp ? 'text-slate-300' : 'text-slate-500'}>Redis</span>
          </div>
          <div className="flex items-center gap-1.5" title={`Neo4j: ${neo4jUp ? 'Connected' : 'Disconnected'}`}>
            <Activity className={`w-3.5 h-3.5 ${neo4jUp ? 'text-success' : 'text-slate-500'}`} />
            <span className={neo4jUp ? 'text-slate-300' : 'text-slate-500'}>Neo4j</span>
          </div>
        </div>

        {/* Manual refresh button */}
        <button 
          onClick={handleRefresh} 
          disabled={loading}
          className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-primary hover:border-primary/50 transition-colors disabled:opacity-50"
          title="Refresh connection states"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
};
