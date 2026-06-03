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
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none">
      {/* Page Header */}
      <div className="bg-[#090e1c]/90 border border-slate-800/80 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.5)] animate-fade-in-up delay-0">
        <div className="flex flex-col gap-1.5 z-10">
          <h2 className="text-[25px] font-black font-sans tracking-tight bg-gradient-to-r from-purple-400 via-purple-300 to-sky-400 bg-clip-text text-transparent leading-none">
            Post-Mortem Reports Library
          </h2>
          <p className="text-[13.5px] text-slate-400 mt-2 font-medium">
            Browse, view, export, and manage AI-generated Root Cause Analysis (RCA) executive records.
          </p>
        </div>
        <div className="p-3.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)] shrink-0 badge-interactive">
          <Library className="w-5.5 h-5.5" />
        </div>
      </div>

      {resolvedIncidents.length === 0 ? (
        <div className="border border-slate-800 rounded-2xl bg-[#090e1c]/95 p-12 text-center text-slate-500 text-[13.5px] animate-fade-in-up delay-60">
          No resolved incidents or post-mortem reports found. Resolve an open incident to populate this library.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: Resolved incidents list */}
          <div className="lg:col-span-4 flex flex-col gap-3.5 h-[620px] overflow-y-auto pr-1 animate-fade-in-up delay-60">
            <span className="text-[11.5px] font-bold text-slate-400 tracking-wider uppercase mb-1 px-1">
              Resolved Incidents ({resolvedIncidents.length})
            </span>
            {resolvedIncidents.map((inc, index) => {
              const active = selectedIncidentId === inc.id;
              const date = new Date(inc.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
              const animDelay = `delay-${Math.min(index * 50 + 100, 480)}`;
              
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 ease-in-out flex items-center justify-between group animate-fade-in-up ${animDelay}
                    ${active 
                      ? 'bg-purple-600/15 border-purple-500/40 text-slate-100 shadow-[0_0_14px_rgba(168,85,247,0.18)] scale-[1.01] translate-x-0.5' 
                      : 'bg-[#090e1c]/90 border-slate-800 text-slate-400 hover:border-purple-500/20 hover:bg-[#090e1c] hover:scale-[1.01] hover:-translate-y-0.5 shadow-md'
                    }
                  `}
                >
                  <div className="flex flex-col gap-1.5 pr-2">
                    <span className="text-[12.5px] font-mono font-bold text-slate-500 group-hover:text-slate-400 transition-colors">
                      ID: {inc.id.slice(0, 8)}...
                    </span>
                    <span className="text-[12.5px] font-extrabold text-slate-200 group-hover:text-slate-100 transition-colors mt-0.5">
                      {inc.services_affected.join(', ')}
                    </span>
                    <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 mt-2 font-mono uppercase tracking-wider">
                      <Calendar className="w-3.5 h-3.5 text-slate-650" />
                      {date}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-all duration-300 ${active ? 'text-purple-400 translate-x-1' : 'text-slate-600 group-hover:text-purple-400/75'}`} />
                </div>
              );
            })}
          </div>

          {/* Right panel: RCA Editor Viewport */}
          <div className="lg:col-span-8 h-full animate-fade-in-up delay-120">
            {selectedIncidentId ? (
              <RCAEditor incidentId={selectedIncidentId} />
            ) : (
              <div className="border border-slate-800 rounded-2xl bg-[#090e1c]/90 p-12 text-center text-slate-500 text-[13.5px] flex items-center justify-center gap-2 shadow-lg">
                Select a resolved incident on the left to load its report.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
