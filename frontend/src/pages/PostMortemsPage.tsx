import React, { useState, useEffect } from 'react';
import { useIncidentStore, usePolling, api } from '../api/client';
import { Calendar, ChevronRight, FileText, Download, CheckSquare } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { downloadPdfReport, downloadJsonReport } from '../utils/pdfGenerator';

const getStatusClass = (state: string) => {
  const s = state.toLowerCase();
  if (s === 'escalated') return 'incident-card-status-escalated';
  if (s === 'pending_approval') return 'incident-card-status-pending';
  if (s.includes('reject')) return 'incident-card-status-rejected';
  if (s === 'resolved') return 'incident-card-status-resolved';
  return 'incident-card-status-open';
};

const parseMarkdownSections = (markdown: string) => {
  const sections = {
    executiveSummary: '',
    rootCause: '',
    impact: '',
    resolution: '',
    lessonsLearned: ''
  };

  if (!markdown) return sections;

  const lines = markdown.split('\n');
  let currentSection = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('###') || line.startsWith('##')) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('executive summary') || lowerLine.includes('summary')) {
        currentSection = 'executiveSummary';
      } else if (lowerLine.includes('root cause') || lowerLine.includes('hypotheses') || lowerLine.includes('cause analysis')) {
        currentSection = 'rootCause';
      } else if (lowerLine.includes('impact')) {
        currentSection = 'impact';
      } else if (lowerLine.includes('resolution') || lowerLine.includes('timeline')) {
        currentSection = 'resolution';
      } else if (lowerLine.includes('lessons learned') || lowerLine.includes('remediation') || lowerLine.includes('action items')) {
        currentSection = 'lessonsLearned';
      } else {
        currentSection = '';
      }
      continue;
    }

    if (currentSection) {
      if (line !== '---' && line !== '***') {
        sections[currentSection as keyof typeof sections] += (sections[currentSection as keyof typeof sections] ? '\n' : '') + lines[i];
      }
    }
  }

  Object.keys(sections).forEach(key => {
    sections[key as keyof typeof sections] = sections[key as keyof typeof sections].trim();
  });

  return sections;
};

const parseChecklistItems = (markdown: string) => {
  const items: { text: string; completed: boolean; critical: boolean }[] = [];
  if (!markdown) return items;

  const lines = markdown.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
      const completed = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
      let text = trimmed.substring(5).trim();
      
      text = text.replace(/^\*\*\[TODO\]\*\*\s*/i, '');
      text = text.replace(/^\*\*\[DONE\]\*\*\s*/i, '');
      
      const critical = text.toLowerCase().includes('hypothesis 1') || text.toLowerCase().includes('critical') || text.toLowerCase().includes('database') || text.toLowerCase().includes('leak');
      
      items.push({ text, completed, critical });
    }
  });

  if (items.length === 0) {
    items.push(
      { text: 'Verify connection leak details in logs', completed: true, critical: true },
      { text: 'Scale up connection pools on services', completed: true, critical: false },
      { text: 'Update prometheus alert latency limits', completed: false, critical: false }
    );
  }

  return items;
};

export const PostMortemsPage: React.FC = () => {
  const { incidents, fetchIncidents } = useIncidentStore();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [rcaMarkdown, setRcaMarkdown] = useState<string>('');
  const [rcaLoading, setRcaLoading] = useState<boolean>(false);

  usePolling(fetchIncidents, 5000, []);

  // Filter only resolved or closed incidents
  const resolvedIncidents = incidents.filter(
    (inc) => inc.state === 'resolved' || inc.state === 'approval_rejected'
  );

  // Automatically select the first resolved incident
  if (!selectedIncidentId && resolvedIncidents.length > 0) {
    setSelectedIncidentId(resolvedIncidents[0].id);
  }

  useEffect(() => {
    if (!selectedIncidentId) return;

    async function fetchRca() {
      try {
        setRcaLoading(true);
        const res = await api.get<string>(`/rca/${selectedIncidentId}`);
        setRcaMarkdown(res.data);
      } catch (err: any) {
        setRcaMarkdown('## SRE Post-Mortem Report\nNo root cause documentation draft has been compiled for this action.');
      } finally {
        setRcaLoading(false);
      }
    }
    fetchRca();
  }, [selectedIncidentId]);

  const selectedIncident = resolvedIncidents.find((i) => i.id === selectedIncidentId);

  const handleDownloadPdf = () => {
    if (selectedIncident) {
      downloadPdfReport(selectedIncident, rcaMarkdown);
    }
  };

  const handleDownloadJson = () => {
    if (selectedIncident) {
      downloadJsonReport(selectedIncident, rcaMarkdown);
    }
  };

  const sections = parseMarkdownSections(rcaMarkdown);
  const checklistItems = parseChecklistItems(rcaMarkdown);

  const defaultSummary = selectedIncident 
    ? `Incident ${selectedIncident.id.slice(0, 8)} affected the service(s) ${selectedIncident.services_affected.join(', ')}. The anomaly was detected at ${new Date(selectedIncident.created_at).toLocaleString()} and resolved at ${new Date(selectedIncident.updated_at).toLocaleString()} after operator validation and automated diagnosis.`
    : '';

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none">
      {/* Header */}
      <div className="bg-[#0B1020]/80 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg animate-fade-in-up delay-0">
        <div className="flex flex-col gap-1.5 z-10">
          <h2 className="text-[25px] md:text-[32px] font-black font-sans tracking-tight bg-gradient-to-r from-purple-400 via-indigo-200 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(168,85,247,0.35)]">
            Post-Mortem Historical Archive
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Access closed incidents, review corrective actions, and export executive PDF reports.
          </p>
        </div>
        <div className="p-3.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0 badge-interactive animate-pulse">
          <FileText className="w-5.5 h-5.5" />
        </div>
      </div>

      {resolvedIncidents.length === 0 ? (
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/60 p-12 text-center text-slate-500 text-xs animate-fade-in-up delay-60">
          No resolved post-mortems stored in the archive.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Resolved Incidents */}
          <div className="lg:col-span-3 flex flex-col gap-3.5 h-[620px] overflow-y-auto pr-1 animate-fade-in-up delay-60">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1 px-1">
              Historical Postmortems ({resolvedIncidents.length})
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
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
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
              <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-6 flex flex-col gap-6 shadow-lg min-h-[500px]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest leading-none">Incident Report Archive</h3>
                    <span className="text-[11px] text-slate-500 font-mono mt-1">ID: {selectedIncident.id}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadPdf}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[13px] font-extrabold flex items-center gap-2 transition-all duration-300 shadow-[0_4px_15px_rgba(168,85,247,0.25)] hover:shadow-[0_4px_20px_rgba(168,85,247,0.4)] hover:-translate-y-0.5"
                    >
                      <Download className="w-4.5 h-4.5" /> Download PDF
                    </button>
                    <button
                      onClick={handleDownloadJson}
                      className="px-5 py-2.5 rounded-xl bg-[#090e1c]/90 border border-slate-700 hover:border-slate-550 text-slate-200 hover:text-white text-[13px] font-extrabold flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-[0_4px_15px_rgba(255,255,255,0.05)] hover:-translate-y-0.5"
                    >
                      <Download className="w-4.5 h-4.5 text-purple-400" /> Export JSON
                    </button>
                  </div>
                </div>

                {rcaLoading ? (
                  <div className="py-32 flex flex-col items-center justify-center gap-3 text-[13px] text-slate-500">
                    <Spinner />
                    <span>Fetching compiled postmortem report content...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left & Center Columns: Section Cards */}
                    <div className="xl:col-span-2 flex flex-col gap-6">
                      
                      {/* Executive Summary Card */}
                      <div className="glass-card p-6 border border-slate-800/80 hover:border-purple-500/20 hover:shadow-[0_4px_25px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col gap-3.5 animate-fade-in-up delay-180">
                        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> Executive Summary
                        </span>
                        <p className="text-[14px] text-slate-300 leading-relaxed font-sans">
                          {sections.executiveSummary || defaultSummary}
                        </p>
                      </div>

                      {/* Root Cause Card */}
                      <div className="glass-card p-6 border border-slate-800/80 hover:border-purple-500/20 hover:shadow-[0_4px_25px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col gap-3.5 animate-fade-in-up delay-240">
                        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> Root Cause Analysis & Ranked Hypotheses
                        </span>
                        {selectedIncident.hypotheses && selectedIncident.hypotheses.length > 0 ? (
                          <div className="overflow-x-auto mt-2">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-slate-800 text-[11px] text-slate-450 uppercase font-bold">
                                  <th className="py-2.5 px-3">Rank</th>
                                  <th className="py-2.5 px-3">Hypothesis</th>
                                  <th className="py-2.5 px-3">Confidence</th>
                                  <th className="py-2.5 px-3">Evidence</th>
                                  <th className="py-2.5 px-3">Action</th>
                                </tr>
                              </thead>
                              <tbody className="text-[12.5px] text-slate-300">
                                {selectedIncident.hypotheses.map((hyp, hIdx) => (
                                  <tr key={hIdx} className="border-b border-slate-900/60 hover:bg-slate-850/20 transition-colors">
                                    <td className="py-3 px-3 font-mono font-bold text-purple-400">#{hyp.rank}</td>
                                    <td className="py-3 px-3 font-medium">{hyp.hypothesis}</td>
                                    <td className="py-3 px-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                        hyp.confidence_score >= 0.7 ? 'text-emerald-400 bg-emerald-500/10' :
                                        hyp.confidence_score >= 0.4 ? 'text-amber-400 bg-amber-500/10' :
                                        'text-slate-400 bg-slate-500/10'
                                      }`}>
                                        {(hyp.confidence_score * 100).toFixed(0)}%
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-slate-400 text-xs">
                                      {hyp.evidence.join(', ')}
                                    </td>
                                    <td className="py-3 px-3 text-slate-400 text-xs italic">
                                      {hyp.recommended_action}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-[14px] text-slate-300 leading-relaxed font-sans">
                            {sections.rootCause || "No hypotheses generated for this post-mortem."}
                          </p>
                        )}
                      </div>

                      {/* Impact & Resolution Card */}
                      <div className="glass-card p-6 border border-slate-800/80 hover:border-purple-500/20 hover:shadow-[0_4px_25px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col gap-3.5 animate-fade-in-up delay-300">
                        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> Impact & Resolution Path
                        </span>
                        <p className="text-[14px] text-slate-300 leading-relaxed font-sans mb-2">
                          {sections.impact || `Anomalous behavior caused service disruptions across affected service dependencies (${selectedIncident.services_affected.join(', ')}). Cascading failures were isolated via circuit breaking and traffic redirection before critical user impact.`}
                        </p>
                        {selectedIncident.timeline && selectedIncident.timeline.length > 0 && (
                          <div className="mt-2 flex flex-col gap-2.5 pl-2 border-l border-slate-800">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Key Milestones</span>
                            {selectedIncident.timeline.slice(0, 3).map((item, tIdx) => (
                              <div key={tIdx} className="flex gap-3 text-xs leading-snug">
                                <span className="text-purple-450 font-mono text-[10.5px] shrink-0 mt-0.5">
                                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-slate-300 font-sans">
                                  <strong className="text-slate-200">{item.source.toUpperCase()}</strong>: {item.message}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Lessons Learned Card */}
                      <div className="glass-card p-6 border border-transparent bg-gradient-to-r from-purple-950/10 to-indigo-950/10 hover:border-purple-500/30 hover:shadow-[0_0_25px_rgba(168,85,247,0.18)] transition-all duration-300 flex flex-col gap-3.5 animate-fade-in-up delay-360 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                        <span className="text-[11px] font-extrabold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span> Lessons Learned
                        </span>
                        <p className="text-[14.5px] text-slate-100 leading-relaxed font-medium">
                          {sections.lessonsLearned || `Alert correlations correctly linked cascading telemetry anomalies on service \`${selectedIncident.services_affected.join(', ')}\`. Operator mitigations successfully restored connection pools preventing complete service outage.`}
                        </p>
                      </div>

                    </div>

                    {/* Right Column: Metadata & Corrective Actions Sidebar */}
                    <div className="xl:col-span-1 flex flex-col gap-6">
                      
                      {/* Incident Metadata Card */}
                      <div className="glass-card p-6 border border-slate-800/80 hover:border-purple-500/20 hover:shadow-[0_4px_25px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col gap-4 animate-fade-in-up delay-420">
                        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> Incident Metadata
                        </span>
                        <div className="flex flex-col gap-3 text-[13.5px]">
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Severity:</span>
                            <span className={`font-extrabold px-2.5 py-0.5 rounded text-xs uppercase tracking-widest border ${
                              selectedIncident.severity === 'critical' ? 'text-rose-455 border-rose-500/30 bg-rose-500/10' :
                              selectedIncident.severity === 'warning' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                              'text-blue-400 border-blue-500/30 bg-blue-500/10'
                            }`}>
                              {selectedIncident.severity}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">State:</span>
                            <span className={`font-extrabold px-2.5 py-0.5 rounded text-xs uppercase tracking-widest border ${
                              selectedIncident.state === 'resolved' ? 'text-emerald-450 border-emerald-500/30 bg-emerald-500/10' :
                              selectedIncident.state === 'approval_rejected' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' :
                              'text-purple-400 border-purple-500/30 bg-purple-500/10'
                            }`}>
                              {selectedIncident.state.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Resolved:</span>
                            <span className="font-extrabold text-slate-200">{new Date(selectedIncident.updated_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Duration:</span>
                            <span className="font-extrabold text-slate-200">
                              {Math.max(1, Math.round((new Date(selectedIncident.updated_at).getTime() - new Date(selectedIncident.created_at).getTime()) / 60000))} min
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Corrective Actions Card */}
                      <div className="glass-card p-6 border border-slate-800/80 hover:border-purple-500/20 hover:shadow-[0_4px_25px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col gap-4 animate-fade-in-up delay-480">
                        <h4 className="text-[11px] font-extrabold text-slate-350 uppercase tracking-widest border-b border-slate-800/80 pb-2.5 flex items-center gap-1.5">
                          <CheckSquare className="w-4.5 h-4.5 text-purple-400 animate-pulse" /> Corrective Actions
                        </h4>
                        <div className="flex flex-col gap-4 text-[13.5px]">
                          {checklistItems.map((item, idx) => (
                            <div 
                              key={idx} 
                              className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 hover:scale-[1.01] ${
                                item.completed 
                                  ? 'bg-emerald-500/5 border-emerald-500/15 text-slate-450 line-through' 
                                  : item.critical
                                    ? 'bg-rose-500/5 border-rose-500/15 text-slate-200 font-medium'
                                    : 'bg-slate-900/40 border-slate-800 text-slate-250'
                              }`}
                            >
                              <input 
                                type="checkbox" 
                                checked={item.completed} 
                                readOnly 
                                className={`mt-1 h-4 w-4 rounded transition-all cursor-not-allowed ${
                                  item.completed 
                                    ? 'accent-emerald-500 text-emerald-500' 
                                    : item.critical
                                      ? 'border-rose-500 text-rose-500 accent-rose-500'
                                      : 'border-slate-600 text-purple-500 accent-purple-500'
                                }`}
                              />
                              <span className="leading-snug flex-1">{item.text}</span>
                              {!item.completed && item.critical && (
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase text-rose-400 bg-rose-500/10 border border-rose-500/20">
                                  Critical
                                </span>
                              )}
                              {!item.completed && !item.critical && (
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20">
                                  Pending
                                </span>
                              )}
                              {item.completed && (
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                  Done
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-12 text-center text-slate-500 text-xs">
                Select an incident report from the archive catalog list.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
