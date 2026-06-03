import React from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { Send, Clock, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SeverityBadge } from '../components/dashboard/SeverityBadge';

export const EscalationsPage: React.FC = () => {
  const { incidents, fetchIncidents } = useIncidentStore();

  usePolling(fetchIncidents, 5000, []);

  // Filter escalations
  const pendingApproval = incidents.filter(i => i.state === 'pending_approval');
  const approvedEscalations = incidents.filter(i => i.state === 'escalated');
  const rejectedEscalations = incidents.filter(i => i.state === 'approval_rejected');

  const getStatusColorClass = (state: string) => {
    switch (state) {
      case 'pending_approval':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
      case 'escalated':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
      case 'approval_rejected':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/25';
      default:
        return 'text-slate-400 bg-slate-800/10 border-slate-700/25';
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full text-slate-100 select-none">
      {/* Header with animation */}
      <div className="bg-gradient-to-br from-[#121b35]/65 via-[#0B1020]/80 to-[#050816]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl py-4.5 px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.01] before:to-transparent before:pointer-events-none animate-float-entrance delay-0">
        <div className="absolute -top-24 -left-20 w-80 h-80 bg-purple-500/[0.03] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 bg-blue-500/[0.03] rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col gap-1.5 z-10">
          <h2 className="text-2.5xl md:text-3.5xl lg:text-[36px] font-black font-sans tracking-tight bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(168,85,247,0.2)] animate-title-glow leading-none pb-1">
            AI Escalation Center
          </h2>
          <p className="text-[13.5px] text-slate-400 mt-1 leading-relaxed max-w-3xl font-medium">
            Control dispatcher mapping manual/AI approval escalations, Slack card routes, and action items.
          </p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0 badge-interactive animate-pulse z-10">
          <Send className="w-5.5 h-5.5" />
        </div>
      </div>

      {/* Escalation Center Grid columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-float-entrance delay-60">
        {/* Column 1: Pending Operator Actions (Amber) */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-4.5 flex flex-col gap-4 shadow-md min-h-[480px] escalation-col-pending transition-all duration-200">
          <h3 className="text-[13px] font-bold text-slate-350 uppercase tracking-wider border-b border-slate-850/60 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Pending Action
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-400 font-extrabold">
              {pendingApproval.length} Active
            </span>
          </h3>
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-1">
            {pendingApproval.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs font-semibold">No pending approvals found.</div>
            ) : (
              pendingApproval.map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  className="p-4 rounded-xl border escalation-card-pending flex items-center justify-between group"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13.5px] font-mono font-bold text-slate-400 group-hover:text-slate-350 transition-colors">
                      ID: {inc.id.slice(0, 8)}...
                    </span>
                    <span className="text-[14px] font-extrabold text-slate-200 group-hover:text-white transition-colors mt-0.5">
                      {inc.services_affected.join(', ')}
                    </span>
                  </div>
                  <ArrowRight className="w-4.5 h-4.5 text-amber-500/60 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all duration-300" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Approved / Dispatched (Green) */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-4.5 flex flex-col gap-4 shadow-md min-h-[480px] escalation-col-approved transition-all duration-200">
          <h3 className="text-[13px] font-bold text-slate-350 uppercase tracking-wider border-b border-slate-850/60 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Approved & Dispatched
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-extrabold">
              {approvedEscalations.length} Sent
            </span>
          </h3>
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-1">
            {approvedEscalations.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs font-semibold">No dispatched escalations today.</div>
            ) : (
              approvedEscalations.map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  className="p-4 rounded-xl border escalation-card-approved flex flex-col gap-2.5 group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[13.5px] font-mono font-bold text-slate-400 group-hover:text-slate-350 transition-colors">
                      ID: {inc.id.slice(0, 8)}...
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
                      @{inc.approved_by || 'operator'}
                    </span>
                  </div>
                  <span className="text-[14px] font-extrabold text-slate-200 mt-0.5 group-hover:text-white transition-colors">
                    {inc.services_affected.join(', ')}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Rejected / Bypassed (Red) */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-4.5 flex flex-col gap-4 shadow-md min-h-[480px] escalation-col-rejected transition-all duration-200">
          <h3 className="text-[13px] font-bold text-slate-350 uppercase tracking-wider border-b border-slate-850/60 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500" /> Rejected / Bypassed
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-455 font-extrabold">
              {rejectedEscalations.length} Void
            </span>
          </h3>
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-1">
            {rejectedEscalations.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs font-semibold">No rejected escalations today.</div>
            ) : (
              rejectedEscalations.map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  className="p-4 rounded-xl border escalation-card-rejected flex flex-col gap-2.5 group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[13.5px] font-mono font-bold text-slate-400 group-hover:text-slate-350 transition-colors">
                      ID: {inc.id.slice(0, 8)}...
                    </span>
                    <span className="text-[10px] font-bold text-rose-455 uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/25">
                      @{inc.rejected_by || 'operator'}
                    </span>
                  </div>
                  <span className="text-[14px] font-extrabold text-slate-200 mt-0.5 group-hover:text-white transition-colors">
                    {inc.services_affected.join(', ')}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Escalation Logs log */}
      <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 overflow-hidden shadow-lg animate-float-entrance delay-120">
        <div className="bg-slate-950/20 py-3.5 px-6 border-b border-slate-800/80">
          <span className="text-[13px] font-bold text-slate-200 uppercase tracking-wider">
            Escalation Audit Trail
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/45 text-slate-350 font-bold uppercase tracking-wider border-b border-slate-800/80 text-[11px]">
                <th className="px-6 py-3.5">Incident ID</th>
                <th className="px-6 py-3.5">Severity</th>
                <th className="px-6 py-3.5">Escalation State</th>
                <th className="px-6 py-3.5">Audited Operator</th>
                <th className="px-6 py-3.5">Action Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50">
              {incidents.filter(i => i.state !== 'open' && i.state !== 'analyzing').length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold text-[13.5px]">
                    No audited escalations found.
                  </td>
                </tr>
              ) : (
                incidents.filter(i => i.state !== 'open' && i.state !== 'analyzing').map((inc, idx) => (
                  <tr 
                    key={idx} 
                    className="audit-row-interactive hover:bg-slate-800/10 border-b border-slate-900/60 text-[13.5px] font-medium text-slate-300"
                  >
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-100">{inc.id.slice(0, 8)}...</td>
                    <td className="px-6 py-3.5"><SeverityBadge severity={inc.severity} /></td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border badge-interactive ${getStatusColorClass(inc.state)}`}>
                        {inc.state.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-bold text-slate-200">
                      {inc.state === 'escalated' ? `@${inc.approved_by || 'system'}` : 
                       inc.state === 'approval_rejected' ? `@${inc.rejected_by || 'system'}` : '@system'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 font-mono">
                      {new Date(inc.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
