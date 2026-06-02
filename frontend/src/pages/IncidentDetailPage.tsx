import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useIncidentStore, usePolling } from '../api/client';
import { TelemetryGraphs } from '../components/incident/TelemetryGraphs';
import { LokiLogsTerminal } from '../components/incident/LokiLogsTerminal';
import { HypothesisPanel } from '../components/incident/HypothesisPanel';
import { TimelineViewer } from '../components/incident/TimelineViewer';
import { DependencyGraph } from '../components/incident/DependencyGraph';
import { RCAEditor } from '../components/incident/RCAEditor';
import { SeverityBadge } from '../components/dashboard/SeverityBadge';
import { ArrowLeft, Play, ShieldCheck, Terminal, Activity, FileText, Brain, Network, Check, X, Send, Sparkles, Users, HelpCircle, ChevronDown, Clock, Shield } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { 
    activeIncident, 
    fetchIncidentDetail, 
    resolveIncident, 
    loading,
    fetchChannels,
    approveEscalation,
    rejectEscalation
  } = useIncidentStore();
  const [leftTab, setLeftTab] = useState<'metrics' | 'logs'>('metrics');
  const [rightTab, setRightTab] = useState<'hypotheses' | 'timeline' | 'topology' | 'rca'>('hypotheses');

  // Escalation approval states
  const [channels, setChannels] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch channels on mount when in pending_approval state
  React.useEffect(() => {
    if (activeIncident && activeIncident.state === 'pending_approval') {
      fetchChannels(activeIncident.id).then((ch) => {
        setChannels(ch);
        if (ch.length > 0) {
          setSelectedChannel(ch[0]);
        }
      });
    }
  }, [activeIncident?.id, activeIncident?.state]);

  // Load details on mount and poll details every 5 seconds if open
  usePolling(
    () => {
      if (id) {
        fetchIncidentDetail(id);
      }
    },
    5000,
    [id]
  );

  const handleResolve = () => {
    if (id && confirm('Resolve this incident and generate the RCA post-mortem?')) {
      resolveIncident(id);
    }
  };

  if (loading && !activeIncident) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-2 text-slate-400 text-xs">
        <Spinner /> Querying incident records...
      </div>
    );
  }

  if (!activeIncident) {
    return (
      <div className="glass-panel p-8 text-center text-red-400 text-xs flex flex-col items-center gap-4">
        <span>⚠️ Incident details not found.</span>
        <Link to="/" className="text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const primaryService = activeIncident.services_affected[0] || 'default';
  const isOpen = activeIncident.state !== 'resolved' && activeIncident.state !== 'approval_rejected';

  if (activeIncident.state === 'pending_approval') {
    const handleApprove = async () => {
      if (!selectedChannel) {
        alert('Please select a Slack channel.');
        return;
      }
      setActionLoading(true);
      await approveEscalation(activeIncident.id, selectedChannel, notes, 'Prakash');
      setActionLoading(false);
    };

    const handleReject = async () => {
      if (confirm('Are you sure you want to reject this escalation?')) {
        setActionLoading(true);
        await rejectEscalation(activeIncident.id, 'Prakash');
        setActionLoading(false);
      }
    };

    const formatTimestamp = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      } catch (e) {
        return dateStr;
      }
    };

    const topHypothesis = activeIncident.hypotheses[0];

    return (
      <div className="flex flex-col gap-6 w-full text-slate-100">
        {/* Top Breadcrumb toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Link to="/" className="hover:text-primary transition-colors">Incidents</Link>
              <span>&gt;</span>
              <span className="font-mono text-slate-300">{activeIncident.id}</span>
              <span>&gt;</span>
              <span className="text-slate-200">Escalation Approval</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <SeverityBadge severity={activeIncident.severity} />
              <h2 className="text-xl font-bold">{activeIncident.alerts[0]?.name || 'DatabaseConnectionFailure'}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                Service: {primaryService}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold">
                Environment: Production
              </span>
              <span className="text-xs text-slate-400">
                Created: {formatTimestamp(activeIncident.created_at)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              Pending Approval
            </span>
            <span className="text-[10px] text-slate-400">
              AI RCA Generated at {activeIncident.timeline.find(t => t.event_type === 'agent_milestone')?.timestamp ? formatTimestamp(activeIncident.timeline.find(t => t.event_type === 'agent_milestone')!.timestamp) : '02:35 PM IST'}
            </span>
          </div>
        </div>

        {/* Main Tri-pane Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          {/* Left 8-columns: Approval Form & Hypotheses */}
          <div className="lg:col-span-8 flex flex-col gap-6 w-full">
            {/* Approval Panel */}
            <div className="bg-[#0e1322]/80 border border-purple-500/20 rounded-xl p-6 relative overflow-hidden backdrop-blur-md shadow-[0_0_24px_rgba(168,85,247,0.08)] flex flex-col gap-6">
              <div className="flex items-start gap-4 pb-4 border-b border-slate-800">
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Escalation Approval Required</h3>
                  <p className="text-xs text-slate-400 mt-1">Please review the AI-generated RCA findings and approve escalation to Slack.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Findings Column */}
                <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wide">
                    <Brain className="w-4 h-4" />
                    AI Top Hypothesis
                  </div>

                  {topHypothesis ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mt-0.5">
                          1
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-200">{topHypothesis.hypothesis}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-bold text-slate-400">{(topHypothesis.confidence_score * 100).toFixed(0)}% Confidence</span>
                            <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${topHypothesis.confidence_score * 100}%` }}></div>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">High</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recommended Action:</span>
                        <p className="text-xs text-slate-300 pl-1 border-l border-slate-700">{topHypothesis.recommended_action}</p>
                      </div>

                      <div className="mt-2 flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Key Evidence:</span>
                        <ul className="flex flex-col gap-1.5 pl-1">
                          {topHypothesis.evidence.map((ev, index) => (
                            <li key={index} className="text-xs text-slate-300 flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">No hypotheses generated yet.</span>
                  )}
                </div>

                {/* Form Context Column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wide">
                    <Users className="w-4 h-4" />
                    Escalation Details
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Slack Recipient / Channel</label>
                    <div className="relative">
                      <select
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                        className="w-full bg-[#0b0f19] border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
                      >
                        {channels.map((ch) => (
                          <option key={ch} value={ch}>{ch}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center w-full">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Additional Escalation Context (Optional)</label>
                      <span className="text-[9px] text-slate-500 font-mono">{notes.length}/500</span>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                      placeholder="e.g. Impacting checkout flow for multiple users. Investigating DB connection pool issue."
                      rows={4}
                      className="w-full bg-[#0b0f19] border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500/40 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-4 border-t border-slate-800">
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={actionLoading}
                    onClick={handleApprove}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-slate-100 text-xs font-semibold rounded-lg flex flex-col items-start gap-0.5 transition-all shadow-[0_0_16px_rgba(16,185,129,0.15)] group"
                  >
                    <div className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      <span>Approve & Send Escalation</span>
                    </div>
                    <span className="text-[9px] text-emerald-100 font-normal">Send to Slack now</span>
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={handleReject}
                    className="px-5 py-2.5 bg-[#0e1322] hover:bg-red-950/20 border border-red-500/30 hover:border-red-500 text-red-400 text-xs font-semibold rounded-lg flex flex-col items-start gap-0.5 transition-all"
                  >
                    <div className="flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" />
                      <span>Reject Escalation</span>
                    </div>
                    <span className="text-[9px] text-red-500/60 font-normal">Do not send to Slack</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 border border-slate-800 rounded-lg py-2 px-3 bg-[#0b0f19]">
                  <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span>AI RCA Generated</span>
                </div>
              </div>
            </div>

            {/* Bottom stats layout: Summary statistics cards */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-slate-400" />
                  Full AI RCA Summary
                </h4>
                <Link
                  to={`/rca/${activeIncident.id}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View Full RCA Report
                  <FileText className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="glass-panel p-4 flex flex-col gap-1 rounded-lg border border-slate-800 bg-[#0b0f19]">
                  <span className="text-xl font-black text-purple-400">{activeIncident.hypotheses.length}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Hypotheses Generated</span>
                </div>
                <div className="glass-panel p-4 flex flex-col gap-1 rounded-lg border border-slate-800 bg-[#0b0f19]">
                  <span className="text-xl font-black text-emerald-400">{topHypothesis ? (topHypothesis.confidence_score * 100).toFixed(0) : 92}%</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Top Confidence Score</span>
                </div>
                <div className="glass-panel p-4 flex flex-col gap-1 rounded-lg border border-slate-800 bg-[#0b0f19]">
                  <span className="text-sm font-black text-amber-400 pt-1.5">Medium</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Blast Radius Detected</span>
                </div>
                <div className="glass-panel p-4 flex flex-col gap-1 rounded-lg border border-slate-800 bg-[#0b0f19]">
                  <span className="text-xl font-black text-blue-400">2</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Recommended Actions</span>
                </div>
                <div className="glass-panel p-4 flex flex-col gap-1 rounded-lg border border-slate-800 bg-[#0b0f19]">
                  <span className="text-sm font-black text-red-400 pt-1.5">High</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Business Impact Detected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 4-columns: Sidebar summary & timeline */}
          <div className="lg:col-span-4 flex flex-col gap-6 w-full">
            {/* Incident Summary Card */}
            <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-[#0e1322]/40 backdrop-blur-sm flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                Incident Summary
              </h3>
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Incident ID</span>
                  <span className="font-mono text-slate-200">{activeIncident.id.slice(0, 18)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Severity</span>
                  <SeverityBadge severity={activeIncident.severity} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Service</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">{primaryService}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Environment</span>
                  <span className="px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-semibold">Production</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created Time</span>
                  <span className="text-slate-200">{formatTimestamp(activeIncident.created_at)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800 pt-2.5">
                  <span className="text-slate-400">Current Status</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 font-bold uppercase text-[9px] tracking-wide border border-amber-500/20">
                    Pending Approval
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline checklist Card */}
            <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-[#0e1322]/40 backdrop-blur-sm flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                Timeline Flow
              </h3>
              
              <div className="flex flex-col gap-4 pl-2 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
                {/* Node 1: Created */}
                <div className="flex gap-4 items-start relative">
                  <div className="z-10 w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 font-black" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Incident Created</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatTimestamp(activeIncident.created_at)}</p>
                  </div>
                </div>

                {/* Node 2: RCA Generated */}
                <div className="flex gap-4 items-start relative">
                  <div className="z-10 w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 font-black" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">AI RCA Generated</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {activeIncident.timeline.find(t => t.event_type === 'agent_milestone')?.timestamp 
                        ? formatTimestamp(activeIncident.timeline.find(t => t.event_type === 'agent_milestone')!.timestamp) 
                        : formatTimestamp(activeIncident.created_at)}
                    </p>
                  </div>
                </div>

                {/* Node 3: Pending */}
                <div className="flex gap-4 items-start relative">
                  <div className="z-10 w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500 text-amber-500 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-500">Pending Escalation Approval</h4>
                    <p className="text-[10px] text-amber-500/80 mt-0.5">Waiting for operator action</p>
                  </div>
                </div>

                {/* Node 4: Slack */}
                <div className="flex gap-4 items-start relative">
                  <div className="z-10 w-7 h-7 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-500">Escalation Sent to Slack</h4>
                    <p className="text-[10px] text-slate-600 mt-0.5">-</p>
                  </div>
                </div>

                {/* Node 5: Resolved */}
                <div className="flex gap-4 items-start relative">
                  <div className="z-10 w-7 h-7 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-500">Incident Resolved</h4>
                    <p className="text-[10px] text-slate-600 mt-0.5">-</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Breadcrumb toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-2">
          <Link to="/" className="text-xs text-slate-400 hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Triage Workbench
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-100">Incident Triage: {activeIncident.id.slice(0, 8)}...</h2>
            <SeverityBadge severity={activeIncident.severity} />
          </div>
        </div>

        {isOpen ? (
          <button
            onClick={handleResolve}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-slate-100 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(239,68,68,0.3)]"
          >
            <ShieldCheck className="w-4 h-4" />
            Resolve Incident & Generate RCA
          </button>
        ) : (
          <span className="px-3 py-1.5 rounded-lg bg-success/15 border border-success/30 text-success text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Incident Resolved
          </span>
        )}
      </div>

      {/* Main workspace layout: Split pane */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        
        {/* Left column: Telemetry Enriched Data */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border">
            <button
              onClick={() => setLeftTab('metrics')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${leftTab === 'metrics' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Activity className="w-4 h-4" />
              Prometheus Metrics
            </button>
            <button
              onClick={() => setLeftTab('logs')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${leftTab === 'logs' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Terminal className="w-4 h-4" />
              Loki Logs
            </button>
          </div>

          <div className="min-h-[400px]">
            {leftTab === 'metrics' ? (
              <TelemetryGraphs service={primaryService} />
            ) : (
              <LokiLogsTerminal service={primaryService} />
            )}
          </div>
        </div>

        {/* Right column: Reasoning & Graph nodes */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-border">
            <button
              onClick={() => setRightTab('hypotheses')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${rightTab === 'hypotheses' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Brain className="w-4 h-4" />
              Ranked Hypotheses
            </button>
            <button
              onClick={() => setRightTab('timeline')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${rightTab === 'timeline' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Play className="w-4 h-4" />
              Timeline Logs
            </button>
            <button
              onClick={() => setRightTab('topology')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${rightTab === 'topology' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Network className="w-4 h-4" />
              Dependency Graph
            </button>
            {!isOpen && (
              <button
                onClick={() => setRightTab('rca')}
                className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                  ${rightTab === 'rca' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                  }
                `}
              >
                <FileText className="w-4 h-4" />
                RCA Post-Mortem
              </button>
            )}
          </div>

          <div className="min-h-[400px]">
            {rightTab === 'hypotheses' && (
              <HypothesisPanel hypotheses={activeIncident.hypotheses} />
            )}
            {rightTab === 'timeline' && (
              <TimelineViewer timeline={activeIncident.timeline} />
            )}
            {rightTab === 'topology' && (
              <DependencyGraph affectedServices={activeIncident.services_affected} />
            )}
            {rightTab === 'rca' && !isOpen && (
              <RCAEditor incidentId={activeIncident.id} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
