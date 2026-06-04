import React, { useState } from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { Calendar, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { RCAEditor } from '../components/incident/RCAEditor';

const getStatusClass = (state: string) => {
  const s = state.toLowerCase();
  if (s === 'escalated') return 'incident-card-status-escalated';
  if (s === 'pending_approval') return 'incident-card-status-pending';
  if (s.includes('reject')) return 'incident-card-status-rejected';
  if (s === 'resolved') return 'incident-card-status-resolved';
  return 'incident-card-status-open';
};

export const PostMortemsPage: React.FC = () => {
  const { incidents, fetchIncidents } = useIncidentStore();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  usePolling(fetchIncidents, 5000, []);

  // Filter only resolved or closed incidents
  const resolvedIncidents = incidents.filter(
    (inc) => inc.state === 'resolved' || inc.state === 'approval_rejected'
  );

  // Automatically select the first resolved incident
  if (!selectedIncidentId && resolvedIncidents.length > 0) {
    setSelectedIncidentId(resolvedIncidents[0].id);
  }

  const selectedIncident = resolvedIncidents.find((i) => i.id === selectedIncidentId);

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none">
      {/* Header */}
      <PageHeader 
        title="POST-INCIDENT REPORT" 
        subtitle="Access closed incidents, review corrective actions, and export executive PDF reports." 
      />

      {resolvedIncidents.length === 0 ? (
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/60 p-12 text-center text-slate-500 text-xs animate-fade-in-up delay-60">
          No resolved post-incident reports found.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Resolved Incidents */}
          <div className="lg:col-span-3 flex flex-col gap-3.5 h-[620px] overflow-y-auto pr-1 animate-fade-in-up delay-60">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1 px-1">
              POST-INCIDENT REPORTS ({resolvedIncidents.length})
            </span>
            {resolvedIncidents.map((inc, index) => {
              const active = selectedIncidentId === inc.id;
              const date = new Date(inc.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
              const animDelay = `delay-${Math.min(index * 50 + 100, 480)}`;
              const statusClass = getStatusClass(inc.state);
              
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`p-5 rounded-2xl cursor-pointer transition-all duration-200 flex items-center justify-between group incident-list-card ${statusClass} animate-fade-in-up ${animDelay}
                    ${active 
                      ? 'active-card bg-purple-600/10 border-purple-500/35 text-slate-100 scale-[1.01]' 
                      : 'text-slate-400 hover:-translate-y-1 hover:border-slate-700'
                    }
                  `}
                  style={{ transitionDuration: '250ms' }}
                >
                  <div className="flex flex-col gap-1.5 pr-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400 group-hover:text-slate-350 transition-colors">
                      ID: {inc.id.slice(0, 8)}...
                    </span>
                    <span className="text-[13.5px] font-extrabold text-slate-200 mt-0.5 group-hover:text-slate-100 transition-colors">
                      {inc.services_affected.join(', ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 mt-2.5 font-mono uppercase tracking-wider group-hover:text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-650" />
                      {date}
                    </span>
                  </div>
                  <ChevronRight className={`w-4.5 h-4.5 transition-all duration-300 ${active ? 'text-purple-400 translate-x-1.5' : 'text-slate-600 group-hover:text-purple-400/80'}`} />
                </div>
              );
            })}
          </div>

          {/* Right Panel: Post Mortem Details View */}
          <div className="lg:col-span-9 animate-fade-in-up delay-120">
            {selectedIncident ? (
              <RCAEditor incidentId={selectedIncident.id} />
            ) : (
              <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-12 text-center text-slate-500 text-xs">
                Select a post-incident report from the list.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default PostMortemsPage;
