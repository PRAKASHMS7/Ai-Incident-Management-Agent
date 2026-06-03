import React, { useState } from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { Bell, AlertTriangle, ShieldCheck, Filter } from 'lucide-react';
import { SeverityBadge } from '../components/dashboard/SeverityBadge';

export const AlertsPage: React.FC = () => {
  const { incidents, fetchIncidents } = useIncidentStore();
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  usePolling(fetchIncidents, 5000, []);

  // Gather all unique alerts across all incidents
  const allAlerts = incidents.flatMap((inc) => 
    inc.alerts.map((alt) => ({
      ...alt,
      incidentId: inc.id,
      incidentState: inc.state
    }))
  );

  const filteredAlerts = allAlerts.filter((alt) => {
    if (filterSeverity === 'ALL') return true;
    return alt.severity.toUpperCase() === filterSeverity;
  });

  const criticalCount = allAlerts.filter(a => a.severity.toLowerCase() === 'critical').length;
  const warningCount = allAlerts.filter(a => a.severity.toLowerCase() === 'warning').length;

  return (
    <div className="flex flex-col gap-5 w-full text-slate-100 select-none">
      {/* Header with visual depth */}
      <div className="bg-gradient-to-br from-[#121b35]/65 via-[#0B1020]/80 to-[#050816]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl py-4.5 px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.01] before:to-transparent before:pointer-events-none animate-float-entrance delay-0">
        <div className="absolute -top-24 -left-20 w-80 h-80 bg-purple-500/[0.03] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 bg-blue-500/[0.03] rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col gap-1 z-10">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold font-sans tracking-tight bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(168,85,247,0.2)] animate-title-glow leading-none pb-1">
            AI Alert Intelligence Center
          </h2>
          <p className="text-[13.5px] text-slate-400 mt-1 leading-relaxed max-w-3xl font-medium">
            AI-powered alert intelligence center mapping real-time telemetry events, incident correlations, and observability signal detection.
          </p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0 badge-interactive animate-pulse z-10">
          <Bell className="w-5.5 h-5.5" />
        </div>
      </div>

      {/* Alert Stats Cards - Floating Entrance & Glow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="group rounded-2xl py-4 px-5 flex items-center gap-4 shadow-md kpi-card-critical-glow animate-float-entrance delay-60">
          <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400 shrink-0 transition-transform duration-300 group-hover:scale-105">
            <AlertTriangle className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">Firing Critical Alerts</span>
            <span className="text-3xl md:text-3.5xl font-extrabold text-slate-100 mt-1.5 leading-none">{criticalCount}</span>
          </div>
        </div>

        <div className="group rounded-2xl py-4 px-5 flex items-center gap-4 shadow-md kpi-card-warning-glow animate-float-entrance delay-120">
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500 shrink-0 transition-transform duration-300 group-hover:scale-105">
            <AlertTriangle className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">Firing Warning Alerts</span>
            <span className="text-3xl md:text-3.5xl font-extrabold text-slate-100 mt-1.5 leading-none">{warningCount}</span>
          </div>
        </div>

        <div className="group rounded-2xl py-4 px-5 flex items-center gap-4 shadow-md kpi-card-info-glow animate-float-entrance delay-180">
          <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400 shrink-0 transition-transform duration-300 group-hover:scale-105">
            <ShieldCheck className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">Associated Incidents</span>
            <span className="text-3xl md:text-3.5xl font-extrabold text-slate-100 mt-1.5 leading-none">{incidents.length}</span>
          </div>
        </div>
      </div>

      {/* Toolbar Filter */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center bg-[#0B1020]/60 backdrop-blur-md border border-slate-800/80 py-3 px-5 rounded-2xl shadow-md animate-float-entrance delay-240">
        <span className="text-[13.5px] font-bold text-slate-200 uppercase tracking-wider">Active Alerts Registry Log</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-wide">
            <Filter className="w-4 h-4 text-purple-400" /> Filter:
          </span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-[#0b0f19]/80 backdrop-blur-md border border-slate-800 hover:border-purple-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-250 font-bold focus:outline-none focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500/50 transition-all duration-200 cursor-pointer shadow-md"
          >
            <option value="ALL">All Alerts</option>
            <option value="CRITICAL">Critical Alerts</option>
            <option value="WARNING">Warning Alerts</option>
          </select>
        </div>
      </div>

      {/* Alerts Log list - Increased Typography & Hover transition */}
      <div className="registry-glass-container shadow-lg animate-float-entrance delay-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/45 text-slate-300 font-bold uppercase tracking-wider border-b border-slate-800/80 text-[11px]">
                <th className="px-6 py-3.5">Alert Name</th>
                <th className="px-6 py-3.5">Severity</th>
                <th className="px-6 py-3.5">Source Component</th>
                <th className="px-6 py-3.5">Associated Incident</th>
                <th className="px-6 py-3.5">Triggered At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold text-[13.5px]">
                    No active alerts mapped.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alt, i) => (
                  <tr 
                    key={i} 
                    className="alert-row-interactive hover:bg-slate-800/10 border-b border-slate-900/60 text-[13.5px] font-medium text-slate-300 animate-float-entrance"
                    style={{ animationDelay: `${i * 30 + 300}ms` }}
                  >
                    <td className="px-6 py-3.5 font-semibold text-slate-100">
                      {alt.name}
                    </td>
                    <td className="px-6 py-3.5">
                      <SeverityBadge severity={alt.severity} />
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-350">
                      {alt.service}
                    </td>
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-450">
                      {alt.incidentId.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 font-mono">
                      {new Date(alt.starts_at).toLocaleString()}
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
