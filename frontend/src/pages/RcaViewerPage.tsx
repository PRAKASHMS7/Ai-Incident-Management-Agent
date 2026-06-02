import React, { useState } from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { RCAEditor } from '../components/incident/RCAEditor';
import { Calendar, ChevronRight, Library } from 'lucide-react';

export const RcaViewerPage: React.FC = () => {
  const { incidents, fetchIncidents } = useIncidentStore();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Poll past incidents list on mount
  usePolling(fetchIncidents, 5000, []);

  // Filter only resolved incidents that have an RCA report
  const resolvedIncidents = incidents.filter((inc) => inc.state === 'resolved');

  // Automatically select the first resolved incident if none is selected
  if (!selectedIncidentId && resolvedIncidents.length > 0) {
    setSelectedIncidentId(resolvedIncidents[0].id);
  }

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Page Header */}
      <div className="bg-[#0D1830]/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg">
        <div className="flex flex-col gap-1 z-10">
          <h2 className="text-lg font-extrabold font-sans tracking-tight">Post-Mortem Reports Library</h2>
          <p className="text-xs text-slate-400 mt-0.5">Browse, view, export, and manage generated Root Cause Analysis (RCA) records.</p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0">
          <Library className="w-5 h-5" />
        </div>
      </div>

      {resolvedIncidents.length === 0 ? (
        <div className="border border-slate-800 rounded-2xl bg-[#0D1830]/60 p-12 text-center text-slate-500 text-xs">
          No resolved incidents or post-mortem reports found. Resolve an open incident to populate this library.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: Resolved incidents list */}
          <div className="lg:col-span-4 flex flex-col gap-3 h-[600px] overflow-y-auto pr-1">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1 px-1">
              Resolved Incidents ({resolvedIncidents.length})
            </span>
            {resolvedIncidents.map((inc) => {
              const active = selectedIncidentId === inc.id;
              const date = new Date(inc.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
              
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between
                    ${active 
                      ? 'bg-purple-600/10 border-purple-500/30 text-slate-100 shadow-[0_0_12px_rgba(168,85,247,0.1)]' 
                      : 'bg-[#0D1830]/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-[#0D1830]/95'
                    }
                  `}
                >
                  <div className="flex flex-col gap-1 pr-2">
                    <span className="text-xs font-mono font-bold text-slate-350">
                      ID: {inc.id.slice(0, 8)}...
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-200 mt-0.5">
                      {inc.services_affected.join(', ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 mt-2 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                      {date}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-all ${active ? 'text-purple-400 translate-x-1' : 'text-slate-600'}`} />
                </div>
              );
            })}
          </div>

          {/* Right panel: RCA Editor Viewport */}
          <div className="lg:col-span-8 h-full">
            {selectedIncidentId ? (
              <RCAEditor incidentId={selectedIncidentId} />
            ) : (
              <div className="border border-slate-800 rounded-2xl bg-[#0D1830]/80 p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                Select a resolved incident on the left to load its report.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
