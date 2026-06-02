import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IncidentStateModel } from '../../api/types';
import { SeverityBadge } from './SeverityBadge';
import { ShieldCheck, ArrowRight, Clock, Server } from 'lucide-react';

interface IncidentCardProps {
  incident: IncidentStateModel;
  onResolve: (id: string) => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onResolve }) => {
  const navigate = useNavigate();

  const handleResolve = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Resolve this incident?')) {
      onResolve(incident.id);
    }
  };

  const handleCardClick = () => {
    navigate(`/incidents/${incident.id}`);
  };

  const timeActive = () => {
    const start = new Date(incident.created_at).getTime();
    const end = incident.state === 'resolved' ? new Date(incident.updated_at).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    return mins < 0 ? 0 : mins;
  };

  const formattedDate = new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(incident.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' });
  const isCritical = incident.severity.toLowerCase() === 'critical';
  const isOpen = incident.state !== 'resolved' && incident.state !== 'approval_rejected';

  return (
    <div 
      onClick={handleCardClick}
      className={`glass-card glass-card-hover p-5 rounded-2xl cursor-pointer flex flex-col justify-between gap-5 relative overflow-hidden transition-all duration-300
        ${isCritical && isOpen ? 'border-rose-500/30 shadow-[0_0_24px_rgba(239,68,68,0.1)] pulse-critical-glow' : 'border-slate-800'}
      `}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl"></div>

      <div className="flex flex-col gap-2.5 z-10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-500">ID: {incident.id.slice(0, 8)}...</span>
          <SeverityBadge severity={incident.severity} />
        </div>

        <h3 className="text-sm font-extrabold text-slate-200 flex items-center gap-2 mt-1">
          <Server className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{incident.services_affected.length > 0 ? incident.services_affected.join(', ') : 'Unknown Services'}</span>
        </h3>
        
        <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{formattedDate}</span>
        </p>
      </div>

      <div className="border-t border-slate-800/80 pt-4 mt-1 flex items-center justify-between text-xs z-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400">
          <div>
            State: <span className={`font-bold capitalize ${
              incident.state === 'pending_approval' ? 'text-amber-500' :
              incident.state === 'escalated' ? 'text-purple-400' :
              incident.state === 'resolved' ? 'text-emerald-400' : 'text-primary'
            }`}>{incident.state.replace('_', ' ')}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Active: <span className="font-semibold text-slate-300">{timeActive()}m</span>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isOpen && (
            <button
              onClick={handleResolve}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/30 hover:border-rose-500/60 text-rose-400 transition-colors flex items-center gap-1 text-[10px] font-bold"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Resolve
            </button>
          )}
          <button 
            onClick={handleCardClick}
            className="p-1.5 rounded-lg bg-[#0e1322] text-slate-450 border border-slate-800 hover:text-purple-400 hover:border-purple-500/40 transition-colors"
            title="Inspect telemetry & details"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
