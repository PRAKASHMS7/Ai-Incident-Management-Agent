import React, { useState, useEffect } from 'react';
import { useIncidentStore, usePolling, api } from '../api/client';
import { Calendar, ChevronRight, FileText, Download, CheckSquare } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { downloadPdfReport, downloadJsonReport } from '../utils/pdfGenerator';

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

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Header */}
      <div className="bg-[#0B1020]/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg">
        <div className="flex flex-col gap-1 z-10">
          <h2 className="text-lg font-extrabold font-sans tracking-tight">Post-Mortem Historical Archive</h2>
          <p className="text-xs text-slate-400 mt-0.5">Access closed incidents, review corrective actions, and export executive PDF reports.</p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      </div>

      {resolvedIncidents.length === 0 ? (
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/60 p-12 text-center text-slate-505 text-xs">
          No resolved post-mortems stored in the archive.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Resolved Incidents */}
          <div className="lg:col-span-4 flex flex-col gap-3 h-[600px] overflow-y-auto pr-1">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1 px-1">
              Historical Postmortems ({resolvedIncidents.length})
            </span>
            {resolvedIncidents.map((inc) => {
              const active = selectedIncidentId === inc.id;
              
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between
                    ${active 
                      ? 'bg-purple-600/10 border-purple-500/30 text-slate-100 shadow-[0_0_12px_rgba(168,85,247,0.1)]' 
                      : 'bg-[#0B1020]/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-[#0B1020]/95'
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
                      {new Date(inc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-all ${active ? 'text-purple-400 translate-x-1' : 'text-slate-600'}`} />
                </div>
              );
            })}
          </div>

          {/* Right Panel: Post Mortem Details View */}
          <div className="lg:col-span-8">
            {selectedIncident ? (
              <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-6 flex flex-col gap-5 shadow-lg min-h-[500px]">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xs font-extrabold text-slate-100 uppercase tracking-widest leading-none">Incident Report Archive</h3>
                    <span className="text-[10px] text-slate-500 font-mono mt-1">ID: {selectedIncident.id}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadPdf}
                      className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-slate-100 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
                    <button
                      onClick={handleDownloadJson}
                      className="px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-350 hover:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Export JSON
                    </button>
                  </div>
                </div>

                {rcaLoading ? (
                  <div className="py-24 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Spinner /> Fetching compiled postmortem report content...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Report Summary */}
                    <div className="md:col-span-2 flex flex-col gap-4 text-xs">
                      <div className="bg-[#050816] p-4.5 rounded-xl border border-slate-850 flex flex-col gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lessons Learned</span>
                        <p className="text-slate-300 leading-relaxed font-sans">
                          Alert correlations correctly linked cascading telemetry anomalies on service `{selectedIncident.services_affected.join(', ')}`. Operator mitigations successfully restored connection pools preventing complete service outage.
                        </p>
                      </div>

                      <div className="bg-[#050816] p-4.5 rounded-xl border border-slate-850 flex flex-col gap-3.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Incident Metadata</span>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Severity Level:</span>
                          <span className="font-bold text-rose-400 uppercase">{selectedIncident.severity}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">State Transition:</span>
                          <span className="font-bold text-emerald-450 uppercase">{selectedIncident.state}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Resolved Date:</span>
                          <span className="font-bold text-slate-300">{new Date(selectedIncident.updated_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Taken / Remediation checklist */}
                    <div className="bg-[#050816]/60 border border-slate-850 rounded-xl p-4.5 flex flex-col gap-4">
                      <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-2 flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-purple-400" /> Corrective Actions
                      </h4>
                      <div className="flex flex-col gap-3 text-xs">
                        <div className="flex items-start gap-2 text-slate-450 line-through">
                          <input type="checkbox" checked readOnly className="mt-1 h-3.5 w-3.5 accent-emerald-500 rounded cursor-not-allowed" />
                          <span className="leading-snug">Verify connection leak details in logs</span>
                        </div>
                        <div className="flex items-start gap-2 text-slate-450 line-through">
                          <input type="checkbox" checked readOnly className="mt-1 h-3.5 w-3.5 accent-emerald-500 rounded cursor-not-allowed" />
                          <span className="leading-snug">Scale up connection pools on services</span>
                        </div>
                        <div className="flex items-start gap-2 text-slate-300">
                          <input type="checkbox" checked={false} disabled className="mt-1 h-3.5 w-3.5 rounded cursor-not-allowed" />
                          <span className="leading-snug">Update prometheus alert latency limits</span>
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
