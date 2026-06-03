import React, { useState } from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { Clock, Eye, AlertTriangle, ShieldCheck, Users, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';

const getStatusClass = (state: string) => {
  const s = state.toLowerCase();
  if (s === 'escalated') return 'incident-card-status-escalated';
  if (s === 'pending_approval') return 'incident-card-status-pending';
  if (s.includes('reject')) return 'incident-card-status-rejected';
  if (s === 'resolved') return 'incident-card-status-resolved';
  return 'incident-card-status-open'; // For open/triggered
};

const getNodeGlowClass = (type: string, message: string) => {
  const msg = message.toLowerCase();
  if (type === 'incident_resolved' || msg.includes('resolved')) {
    return 'border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)] bg-emerald-950/20';
  }
  if (type === 'alert_triggered' || msg.includes('triggered') || msg.includes('opened')) {
    return 'border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.3)] bg-blue-950/20';
  }
  if (type === 'agent_milestone' || msg.includes('rca') || msg.includes('hypothesis')) {
    return 'border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.3)] bg-purple-950/20';
  }
  if (msg.includes('approve') || msg.includes('pending')) {
    return 'border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-950/20';
  }
  if (type === 'operator_action' || msg.includes('sent') || msg.includes('escalat')) {
    return 'border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)] bg-cyan-950/20';
  }
  return 'border-slate-700 shadow-md bg-slate-900';
};

const getPulseRingClass = (type: string, message: string) => {
  const msg = message.toLowerCase();
  if (type === 'incident_resolved' || msg.includes('resolved')) {
    return 'pulse-ring-emerald';
  }
  if (type === 'alert_triggered' || msg.includes('triggered') || msg.includes('opened')) {
    return 'pulse-ring-blue';
  }
  if (type === 'agent_milestone' || msg.includes('rca') || msg.includes('hypothesis')) {
    return 'pulse-ring-purple';
  }
  if (msg.includes('approve') || msg.includes('pending')) {
    return 'pulse-ring-amber';
  }
  return 'pulse-ring-cyan';
};

export const TimelinePage: React.FC = () => {
  const { incidents, fetchIncidents } = useIncidentStore();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  usePolling(fetchIncidents, 5000, []);

  // Pre-select first incident if none selected
  if (!selectedIncidentId && incidents.length > 0) {
    setSelectedIncidentId(incidents[0].id);
  }

  const activeIncident = incidents.find(i => i.id === selectedIncidentId);

  // Find the index of the latest timeline event based on maximum timestamp
  let latestEventIndex = -1;
  if (activeIncident && activeIncident.timeline && activeIncident.timeline.length > 0) {
    latestEventIndex = activeIncident.timeline.length - 1; // Fallback to last
    try {
      let maxTime = 0;
      activeIncident.timeline.forEach((evt, idx) => {
        const time = new Date(evt.timestamp).getTime();
        if (time > maxTime) {
          maxTime = time;
          latestEventIndex = idx;
        }
      });
    } catch (e) {
      // Keep last element as fallback
    }
  }

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
        return <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />;
      case 'agent_milestone':
        return <Cpu className="w-3.5 h-3.5 text-purple-400" />;
      case 'operator_action':
        return <Users className="w-3.5 h-3.5 text-cyan-400" />;
      case 'incident_resolved':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none">
      {/* Header with animation */}
      <div className="bg-[#0B1020]/80 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg animate-fade-in-up delay-0">
        <div className="flex flex-col gap-1 z-10">
          <h2 className="text-2xl md:text-3xl font-black font-sans tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-400 bg-clip-text text-transparent">
            Timeline Logs Archive
          </h2>
          <p className="text-[13px] text-slate-400 mt-1">
            Audit trail of incident occurrences, AI diagnostic triggers, and operator confirmation actions.
          </p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/60 p-12 text-center text-slate-500 text-xs animate-fade-in-up delay-60">
          No incident timeline data ingested yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left list: Incidents */}
          <div className="lg:col-span-4 flex flex-col gap-3 h-[600px] overflow-y-auto pr-1 animate-fade-in-up delay-60">
            <span className="text-[11px] font-extrabold text-slate-400 tracking-wider uppercase mb-1 px-1">
              Active Triage Logs ({incidents.length})
            </span>
            {incidents.map((inc) => {
              const active = selectedIncidentId === inc.id;
              const statusClass = getStatusClass(inc.state);
              
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col gap-2.5 incident-list-card ${statusClass}
                    ${active 
                      ? 'active-card bg-purple-600/10 border-purple-500/35 text-slate-100' 
                      : 'text-slate-400 hover:text-slate-250'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-slate-400">
                      ID: {inc.id.slice(0, 8)}...
                    </span>
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border badge-interactive ${
                      inc.state === 'resolved' ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5' :
                      inc.state === 'pending_approval' ? 'text-amber-400 border-amber-500/25 bg-amber-500/5' :
                      inc.state === 'approval_rejected' ? 'text-rose-400 border-rose-500/25 bg-rose-500/5' :
                      inc.state === 'escalated' ? 'text-purple-400 border-purple-500/25 bg-purple-500/5' :
                      'text-sky-400 border-sky-500/25 bg-sky-500/5'
                    }`}>
                      {inc.state.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[13px] font-extrabold text-slate-200 mt-0.5">
                    {inc.services_affected.join(', ')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                    Ingested: {new Date(inc.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right flow list: Events timeline stream */}
          <div className="lg:col-span-8 animate-fade-in-up delay-120">
            {activeIncident ? (
              <div className="timeline-stream-container p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[14px] font-extrabold text-slate-100 uppercase tracking-widest leading-none">Chronological Flow Stream</h3>
                    <span className="text-[11px] text-slate-400 mt-1 font-mono">
                      Incident ID: <span className="text-purple-400 font-bold">{activeIncident.id}</span>
                    </span>
                  </div>
                  <Link 
                    to={`/incidents/${activeIncident.id}`} 
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 text-purple-200 hover:text-white hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all duration-300 flex items-center gap-1.5 text-xs font-bold"
                  >
                    <Eye className="w-4 h-4" /> Inspect Triage Workbench
                  </Link>
                </div>

                <div className="relative pl-8 flex flex-col gap-6 py-4">
                  {/* Vertical connector line */}
                  <div className="timeline-rail-animated"></div>

                  {activeIncident.timeline.map((evt, i) => {
                    const isLatest = i === latestEventIndex;
                    const nodeGlow = getNodeGlowClass(evt.event_type, evt.message);
                    const pulseRing = isLatest ? getPulseRingClass(evt.event_type, evt.message) : '';

                    return (
                      <div 
                        key={i} 
                        className="relative flex items-start w-full animate-fade-in-up"
                        style={{ animationDelay: `${i * 50 + 180}ms` }}
                      >
                        {/* Timeline node */}
                        <div className={`absolute -left-[27px] top-4 w-6 h-6 rounded-full border flex items-center justify-center z-10 transition-all duration-300 ${nodeGlow} ${isLatest ? 'scale-110' : 'hover:scale-110'}`}>
                          {isLatest && <div className={pulseRing}></div>}
                          {getTimelineIcon(evt.event_type)}
                        </div>
                        
                        {/* Event details card */}
                        <div className={`timeline-event-card ${isLatest ? 'timeline-event-card-latest' : ''}`}>
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[14px] leading-snug tracking-tight font-extrabold ${isLatest ? 'text-white drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'text-slate-100'}`}>
                                {evt.message}
                              </span>
                              {isLatest && (
                                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-[9px] font-extrabold uppercase text-purple-300 tracking-wider status-pulse-purple">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                                  Live Activity
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {formatTimestamp(evt.timestamp)} &bull; Source: <span className="text-purple-400/80 font-bold">{evt.source.toUpperCase()}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
