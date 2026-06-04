import React, { useState } from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { IncidentCard } from '../components/dashboard/IncidentCard';
import { IncidentTable } from '../components/dashboard/IncidentTable';
import { Search, SlidersHorizontal, AlertCircle, CheckCircle, RefreshCw, Layers, ShieldAlert, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';

export const DashboardPage: React.FC = () => {
  const { incidents, fetchIncidents, resolveIncident, fetchSystemHealth, error } = useIncidentStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ACTIVE');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Poll incidents list and system health every 5 seconds
  usePolling(
    () => {
      fetchIncidents();
      fetchSystemHealth();
    },
    5000,
    []
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchIncidents(), fetchSystemHealth()]);
    setIsRefreshing(false);
  };

  // Filter logic
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch = inc.services_affected.some((svc) =>
      svc.toLowerCase().includes(searchTerm.toLowerCase())
    ) || inc.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = severityFilter === 'ALL' || inc.severity.toUpperCase() === severityFilter;

    let matchesState = true;
    if (stateFilter === 'ACTIVE') {
      matchesState = inc.state !== 'resolved' && inc.state !== 'approval_rejected';
    } else if (stateFilter === 'RESOLVED') {
      matchesState = inc.state === 'resolved' || inc.state === 'approval_rejected';
    }

    return matchesSearch && matchesSeverity && matchesState;
  });

  const activeCount = incidents.filter((i) => i.state !== 'resolved' && i.state !== 'approval_rejected').length;
  const criticalCount = incidents.filter((i) => i.severity.toLowerCase() === 'critical' && i.state !== 'resolved' && i.state !== 'approval_rejected').length;

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Top Welcome/Dashboard stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <PageHeader 
            title="Triage Workbench" 
            subtitle="Real-time alert aggregation, automated correlation, and root cause diagnostic states." 
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-slate-800 border border-slate-700 hover:border-primary/50 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 shrink-0 shadow-md mb-6"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Force Sync
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>Error syncing with agent platform: {error}</span>
        </div>
      )}

      {/* Counters layout (Grident styled) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI 1 */}
        <div className="kpi-card border border-slate-800 rounded-2xl bg-gradient-to-br from-[#0D1830]/95 via-[#0B1020]/90 to-[#1c0f1b]/80 p-5 flex items-center gap-4.5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/[0.03] rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-all duration-300"></div>
          <div className="p-3.5 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.15)] status-glow-critical badge-interactive shrink-0">
            <ShieldAlert className="w-6.5 h-6.5" />
          </div>
          <div className="flex flex-col">
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">Active Critical Issues</p>
            <p className="text-3xl font-extrabold text-slate-100 mt-2 leading-none tracking-tight">{criticalCount}</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="kpi-card border border-slate-800 rounded-2xl bg-gradient-to-br from-[#0D1830]/95 via-[#0B1020]/90 to-[#130f2c]/80 p-5 flex items-center gap-4.5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/[0.03] rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-all duration-300"></div>
          <div className="p-3.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)] badge-interactive shrink-0">
            <AlertCircle className="w-6.5 h-6.5 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">Total Active Incidents</p>
            <p className="text-3xl font-extrabold text-slate-100 mt-2 leading-none tracking-tight">{activeCount}</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="kpi-card border border-slate-800 rounded-2xl bg-gradient-to-br from-[#0D1830]/95 via-[#0B1020]/90 to-[#0e2220]/80 p-5 flex items-center gap-4.5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.03] rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300"></div>
          <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] status-glow-resolved badge-interactive shrink-0">
            <CheckCircle className="w-6.5 h-6.5" />
          </div>
          <div className="flex flex-col">
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">Closed Post-Mortems</p>
            <p className="text-3xl font-extrabold text-slate-100 mt-2 leading-none tracking-tight">{incidents.length - activeCount}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center bg-[#0D1830]/60 border border-slate-800/80 p-4 rounded-2xl shadow-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by service name, incident ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-450 uppercase tracking-wide">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
            Filters:
          </div>

          {/* Severity selector */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#0b0f19] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-purple-500/40 appearance-none pr-8 cursor-pointer relative"
            style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px' }}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          {/* State selector */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-[#0b0f19] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-purple-500/40 appearance-none pr-8 cursor-pointer"
            style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px' }}
          >
            <option value="ACTIVE">Active Triage</option>
            <option value="RESOLVED">Resolved / Closed</option>
            <option value="ALL">All States</option>
          </select>
        </div>
      </div>

      {/* Grid view of active cards */}
      {stateFilter === 'ACTIVE' && filteredIncidents.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-slate-450 tracking-widest uppercase">Active Alerts Action View</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredIncidents.map((inc) => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                onResolve={resolveIncident}
              />
            ))}
          </div>
        </div>
      )}

      {/* List view of all matching */}
      <div className="flex flex-col gap-3 mt-2">
        <div className="flex items-center gap-2 px-1">
          <Layers className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-slate-455 tracking-widest uppercase">Unified Incident Log</h3>
        </div>
        <IncidentTable
          incidents={filteredIncidents}
          onResolve={resolveIncident}
        />
      </div>
    </div>
  );
};
