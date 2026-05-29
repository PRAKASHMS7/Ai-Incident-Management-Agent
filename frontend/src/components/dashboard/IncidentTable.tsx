import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IncidentStateModel } from '../../api/types';
import { SeverityBadge } from './SeverityBadge';
import { ShieldCheck, Eye, ListFilter } from 'lucide-react';

interface IncidentTableProps {
  incidents: IncidentStateModel[];
  onResolve: (id: string) => void;
}

export const IncidentTable: React.FC<IncidentTableProps> = ({ incidents, onResolve }) => {
  const navigate = useNavigate();

  const handleResolve = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Resolve this incident?')) {
      onResolve(id);
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/incidents/${id}`);
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-border">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-900/40">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-primary" />
          Ingested Incidents Log
        </h3>
        <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-400 font-semibold font-mono">
          Total: {incidents.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/20 text-slate-400 font-semibold uppercase tracking-wider border-b border-border/80 text-[10px]">
              <th className="px-6 py-3.5">Incident ID</th>
              <th className="px-6 py-3.5">Severity</th>
              <th className="px-6 py-3.5">State</th>
              <th className="px-6 py-3.5">Services Affected</th>
              <th className="px-6 py-3.5">Ingested At</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                  No incidents match the active search filters.
                </td>
              </tr>
            ) : (
              incidents.map((inc) => {
                const formattedDate = new Date(inc.created_at).toLocaleString();
                const isOpen = inc.state !== 'resolved';
                
                return (
                  <tr 
                    key={inc.id}
                    onClick={() => handleRowClick(inc.id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4 font-mono font-semibold text-slate-300">
                      {inc.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4">
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                        ${inc.state === 'resolved' 
                          ? 'bg-success/10 text-success border border-success/20' 
                          : 'bg-primary/10 text-primary border border-primary/20'
                        }
                      `}>
                        {inc.state}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-200">
                      {inc.services_affected.join(', ')}
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono">
                      {formattedDate}
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {isOpen && (
                        <button
                          onClick={(e) => handleResolve(e, inc.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:border-red-500/50 transition-colors flex items-center gap-1 font-semibold text-[10px]"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Resolve
                        </button>
                      )}
                      <button 
                        onClick={() => handleRowClick(inc.id)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:text-primary hover:border-primary/50 transition-colors"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
