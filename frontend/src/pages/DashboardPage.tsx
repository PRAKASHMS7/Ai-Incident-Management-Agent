import React, { useState } from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { IncidentCard } from '../components/dashboard/IncidentCard';
import { IncidentTable } from '../components/dashboard/IncidentTable';
import { Search, SlidersHorizontal, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';

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
      matchesState = inc.state !== 'resolved';
    } else if (stateFilter === 'RESOLVED') {
      matchesState = inc.state === 'resolved';
    }

    return matchesSearch && matchesSeverity && matchesState;
  });

  const activeCount = incidents.filter((i) => i.state !== 'resolved').length;
  const criticalCount = incidents.filter((i) => i.severity.toLowerCase() === 'critical' && i.state !== 'resolved').length;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Welcome/Dashboard stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Triage Workbench</h2>
          <p className="text-xs text-slate-400 mt-1">Real-time alert aggregation, automated correlation, and root cause diagnostic states.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-slate-800 border border-slate-700 hover:border-primary/50 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
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

      {/* Counters layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-critical/10 rounded-xl border border-critical/20 text-critical">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active Critical Issues</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{criticalCount}</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary">
            <AlertCircle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Active Incidents</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{activeCount}</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-success/10 rounded-xl border border-success/20 text-success">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Closed Post-Mortems</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{incidents.length - activeCount}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center bg-slate-900/10 border border-border/80 p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by service name, incident ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-border rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters:
          </div>

          {/* Severity selector */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-border rounded-lg px-3 py-2 text-xs text-slate-300 font-semibold focus:outline-none focus:border-primary/50"
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
            className="bg-slate-950 border border-border rounded-lg px-3 py-2 text-xs text-slate-300 font-semibold focus:outline-none focus:border-primary/50"
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
          <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Active Alerts Action View</h3>
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
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Unified Incident Log</h3>
        <IncidentTable
          incidents={filteredIncidents}
          onResolve={resolveIncident}
        />
      </div>
    </div>
  );
};
