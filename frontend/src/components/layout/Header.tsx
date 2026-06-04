import React, { useState, useEffect } from 'react';
import { useIncidentStore } from '../../api/client';
import { 
  Brain, 
  Moon, 
  Sun,
  RefreshCw, 
  Database,
  Activity,
  LogOut
} from 'lucide-react';

export const Header: React.FC = () => {
  const { systemHealth, fetchSystemHealth, loading } = useIncidentStore();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    fetchSystemHealth();
  };

  const handleLogout = () => {
    localStorage.removeItem('demo-auth');
    localStorage.removeItem('username');
    window.location.href = '/login';
  };

  const redisUp = systemHealth?.components?.redis?.status === 'healthy';
  const neo4jUp = systemHealth?.components?.neo4j?.status === 'healthy';
  const watchdogActive = systemHealth?.status === 'healthy';

  const rawUsername = localStorage.getItem('username');
  const displayUsername = rawUsername && rawUsername.trim() ? rawUsername : 'Guest';
  const avatarLetter = rawUsername && rawUsername.trim() ? rawUsername.trim().charAt(0).toUpperCase() : 'G';

  return (
    <>
      <style>{`
        /* Light mode overrides */
        html.light body,
        html.light #root,
        html.light main,
        html.light .bg-background,
        html.light [class*="bg-[#050816]"] {
          background-color: #f1f5f9 !important;
          color: #1e293b !important;
        }

        html.light header,
        html.light [class*="bg-[#0B1020]"],
        html.light [class*="bg-[#090e1c]"],
        html.light [class*="bg-[#070D19]"],
        html.light [class*="bg-[#0D1830]"],
        html.light [class*="bg-[#0b1222]"],
        html.light [class*="bg-[#0b0f19]"],
        html.light [class*="bg-[#0e1322]"] {
          background-color: #ffffff !important;
          background-image: none !important;
          color: #1e293b !important;
        }

        html.light aside,
        html.light [class*="bg-[#081326]"],
        html.light [class*="bg-[#0b1528]"] {
          background-color: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }

        html.light .glass-card,
        html.light .kpi-card,
        html.light .incident-list-card,
        html.light .escalation-container,
        html.light .timeline-stream-container,
        html.light .rca-report-container,
        html.light .timeline-event-card,
        html.light .timeline-event-card-latest,
        html.light .hypothesis-glow-card,
        html.light [class*="border-slate-800"],
        html.light [class*="border-slate-850"] {
          background: #ffffff !important;
          background-color: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #1e293b !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05) !important;
        }

        html.light input,
        html.light select,
        html.light textarea {
          background-color: #ffffff !important;
          color: #1e293b !important;
          border-color: #cbd5e1 !important;
        }

        html.light .text-slate-100,
        html.light .text-slate-200,
        html.light .text-slate-300 {
          color: #1e293b !important;
        }

        html.light .text-slate-400,
        html.light .text-slate-500 {
          color: #475569 !important;
        }

        html.light .text-purple-400 {
          color: #7c3aed !important;
        }

        html.light .bg-purple-600\\/10 {
          background-color: rgba(124, 58, 237, 0.1) !important;
        }

        html.light .border-purple-500\\/30 {
          border-color: rgba(124, 58, 237, 0.3) !important;
        }

        html.light .hover\\:bg-slate-850:hover {
          background-color: #f1f5f9 !important;
        }

        html.light .hover\\:text-slate-200:hover {
          color: #0f172a !important;
        }

        html.light ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        html.light ::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
        }
        html.light ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }
      `}</style>
      <header className="h-20 bg-[#0B1020]/90 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between px-8 z-20 select-none">
        {/* Branding Section (Left Side) */}
        <div className="flex items-center gap-4 shrink-0 animate-fade-in">
          <div className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.2)]">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center">
              <h1 className="text-[19px] font-black tracking-tight text-slate-100 bg-gradient-to-r from-purple-400 via-purple-300 to-sky-400 bg-clip-text text-transparent font-sans leading-none drop-shadow-[0_0_12px_rgba(168,85,247,0.35)]">
                AI Incident Management
              </h1>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">
              AI-Powered SRE Command Center
            </span>
          </div>
        </div>

        {/* Global Controls & Diagnostic indicators (Right Side) */}
        <div className="flex items-center gap-6">
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
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
          </div>

          {/* Prakash Profile card */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-850">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-slate-200 leading-tight">
                {displayUsername}
              </span>
            </div>
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-purple-600/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-xs shadow-md">
                {avatarLetter}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-navyDark"></span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 ml-1 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
