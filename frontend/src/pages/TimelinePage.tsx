import React, { useState } from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { Clock, Eye, AlertTriangle, ShieldCheck, Users, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TimelinePage: React.FC = () => {
  const { incidents, fetchIncidents } = useIncidentStore();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  usePolling(fetchIncidents, 5000, []);

  // Pre-select first incident if none selected
  if (!selectedIncidentId && incidents.length > 0) {
    setSelectedIncidentId(incidents[0].id);
  }

  const activeIncident = incidents.find(i => i.id === selectedIncidentId);

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'alert_triggered':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-455" />;
      case 'agent_milestone':
        return <Cpu className="w-3.5 h-3.5 text-purple-400" />;
      case 'operator_action':
        return <Users className="w-3.5 h-3.5 text-sky-400" />;
      case 'incident_resolved':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-450" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Header */}
      <div className="bg-[#0B1020]/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg">
        <div className="flex flex-col gap-1 z-10">
          <h2 className="text-lg font-extrabold font-sans tracking-tight">Timeline Logs Archive</h2>
          <p className="text-xs text-slate-400 mt-0.5">Audit trail of incident occurrences, AI diagnostic triggers, and operator confirmation actions.</p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/60 p-12 text-center text-slate-505 text-xs">
          No incident timeline data ingested yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left list: Incidents */}
          <div className="lg:col-span-4 flex flex-col gap-3 h-[600px] overflow-y-auto pr-1">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1 px-1">
              Active Triage Logs ({incidents.length})
            </span>
            {incidents.map((inc) => {
              const active = selectedIncidentId === inc.id;
              
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col gap-2
                    ${active 
                      ? 'bg-purple-600/10 border-purple-500/30 text-slate-100 shadow-[0_0_12px_rgba(168,85,247,0.1)]' 
                      : 'bg-[#0B1020]/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-[#0B1020]/95'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-350">
                      ID: {inc.id.slice(0, 8)}...
                    </span>
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.2 rounded border ${
                      inc.state === 'resolved' ? 'text-emerald-450 border-emerald-500/20' :
                      inc.state === 'pending_approval' ? 'text-amber-500 border-amber-500/20' :
                      'text-purple-400 border-purple-500/20'
                    }`}>
                      {inc.state.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-200 mt-0.5">
                    {inc.services_affected.join(', ')}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono mt-1">
                    Ingested: {new Date(inc.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right flow list: Events timeline stream */}
          <div className="lg:col-span-8">
            {activeIncident ? (
              <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-6 flex flex-col gap-5 shadow-lg min-h-[500px]">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-widest leading-none">Chronological Flow Stream</h3>
                    <span className="text-[9px] text-slate-500 mt-1 font-mono">Incident ID: {activeIncident.id}</span>
                  </div>
                  <Link to={`/incidents/${activeIncident.id}`} className="px-3 py-1.5 rounded-lg bg-[#070D19] border border-slate-800 text-slate-300 hover:text-purple-400 hover:border-purple-500/30 transition-colors flex items-center gap-1 text-[10px] font-bold">
                    <Eye className="w-3.5 h-3.5" /> Inspect Triage Workbench
                  </Link>
                </div>

                <div className="relative pl-8 flex flex-col gap-8 py-3">
                  {/* Vertical connector line */}
                  <div className="absolute left-3 top-2.5 bottom-2.5 w-0.5 bg-slate-800"></div>

                  {activeIncident.timeline.map((evt, i) => (
                    <div key={i} className="relative flex flex-col items-start gap-1">
                      {/* Timeline node */}
                      <div className="absolute -left-7 top-1 w-6 h-6 rounded-full bg-[#050816] border border-slate-800 flex items-center justify-center shadow-md">
                        {getTimelineIcon(evt.event_type)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200 leading-snug">{evt.message}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-1">
                          {formatTimestamp(evt.timestamp)} &bull; Source: {evt.source.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-12 text-center text-slate-500 text-xs">
                Select an incident on the left to review its activity trail.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
