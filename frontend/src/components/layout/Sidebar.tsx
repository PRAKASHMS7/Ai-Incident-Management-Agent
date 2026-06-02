import React from 'react';
import { NavLink } from 'react-router-dom';
import { useIncidentStore } from '../../api/client';
import { 
  LayoutDashboard, 
  Brain, 
  Clock, 
  FileText, 
  Server, 
  Bell, 
  Send, 
  Network, 
  Activity, 
  AlertCircle,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { systemHealth } = useIncidentStore();

  const redisUp = systemHealth?.components?.redis?.status === 'healthy';
  const neo4jUp = systemHealth?.components?.neo4j?.status === 'healthy';
  const watchdogActive = systemHealth?.status === 'healthy';
  const allSystemsOperational = redisUp && neo4jUp && watchdogActive;

  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Incidents', path: '/incidents', icon: AlertCircle },
    { name: 'RCA Analysis', path: '/rca', icon: Brain },
    { name: 'Timeline', path: '/timeline', icon: Clock },
    { name: 'Post Mortems', path: '/postmortems', icon: FileText },
    { name: 'Services', path: '/services', icon: Server },
    { name: 'Alerts', path: '/alerts-list', icon: Bell },
    { name: 'Escalations', path: '/escalations', icon: Send },
    { name: 'Dependency Map', path: '/topology', icon: Network },
    { name: 'Health Dashboard', path: '/health', icon: Activity },
  ];

  return (
    <aside className="w-64 bg-[#081326]/95 border-r border-slate-800/80 flex flex-col py-6 px-4 z-20 h-screen select-none">
      {/* Brand logo section */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
          <Brain className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm text-slate-100 tracking-tight leading-tight">AI Incident</span>
          <span className="font-bold text-xs text-purple-400 tracking-wide leading-none">Management</span>
        </div>
      </div>

      {/* Main navigation list */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => {
              // Highlight Incidents route when active or on incident detail pages
              const isIncidentsActive = item.name === 'Incidents' && (isActive || window.location.pathname.startsWith('/incidents'));
              const isNormalActive = item.name !== 'Incidents' && isActive;
              const isCurrentActive = isIncidentsActive || isNormalActive;
              
              return `flex items-center gap-3 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group
                ${isCurrentActive
                  ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`;
            }}
          >
            {({ isActive }) => {
              const isIncidentsActive = item.name === 'Incidents' && (isActive || window.location.pathname.startsWith('/incidents'));
              const isNormalActive = item.name !== 'Incidents' && isActive;
              const isCurrentActive = isIncidentsActive || isNormalActive;
              const Icon = item.icon;
              
              return (
                <>
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-105 ${isCurrentActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                  <span>{item.name}</span>
                </>
              );
            }}
          </NavLink>
        ))}
      </nav>

      {/* System Health Card */}
      <div className="mt-auto border border-slate-800/80 rounded-2xl bg-[#0b1528] p-4 flex flex-col gap-3 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300"></div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">System Health</span>
        
        <div className="flex items-center gap-3 mt-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
            allSystemsOperational 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
          }`}>
            {allSystemsOperational ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-200 leading-tight">
              {allSystemsOperational ? 'All Systems' : 'Performance'}
            </span>
            <span className={`text-[10px] font-bold tracking-wide leading-none ${
              allSystemsOperational ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {allSystemsOperational ? 'Operational' : 'Degraded'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2.5 border-t border-slate-800/60 text-[9px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                allSystemsOperational ? 'bg-emerald-500' : 'bg-amber-500'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                allSystemsOperational ? 'bg-emerald-500' : 'bg-amber-500'
              }`}></span>
            </span>
            <span>Last checked</span>
          </div>
          <span className="font-mono">1m ago</span>
        </div>
      </div>
    </aside>
  );
};
