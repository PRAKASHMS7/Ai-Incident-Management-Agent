import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IncidentStateModel } from '../../api/types';
import { SeverityBadge } from './SeverityBadge';
import { ShieldCheck, ArrowRight, Clock, Box } from 'lucide-react';

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

  const formattedDate = new Date(incident.created_at).toLocaleString();
  const isCritical = incident.severity.toLowerCase() === 'critical';
  const isOpen = incident.state !== 'resolved';

  return (
    <div 
      onClick={handleCardClick}
      className={`glass-panel glass-panel-hover p-5 rounded-xl cursor-pointer flex flex-col justify-between gap-4 border border-border
        ${isCritical && isOpen ? 'pulse-critical-card border-red-500/10' : ''}
      `}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">ID: {incident.id.slice(0, 8)}...</span>
          <SeverityBadge severity={incident.severity} />
        </div>

        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 mt-1">
          <Box className="w-4 h-4 text-primary" />
          {incident.services_affected.length > 0 ? incident.services_affected.join(', ') : 'Unknown Services'}
        </h3>
        
        <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          {formattedDate}
        </p>
      </div>

      <div className="border-t border-border/60 pt-3 mt-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 text-slate-300">
          <div>
            State: <span className="font-semibold text-primary capitalize">{incident.state}</span>
          </div>
          <div>
            Duration: <span className="font-semibold text-slate-100">{timeActive()} mins</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={handleResolve}
              className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:border-red-500/50 transition-colors flex items-center gap-1 text-[11px] font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Resolve
            </button>
          )}
          <button 
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:text-primary hover:border-primary/40 transition-colors"
            title="Inspect telemetry & details"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
