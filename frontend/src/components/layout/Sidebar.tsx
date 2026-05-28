import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, HeartPulse, Network, ShieldAlert } from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-20 bg-card border-r border-border flex flex-col items-center py-6 gap-8 z-10">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary">
        <ShieldAlert className="w-7 h-7" />
      </div>
      
      <nav className="flex-1 flex flex-col gap-6 w-full px-2">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200 gap-1 group
            ${isActive 
              ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(59,130,246,0.2)]' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-medium tracking-wide">Triage</span>
        </NavLink>

        <NavLink 
          to="/topology" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200 gap-1 group
            ${isActive 
              ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(59,130,246,0.2)]' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`
          }
        >
          <Network className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-medium tracking-wide">Graph</span>
        </NavLink>

        <NavLink 
          to="/health" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200 gap-1 group
            ${isActive 
              ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(59,130,246,0.2)]' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`
          }
        >
          <HeartPulse className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-medium tracking-wide">Health</span>
        </NavLink>
      </nav>
      
      <div className="text-[10px] text-slate-500 font-semibold tracking-wider">v1.0</div>
    </aside>
  );
};
