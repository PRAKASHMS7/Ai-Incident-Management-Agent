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
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Header */}
      <div className="bg-[#0B1020]/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg">
        <div className="flex flex-col gap-1 z-10">
          <h2 className="text-lg font-extrabold font-sans tracking-tight">Prometheus Alerts Center</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time alert manager dashboard showing telemetry events, metrics spikes, and correlation mappings.</p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0">
          <Bell className="w-5 h-5 animate-pulse" />
        </div>
      </div>

      {/* Alert Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-5 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-455 shadow-md">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest leading-none">Firing Critical Alerts</span>
            <span className="text-2xl font-extrabold text-slate-100 mt-1.5 leading-none">{criticalCount}</span>
          </div>
        </div>

        <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-5 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500 shadow-md">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest leading-none">Firing Warning Alerts</span>
            <span className="text-2xl font-extrabold text-slate-100 mt-1.5 leading-none">{warningCount}</span>
          </div>
        </div>

        <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-5 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-450 shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest leading-none">Associated Incidents</span>
            <span className="text-2xl font-extrabold text-slate-100 mt-1.5 leading-none">{incidents.length}</span>
          </div>
        </div>
      </div>

      {/* Toolbar Filter */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center bg-[#0B1020]/60 border border-slate-800/80 p-4 rounded-2xl shadow-md">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Active Alerts Registry log</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-450 flex items-center gap-1.5 font-bold uppercase tracking-wide">
            <Filter className="w-3.5 h-3.5 text-purple-400" /> Filter:
          </span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-[#0b0f19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-purple-500/40"
          >
            <option value="ALL">All Alerts</option>
            <option value="CRITICAL">Critical Alerts</option>
            <option value="WARNING">Warning Alerts</option>
          </select>
        </div>
      </div>

      {/* Alerts Log list */}
      <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/80 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/20 text-slate-450 font-bold uppercase tracking-wider border-b border-slate-800 text-[9px]">
                <th className="px-6 py-4">Alert Name</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Source Component</th>
                <th className="px-6 py-4">Associated Incident</th>
                <th className="px-6 py-4">Triggered At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No active alerts mapped.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alt, i) => (
                  <tr key={i} className="hover:bg-slate-800/25 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-200">
                      {alt.name}
                    </td>
                    <td className="px-6 py-4">
                      <SeverityBadge severity={alt.severity} />
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-350">
                      {alt.service}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-450">
                      {alt.incidentId.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-slate-450 font-mono">
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
