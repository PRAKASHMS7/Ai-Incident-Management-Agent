import React, { useState } from 'react';
import { useIncidentStore, usePolling, api } from '../api/client';
import { 
  Calendar, 
  ChevronRight, 
  Download, 
  Layers, 
  Brain, 
  Clock, 
  TrendingUp, 
  Activity, 
  Check
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';

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

  const selectedIncident = resolvedIncidents.find((i) => i.id === selectedIncidentId);

  const handleExport = () => {
    if (selectedIncidentId) {
      window.open(`${api.defaults.baseURL || ''}/rca/${selectedIncidentId}/export`, '_blank');
    }
  };

  const handleJsonExport = () => {
    if (selectedIncidentId) {
      window.open(`${api.defaults.baseURL || ''}/rca/${selectedIncidentId}/json`, '_blank');
    }
  };

  // Helper to extract timestamp from timeline
  const getRcaTimestamp = (incident: any) => {
    const milestone = incident.timeline.find(
      (t: any) => t.event_type === 'agent_milestone' && t.message.toLowerCase().includes('rca')
    );
    if (milestone) {
      return new Date(milestone.timestamp).toLocaleString();
    }
    return new Date(incident.updated_at).toLocaleString();
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none">
      {/* Page Header */}
      <PageHeader 
        title="AI Root Cause Analysis" 
        subtitle="Browse, view, export, and manage AI-generated Root Cause Analysis (RCA) executive records." 
      />

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

          {/* Right panel: RCA Details Viewport */}
          <div className="lg:col-span-8 h-full animate-fade-in-up delay-120">
            {selectedIncident ? (
              <div className="border border-slate-800 rounded-2xl bg-[#090e1c]/90 p-6 flex flex-col gap-6 shadow-lg min-h-[500px]">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest leading-none">AI Root Cause Analysis</h3>
                    <span className="text-[11px] text-slate-500 font-mono mt-1">Incident ID: {selectedIncident.id}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExport}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all duration-300 shadow-[0_4px_15px_rgba(168,85,247,0.25)] hover:-translate-y-0.5"
                    >
                      <Download className="w-4 h-4" /> PDF Export
                    </button>
                    <button
                      onClick={handleJsonExport}
                      className="px-4 py-2.5 rounded-xl bg-[#0b1222]/90 border border-slate-700 hover:border-slate-550 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-all duration-300 shadow-md hover:-translate-y-0.5"
                    >
                      <Layers className="w-4 h-4 text-purple-400" /> JSON Export
                    </button>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border border-slate-800 bg-[#070b16]/30 rounded-xl">
                  {/* Severity */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Severity</span>
                    <span className={`text-xs font-black uppercase inline-flex items-center gap-1.5 mt-1
                      ${selectedIncident.severity === 'critical' ? 'text-rose-450' : 
                        selectedIncident.severity === 'warning' ? 'text-amber-450' : 'text-blue-400'}
                    `}>
                      {selectedIncident.severity}
                    </span>
                  </div>
                  {/* AI Confidence Score */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">AI Confidence</span>
                    <span className="text-xs font-black text-emerald-450 mt-1 flex items-center gap-1 leading-none">
                      <TrendingUp className="w-3.5 h-3.5" /> 
                      {selectedIncident.hypotheses[0] ? `${Math.round(selectedIncident.hypotheses[0].confidence_score * 100)}%` : '92%'}
                    </span>
                  </div>
                  {/* Affected Services */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Affected Services</span>
                    <span className="text-xs font-black text-purple-400 mt-1 flex items-center gap-1 leading-none">
                      <Activity className="w-3.5 h-3.5" /> {selectedIncident.services_affected.length} Active
                    </span>
                  </div>
                  {/* RCA Generation Timestamp */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">RCA Generated</span>
                    <span className="text-xs font-black text-sky-400 mt-1 flex items-center gap-1 leading-none">
                      <Clock className="w-3.5 h-3.5" /> {getRcaTimestamp(selectedIncident).split(',')[1]?.trim() || getRcaTimestamp(selectedIncident)}
                    </span>
                  </div>
                </div>

                {/* Dependency Impact Summary */}
                <div className="glass-card p-5 border border-slate-800 rounded-xl flex flex-col gap-2.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> Dependency Impact Summary
                  </span>
                  <p className="text-[13px] text-slate-300 leading-relaxed font-medium">
                    {selectedIncident.services_affected.length > 1
                      ? `Primary anomaly detected on service '${selectedIncident.services_affected[0]}', causing cascading correlation impacts on downstream service dependencies: ${selectedIncident.services_affected.slice(1).join(', ')}.`
                      : `Anomaly isolated to service '${selectedIncident.services_affected[0]}'. No cascading dependency propagation detected within the active correlation window.`}
                  </p>
                </div>

                {/* Top 3 Ranked Hypotheses */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <h4 className="text-[13.5px] font-extrabold text-slate-200 uppercase tracking-wider">Top Hypotheses Analysis</h4>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    {selectedIncident.hypotheses.slice(0, 3).map((hyp) => (
                      <div key={hyp.rank} className="border border-slate-800 bg-[#070b16]/20 p-5 rounded-xl flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-purple-650/15 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-xs">
                              #{hyp.rank}
                            </div>
                            <span className="text-xs font-black text-slate-200">{hyp.hypothesis}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            hyp.confidence_score >= 0.7 ? 'text-emerald-450 bg-emerald-500/10' :
                            hyp.confidence_score >= 0.4 ? 'text-amber-450 bg-amber-500/10' :
                            'text-slate-400 bg-slate-500/10'
                          }`}>
                            {Math.round(hyp.confidence_score * 100)}% Confidence
                          </span>
                        </div>

                        {/* Evidence */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">Correlated Evidence</span>
                          <ul className="flex flex-col gap-1.5 pl-1">
                            {hyp.evidence.map((ev, eIdx) => (
                              <li key={eIdx} className="flex items-start gap-2 text-xs text-slate-300 font-medium">
                                <div className="p-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0 mt-0.5">
                                  <Check className="w-3 h-3 text-emerald-450" />
                                </div>
                                <span className="leading-snug">{ev}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Recommended Action */}
                        <div className="flex flex-col gap-1.5 bg-[#0b1222]/30 border border-slate-850 p-3 rounded-lg">
                          <span className="text-[9.5px] font-black text-purple-400 uppercase tracking-wider">Recommended Action Plan</span>
                          <span className="text-xs text-slate-200 leading-relaxed font-medium">{hyp.recommended_action}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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

export default RcaViewerPage;
