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
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'escalated':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'approval_rejected':
        return 'text-rose-455 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-slate-400 bg-slate-800/10 border-slate-700/20';
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Header */}
      <div className="bg-[#0B1020]/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg">
        <div className="flex flex-col gap-1 z-10">
          <h2 className="text-lg font-extrabold font-sans tracking-tight">SRE Escalation center</h2>
          <p className="text-xs text-slate-400 mt-0.5">Control dispatcher mapping manual/AI approval escalations, Slack card routes, and action items.</p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0">
          <Send className="w-5 h-5" />
        </div>
      </div>

      {/* Escalation Center Grid columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Pending Operator Actions */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-5 flex flex-col gap-4 shadow-lg min-h-[450px]">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Pending Action ({pendingApproval.length})
          </h3>
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px]">
            {pendingApproval.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">No pending approvals found.</div>
            ) : (
              pendingApproval.map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  className="p-3.5 rounded-xl border border-slate-850 bg-[#070D19]/45 hover:bg-[#070D19]/80 transition-all flex items-center justify-between group"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-mono font-bold text-slate-350">{inc.id.slice(0, 8)}...</span>
                    <span className="text-[11px] font-extrabold text-slate-200 mt-0.5">{inc.services_affected.join(', ')}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Approved / Dispatched */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-5 flex flex-col gap-4 shadow-lg min-h-[450px]">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-450" /> Approved & Dispatched ({approvedEscalations.length})
          </h3>
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px]">
            {approvedEscalations.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">No dispatched escalations today.</div>
            ) : (
              approvedEscalations.map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  className="p-3.5 rounded-xl border border-slate-850 bg-[#070D19]/45 hover:bg-[#070D19]/80 transition-all flex flex-col gap-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-slate-350">{inc.id.slice(0, 8)}...</span>
                    <span className="text-[9px] font-mono text-slate-500">@{inc.approved_by || 'operator'}</span>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-200 mt-0.5">{inc.services_affected.join(', ')}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Rejected / Bypassed */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-5 flex flex-col gap-4 shadow-lg min-h-[450px]">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-500" /> Rejected / Bypassed ({rejectedEscalations.length})
          </h3>
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px]">
            {rejectedEscalations.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">No rejected escalations today.</div>
            ) : (
              rejectedEscalations.map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  className="p-3.5 rounded-xl border border-slate-850 bg-[#070D19]/45 hover:bg-[#070D19]/80 transition-all flex flex-col gap-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-slate-350">{inc.id.slice(0, 8)}...</span>
                    <span className="text-[9px] font-mono text-slate-500">@{inc.rejected_by || 'operator'}</span>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-200 mt-0.5">{inc.services_affected.join(', ')}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Escalation Logs log */}
      <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 p-5 shadow-lg mt-2">
        <span className="text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-3 block">Escalation Audit Trail</span>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/20 text-slate-450 font-bold uppercase tracking-wider border-b border-slate-800 text-[9px]">
                <th className="px-6 py-4">Incident ID</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Escalation State</th>
                <th className="px-6 py-4">Audited Operator</th>
                <th className="px-6 py-4">Action Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {incidents.filter(i => i.state !== 'open' && i.state !== 'analyzing').length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">No audited escalations found.</td>
                </tr>
              ) : (
                incidents.filter(i => i.state !== 'open' && i.state !== 'analyzing').map((inc, i) => (
                  <tr key={i} className="hover:bg-slate-850/20 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-200">{inc.id.slice(0, 8)}...</td>
                    <td className="px-6 py-4"><SeverityBadge severity={inc.severity} /></td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${getStatusColorClass(inc.state)}`}>
                        {inc.state.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-350">
                      {inc.state === 'escalated' ? `@${inc.approved_by || 'system'}` : 
                       inc.state === 'approval_rejected' ? `@${inc.rejected_by || 'system'}` : '@system'}
                    </td>
                    <td className="px-6 py-4 text-slate-450 font-mono">
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
