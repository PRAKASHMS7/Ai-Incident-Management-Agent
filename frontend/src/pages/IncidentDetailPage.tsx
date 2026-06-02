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
import { 
  ArrowLeft, 
  Play, 
  ShieldCheck, 
  Terminal, 
  Activity, 
  FileText, 
  Brain, 
  Network, 
  Check, 
  X, 
  Send, 
  Sparkles, 
  Users, 
  ChevronDown, 
  Clock, 
  Cpu, 
  TrendingUp, 
  AlertTriangle, 
  FileCheck2, 
  BarChart3 
} from 'lucide-react';
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
      <div className="glass-card p-8 text-center text-red-400 text-xs flex flex-col items-center gap-4">
        <span>⚠️ Incident details not found.</span>
        <Link to="/" className="text-primary hover:underline flex items-center gap-1 font-bold">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const primaryService = activeIncident.services_affected[0] || 'default';
  const isOpen = activeIncident.state !== 'resolved' && activeIncident.state !== 'approval_rejected';

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const getRcaGeneratedTime = () => {
    const milestone = activeIncident.timeline.find(t => t.event_type === 'agent_milestone' && t.message.includes('RCA'));
    return milestone ? formatTimestamp(milestone.timestamp) : '02:35 PM IST';
  };

  // ==========================================
  // ESCALATION APPROVAL VIEW (Mockup Matcher)
  // ==========================================
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

    const topHypothesis = activeIncident.hypotheses[0] || {
      hypothesis: 'Database connection pool exhaustion causing application failures',
      confidence_score: 0.92,
      recommended_action: 'Increase DB connection pool size and restart affected pods.',
      evidence: [
        'High DB connection timeout errors',
        'Pool utilization at 98%',
        'Increasing latency in payment-service'
      ]
    };

    return (
      <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
        {/* Incident Detail Header Panel */}
        <div className="bg-[#0D1830]/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg">
          <div className="flex flex-col gap-1.5 z-10">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                🔴 CRITICAL
              </span>
              <h2 className="text-lg font-extrabold font-sans tracking-tight">{activeIncident.alerts[0]?.name || 'DatabaseConnectionFailure'}</h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>Service:</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/20 text-blue-400 font-bold">
                  {primaryService}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Environment:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-bold">
                  Production
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <span>Created:</span>
                <span className="font-semibold text-slate-300">{formatTimestamp(activeIncident.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 z-10">
            <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              Pending Approval
            </span>
            <span className="text-[10px] text-slate-500">
              AI RCA Generated at {getRcaGeneratedTime()}
            </span>
          </div>
        </div>

        {/* Center Section Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Action Triage Pane (Left 2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="border border-purple-500/25 shadow-[0_0_24px_rgba(168,85,247,0.15)] rounded-2xl p-6 bg-[#0D1830]/90 relative overflow-hidden flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-extrabold text-slate-100">Escalation Approval Required</h3>
                  <span className="text-[11px] text-slate-400">Please review the AI-generated RCA and approve escalation to Slack</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Hypothesis Card */}
                <div className="bg-[#070D19] border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span>AI Top Hypothesis</span>
                  </div>

                  <div className="flex items-start gap-3 bg-[#0B1221] border border-slate-800/80 p-3.5 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-purple-600/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-slate-200 leading-snug">
                        {topHypothesis.hypothesis}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 font-bold">
                          {Math.round(topHypothesis.confidence_score * 100)}% Confidence
                        </span>
                        <span className="px-2 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-extrabold uppercase">
                          High
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full" 
                          style={{ width: `${topHypothesis.confidence_score * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs text-slate-400">
                    <span className="font-bold text-slate-300 text-[10px] uppercase tracking-wider">Recommended Action:</span>
                    <span className="text-slate-200 leading-snug">{topHypothesis.recommended_action}</span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs text-slate-400">
                    <span className="font-bold text-slate-300 text-[10px] uppercase tracking-wider">Key Evidence:</span>
                    <ul className="flex flex-col gap-1.5">
                      {topHypothesis.evidence.map((ev, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{ev}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Escalation Config Card */}
                <div className="bg-[#070D19] border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Users className="w-4 h-4 text-primary" />
                    <span>Escalation Details</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Slack Recipient / Channel</label>
                    <div className="relative">
                      <select
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                        className="w-full bg-[#0b0f19] border border-slate-800 rounded-lg py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
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
                      placeholder="Payment failures increasing since 2:30 PM. Impacting checkout flow for multiple users. Investigating DB connection pool issue."
                      rows={6}
                      className="w-full bg-[#0b0f19] border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500/40 resize-none leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Approve & Reject Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-4 border-t border-slate-800/80">
                <div className="flex flex-wrap gap-4">
                  <button
                    disabled={actionLoading}
                    onClick={handleApprove}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-slate-100 text-xs font-semibold rounded-lg flex flex-col items-start gap-0.5 transition-all shadow-[0_0_16px_rgba(16,185,129,0.15)] group"
                  >
                    <div className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      <span>Approve & Send Escalation</span>
                    </div>
                    <span className="text-[9px] text-emerald-100/70 font-normal">Send to Slack now</span>
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={handleReject}
                    className="px-6 py-2.5 bg-[#0e1322] hover:bg-rose-950/20 border border-rose-500/30 hover:border-rose-500 text-rose-400 text-xs font-semibold rounded-lg flex flex-col items-start gap-0.5 transition-all"
                  >
                    <div className="flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" />
                      <span>Reject Escalation</span>
                    </div>
                    <span className="text-[9px] text-rose-500/60 font-normal">Do not send to Slack</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3.5 py-2 rounded-xl text-[10px] text-slate-400">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>AI RCA Generated at {getRcaGeneratedTime()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar details */}
          <div className="flex flex-col gap-6">
            {/* Incident Summary Card */}
            <div className="border border-slate-800 rounded-2xl bg-[#0D1830]/80 p-5 flex flex-col gap-4 shadow-lg">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <FileText className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-extrabold text-slate-100 uppercase tracking-widest">Incident Summary</h3>
              </div>

              <div className="flex flex-col gap-3.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Incident ID</span>
                  <span className="font-mono font-semibold text-slate-200">{activeIncident.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Severity</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase">
                    {activeIncident.severity}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Service</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/20 text-blue-400 text-[10px] font-bold">
                    {primaryService}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Environment</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    Production
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Created Time</span>
                  <span className="font-semibold text-slate-300">{formatTimestamp(activeIncident.created_at)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Current Status</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold uppercase">
                    Pending Approval
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline Checklist Card */}
            <div className="border border-slate-800 rounded-2xl bg-[#0D1830]/80 p-5 flex flex-col gap-4 shadow-lg">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Clock className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-extrabold text-slate-100 uppercase tracking-widest">Timeline</h3>
              </div>

              {/* Progress Vertical Flow */}
              <div className="relative pl-6 flex flex-col gap-6">
                <div className="absolute left-2.5 top-1.5 bottom-1.5 w-0.5 bg-slate-800"></div>

                {/* Step 1: Created */}
                <div className="relative">
                  <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                    <Check className="w-2 h-2 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">Incident Created</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{formatTimestamp(activeIncident.created_at)}</span>
                  </div>
                </div>

                {/* Step 2: AI RCA Generated */}
                <div className="relative">
                  <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                    <Check className="w-2 h-2 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">AI RCA Generated</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{getRcaGeneratedTime()}</span>
                  </div>
                </div>

                {/* Step 3: Pending Escalation Approval */}
                <div className="relative">
                  <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse"></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-amber-500">Pending Escalation Approval</span>
                    <span className="text-[10px] text-slate-450 mt-0.5">Waiting for operator action</span>
                  </div>
                </div>

                {/* Step 4: Escalation Sent */}
                <div className="relative">
                  <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-slate-800"></div>
                  <div className="flex flex-col text-slate-500">
                    <span className="text-xs font-bold">Escalation Sent to Slack</span>
                    <span className="text-[10px] mt-0.5">-</span>
                  </div>
                </div>

                {/* Step 5: Incident Resolved */}
                <div className="relative">
                  <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-slate-800"></div>
                  <div className="flex flex-col text-slate-500">
                    <span className="text-xs font-bold">Incident Resolved</span>
                    <span className="text-[10px] mt-0.5">-</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom statistics panel */}
        <div className="border border-slate-800 rounded-2xl bg-[#0D1830]/80 p-6 flex flex-col gap-4 shadow-lg">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-extrabold text-slate-100 uppercase tracking-widest">Full AI RCA Summary</h3>
            </div>
            <Link to="/rca" className="text-xs text-primary hover:underline flex items-center gap-1 font-bold">
              View Full RCA Report <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Stat 1 */}
            <div className="bg-[#070D19] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold text-slate-100 leading-none">{activeIncident.hypotheses.length || 3}</span>
                <span className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">Hypotheses</span>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="bg-[#070D19] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold text-slate-100 leading-none">{Math.round(topHypothesis.confidence_score * 100)}%</span>
                <span className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">Top Confidence</span>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="bg-[#070D19] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold text-slate-100 leading-none">Medium</span>
                <span className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">Blast Radius</span>
              </div>
            </div>

            {/* Stat 4 */}
            <div className="bg-[#070D19] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold text-slate-100 leading-none">2</span>
                <span className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">Actions</span>
              </div>
            </div>

            {/* Stat 5 */}
            <div className="bg-[#070D19] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold text-slate-100 leading-none">High</span>
                <span className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">Business Impact</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // STANDARD WORKSPACE TRIAGE VIEW (Premium Redesign)
  // ==========================================
  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Top Breadcrumb toolbar */}
      <div className="bg-[#0D1830]/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg">
        <div className="flex flex-col gap-1.5">
          <Link to="/" className="text-[10px] text-primary hover:text-slate-200 transition-colors flex items-center gap-1 uppercase tracking-widest font-extrabold">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Triage Workbench
          </Link>
          <div className="flex items-center gap-3 mt-1.5">
            <h2 className="text-lg font-extrabold font-sans tracking-tight">Incident Triage: {activeIncident.id.slice(0, 8)}...</h2>
            <SeverityBadge severity={activeIncident.severity} />
          </div>
        </div>

        {isOpen ? (
          <button
            onClick={handleResolve}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-slate-100 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(239,68,68,0.25)]"
          >
            <ShieldCheck className="w-4 h-4" />
            Resolve Incident & Generate RCA
          </button>
        ) : (
          <span className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.1)]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Incident Resolved
          </span>
        )}
      </div>

      {/* Main workspace layout: Split pane */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        
        {/* Left column: Telemetry Enriched Data */}
        <div className="flex flex-col gap-4 border border-slate-800 rounded-2xl bg-[#0D1830]/80 p-5 shadow-lg min-h-[500px]">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <button
              onClick={() => setLeftTab('metrics')}
              className={`pb-2 px-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5
                ${leftTab === 'metrics' 
                  ? 'border-purple-500 text-purple-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Activity className="w-4 h-4" />
              Prometheus Metrics
            </button>
            <button
              onClick={() => setLeftTab('logs')}
              className={`pb-2 px-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5
                ${leftTab === 'logs' 
                  ? 'border-purple-500 text-purple-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Terminal className="w-4 h-4" />
              Loki Logs
            </button>
          </div>

          <div className="flex-1 mt-2">
            {leftTab === 'metrics' ? (
              <TelemetryGraphs service={primaryService} />
            ) : (
              <LokiLogsTerminal service={primaryService} />
            )}
          </div>
        </div>

        {/* Right column: Reasoning & Graph nodes */}
        <div className="flex flex-col gap-4 border border-slate-800 rounded-2xl bg-[#0D1830]/80 p-5 shadow-lg min-h-[500px]">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-3">
            <button
              onClick={() => setRightTab('hypotheses')}
              className={`pb-2 px-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5
                ${rightTab === 'hypotheses' 
                  ? 'border-purple-500 text-purple-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Brain className="w-4 h-4" />
              Ranked Hypotheses
            </button>
            <button
              onClick={() => setRightTab('timeline')}
              className={`pb-2 px-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5
                ${rightTab === 'timeline' 
                  ? 'border-purple-500 text-purple-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Play className="w-4 h-4" />
              Timeline Logs
            </button>
            <button
              onClick={() => setRightTab('topology')}
              className={`pb-2 px-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5
                ${rightTab === 'topology' 
                  ? 'border-purple-500 text-purple-400' 
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
                className={`pb-2 px-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5
                  ${rightTab === 'rca' 
                    ? 'border-purple-500 text-purple-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                  }
                `}
              >
                <FileText className="w-4 h-4" />
                RCA Post-Mortem
              </button>
            )}
          </div>

          <div className="flex-1 mt-2">
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
