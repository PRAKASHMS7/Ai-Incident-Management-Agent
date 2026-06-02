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
    <div className="border border-slate-800 rounded-2xl bg-[#0D1830]/85 overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/10">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-purple-400" />
          Ingested Incidents Log
        </h3>
        <span className="text-[10px] bg-[#0b0f19] border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-extrabold font-mono">
          Total: {incidents.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/20 text-slate-450 font-bold uppercase tracking-wider border-b border-slate-800 text-[9px]">
              <th className="px-6 py-4">Incident ID</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">State</th>
              <th className="px-6 py-4">Services Affected</th>
              <th className="px-6 py-4">Ingested At</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                  No incidents match the active search filters.
                </td>
              </tr>
            ) : (
              incidents.map((inc) => {
                const formattedDate = new Date(inc.created_at).toLocaleString();
                const isOpen = inc.state !== 'resolved' && inc.state !== 'approval_rejected';
                
                return (
                  <tr 
                    key={inc.id}
                    onClick={() => handleRowClick(inc.id)}
                    className="hover:bg-slate-800/25 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4.5 font-mono font-bold text-slate-350">
                      {inc.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4.5">
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border
                        ${inc.state === 'resolved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.05)]' 
                          : inc.state === 'pending_approval'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.05)]'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.05)]'
                        }
                      `}>
                        {inc.state.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 font-extrabold text-slate-300">
                      {inc.services_affected.join(', ')}
                    </td>
                    <td className="px-6 py-4.5 text-slate-400 font-mono">
                      {formattedDate}
                    </td>
                    <td className="px-6 py-4.5 text-right flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {isOpen && (
                        <button
                          onClick={(e) => handleResolve(e, inc.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/25 hover:border-rose-500 text-rose-450 transition-colors flex items-center gap-1 font-bold text-[9px]"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Resolve
                        </button>
                      )}
                      <button 
                        onClick={() => handleRowClick(inc.id)}
                        className="p-1.5 rounded-lg bg-[#0e1322] text-slate-400 border border-slate-800 hover:text-purple-400 hover:border-purple-500/40 transition-colors"
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
