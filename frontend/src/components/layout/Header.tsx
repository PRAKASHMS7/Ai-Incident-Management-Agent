import React from 'react';
import { useIncidentStore } from '../../api/client';
import { 
  Brain, 
  Search, 
  Moon, 
  Bell, 
  RefreshCw, 
  Database,
  Activity
} from 'lucide-react';

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
    <header className="h-20 bg-[#0B1020]/90 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between px-8 z-20 select-none">
      {/* Branding Section (Left Side) */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.2)]">
          <Brain className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-100 bg-gradient-to-r from-purple-400 via-purple-300 to-sky-400 bg-clip-text text-transparent font-sans leading-none">
              AI Incident Management
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-extrabold uppercase tracking-widest">
              SaaS Enterprise
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            AI-Powered SRE Command Center
          </span>
        </div>
      </div>

      {/* Global Controls & Diagnostic indicators (Right Side) */}
      <div className="flex items-center gap-6">
        {/* Search bar */}
        <div className="relative w-64 hidden xl:block">
          <input 
            type="text" 
            placeholder="Search incidents..."
            className="w-full bg-[#050816] border border-slate-800 rounded-xl py-2 pl-8 pr-12 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/40"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
          <span className="absolute right-2 top-2 bg-[#0B1020] border border-slate-800 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-500 font-mono">Ctrl + K</span>
        </div>

        {/* Dynamic Diagnostics indicators (Redis, Neo4j, Watchdog) */}
        <div className="flex items-center gap-4 bg-[#050816]/75 border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] text-slate-400 font-semibold shadow-inner">
          {/* Watchdog status */}
          <div className="flex items-center gap-1.5" title={`Watchdog Heartbeat: ${watchdogActive ? 'Active' : 'Offline'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${watchdogActive ? 'bg-emerald-500 status-pulse-green' : 'bg-rose-500'}`}></span>
            <span>Watchdog</span>
          </div>
          <span className="text-slate-800">|</span>

          {/* Redis status */}
          <div className="flex items-center gap-1.5" title={`Redis Store: ${redisUp ? 'Connected' : 'Offline'}`}>
            <Database className={`w-3 h-3 ${redisUp ? 'text-emerald-500' : 'text-rose-500'}`} />
            <span>Redis</span>
          </div>
          <span className="text-slate-800">|</span>

          {/* Neo4j status */}
          <div className="flex items-center gap-1.5" title={`Neo4j Topology: ${neo4jUp ? 'Connected' : 'Offline'}`}>
            <Activity className={`w-3 h-3 ${neo4jUp ? 'text-emerald-500' : 'text-rose-500'}`} />
            <span>Neo4j</span>
          </div>

          {/* Force manual refresh */}
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="p-1 rounded bg-[#0b0f19] border border-slate-800 text-slate-400 hover:text-purple-400 hover:border-purple-500/30 transition-all disabled:opacity-50 ml-1.5"
            title="Force diagnostic check"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Global toggles controls */}
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-colors">
            <Moon className="w-4.5 h-4.5" />
          </button>

          <button className="p-2 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-colors relative">
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-rose-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center border border-navyDark shadow-md">
              8
            </span>
          </button>
        </div>

        {/* Prakash Profile card */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-850 cursor-pointer hover:opacity-90 transition-opacity">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-200 leading-tight">Prakash</span>
            <span className="text-[9px] font-bold text-slate-500 tracking-widest leading-none mt-1">SRE OPERATOR</span>
          </div>
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-purple-600/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-xs shadow-md">
              P
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-navyDark"></span>
          </div>
        </div>
      </div>
    </header>
  );
};
