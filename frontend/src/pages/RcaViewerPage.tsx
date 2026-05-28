import React, { useState } from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { RCAEditor } from '../components/incident/RCAEditor';
import { BookOpen, Calendar, ChevronRight } from 'lucide-react';

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
    <div className="flex flex-col gap-6 w-full">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-100">Post-Mortem Reports Library</h2>
        <p className="text-xs text-slate-400 mt-1">Browse, view, export, and manage generated Root Cause Analysis (RCA) records.</p>
      </div>

      {resolvedIncidents.length === 0 ? (
        <div className="glass-panel p-12 rounded-xl border border-border text-center text-slate-500 text-xs">
          No resolved incidents or post-mortem reports found. Resolve an open incident to populate this library.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: Resolved incidents list */}
          <div className="lg:col-span-4 flex flex-col gap-3 h-[600px] overflow-y-auto pr-1">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">
              Resolved Incidents ({resolvedIncidents.length})
            </span>
            {resolvedIncidents.map((inc) => {
              const active = selectedIncidentId === inc.id;
              const date = new Date(inc.created_at).toLocaleDateString();
              
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex items-center justify-between
                    ${active 
                      ? 'bg-primary/10 border-primary text-slate-100 shadow-[0_0_12px_rgba(59,130,246,0.1)]' 
                      : 'bg-card border-border text-slate-400 hover:border-slate-700 hover:bg-slate-800/20'
                    }
                  `}
                >
                  <div className="flex flex-col gap-1 pr-2">
                    <span className="text-xs font-mono font-bold text-slate-200">
                      ID: {inc.id.slice(0, 8)}...
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300">
                      {inc.services_affected.join(', ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 mt-1 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      {date}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${active ? 'text-primary translate-x-1' : 'text-slate-600'}`} />
                </div>
              );
            })}
          </div>

          {/* Right panel: RCA Editor Viewport */}
          <div className="lg:col-span-8 h-full">
            {selectedIncidentId ? (
              <RCAEditor incidentId={selectedIncidentId} />
            ) : (
              <div className="glass-panel p-12 rounded-xl border border-border text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                Select a resolved incident on the left to load its report.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
