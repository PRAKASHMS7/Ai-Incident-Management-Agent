import React from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Activity, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  Server, 
  Send,
  ArrowRight
} from 'lucide-react';
import { SeverityBadge } from '../components/dashboard/SeverityBadge';

export const OverviewPage: React.FC = () => {
  const { incidents, fetchIncidents, systemHealth, fetchSystemHealth } = useIncidentStore();

  usePolling(
    () => {
      fetchIncidents();
      fetchSystemHealth();
    },
    5000,
    []
  );

  const activeIncidents = incidents.filter(i => i.state !== 'resolved' && i.state !== 'approval_rejected');
  const activeCount = activeIncidents.length;
  const criticalCount = activeIncidents.filter(i => i.severity.toLowerCase() === 'critical').length;
  const resolvedCount = incidents.filter(i => i.state === 'resolved').length;

  const redisUp = systemHealth?.components?.redis?.status === 'healthy';
  const neo4jUp = systemHealth?.components?.neo4j?.status === 'healthy';
  const watchdogActive = systemHealth?.status === 'healthy';

  // Extract recent timeline events across all incidents for the SRE feed
  const recentEvents = incidents
    .flatMap(inc => 
      inc.timeline.map(t => ({
        ...t,
        incidentId: inc.id,
        service: inc.services_affected[0] || 'default'
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">SRE Executive Cockpit</h1>
        <p className="text-xs text-slate-400 mt-1.5">Overview of active incidents, MTTR, system integrations, and escalation workflows.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Active Incidents */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group min-h-[110px]">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest">Active Incidents</span>
            <AlertTriangle className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-100 leading-none">{activeCount}</span>
            <span className="text-[9px] text-purple-400 block mt-1 font-bold">Unresolved triage</span>
          </div>
        </div>

        {/* KPI 2: Critical Alerts */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group min-h-[110px]">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest">Critical Alarms</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-100 leading-none">{criticalCount}</span>
            <span className="text-[9px] text-rose-500 block mt-1 font-bold">Require immediate SRE action</span>
          </div>
        </div>

        {/* KPI 3: MTTR */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group min-h-[110px]">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest">Mean Time To Resolve</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-100 leading-none">14m</span>
            <span className="text-[9px] text-sky-400 block mt-1 font-bold">Average resolution latency</span>
          </div>
        </div>

        {/* KPI 4: Escalations Today */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group min-h-[110px]">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest">Escalations Today</span>
            <Send className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-100 leading-none">
              {incidents.filter(i => i.state === 'escalated').length}
            </span>
            <span className="text-[9px] text-amber-500 block mt-1 font-bold">Dispatched Slack alerts</span>
          </div>
        </div>

        {/* KPI 5: Resolved Incidents */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group min-h-[110px]">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest">Resolved Incidents</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-100 leading-none">{resolvedCount}</span>
            <span className="text-[9px] text-emerald-450 block mt-1 font-bold">Mitigated failures</span>
          </div>
        </div>

        {/* KPI 6: Closed Postmortems */}
        <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group min-h-[110px]">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest">Closed Postmortems</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-100 leading-none">{resolvedCount}</span>
            <span className="text-[9px] text-indigo-400 block mt-1 font-bold">Written RCA documents</span>
          </div>
        </div>
      </div>

      {/* Main content Split columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Active Incidents list */}
        <div className="lg:col-span-2 flex flex-col gap-4 border border-slate-800 rounded-2xl bg-[#0B1020] p-5 shadow-lg min-h-[400px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Active Incident List ({activeCount})</h3>
            <Link to="/incidents" className="text-xs text-primary hover:underline flex items-center gap-1 font-bold">
              Triage Workbench <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {activeIncidents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No active incidents reported. Fleet status is healthy.
              </div>
            ) : (
              activeIncidents.map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  className="p-4 rounded-xl border border-slate-850 bg-[#070D19]/40 hover:bg-[#070D19]/80 transition-all duration-200 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                      <Server className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-350">{inc.id.slice(0, 8)}...</span>
                        <SeverityBadge severity={inc.severity} />
                      </div>
                      <span className="text-[11px] text-slate-300 font-extrabold mt-1">
                        {inc.services_affected.join(', ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-extrabold uppercase">
                      {inc.state.replace('_', ' ')}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Right column: Recent Activity Feed & Health Widget */}
        <div className="flex flex-col gap-6">
          {/* Health Summary Card */}
          <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-5 shadow-lg">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-3">Fleet Diagnostics Health</h3>
            
            <div className="flex flex-col gap-3.5 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Watchdog Heartbeat</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${watchdogActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-450 bg-rose-500/10'}`}>
                  {watchdogActive ? 'Active' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Redis Database Connection</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${redisUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-450 bg-rose-500/10'}`}>
                  {redisUp ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Neo4j Dependency Graph</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${neo4jUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-450 bg-rose-500/10'}`}>
                  {neo4jUp ? 'Connected' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="border border-slate-800 rounded-2xl bg-[#0B1020] p-5 shadow-lg flex-1">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-3">Recent Activity Feed</h3>

            <div className="flex flex-col gap-4 mt-4">
              {recentEvents.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  No recent activities recorded.
                </div>
              ) : (
                recentEvents.map((evt, i) => (
                  <div key={i} className="flex gap-3 text-xs leading-normal">
                    <div className="relative flex flex-col items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0"></div>
                      {i < recentEvents.length - 1 && <div className="w-0.5 bg-slate-800 flex-1 my-1"></div>}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-300 font-semibold">{evt.message}</span>
                      <span className="text-[9px] text-slate-500 font-mono mt-1">
                        {formatTimestamp(evt.timestamp)} &bull; {evt.service}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
