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
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none">
      {/* Title */}
      <div className="animate-fade-in-up delay-0">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-100 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-350 bg-clip-text text-transparent font-sans">
          AI Incident Management Overview
        </h1>
        <p className="text-[13.5px] text-slate-400 mt-2 font-medium">
          Real-time monitoring of incidents, escalations, system health, and operational intelligence.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Active Incidents */}
        <div className="kpi-card rounded-2xl bg-[#0B1020]/90 p-5 flex flex-col justify-between shadow-md relative overflow-hidden min-h-[120px] animate-fade-in-up delay-0">
          <div className="flex justify-between items-center">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Active Incidents</span>
            <AlertTriangle className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-100 leading-none tracking-tight">{activeCount}</span>
            <span className="text-[10px] text-purple-400 block mt-1.5 font-bold">Unresolved triage</span>
          </div>
        </div>

        {/* KPI 2: Critical Alerts */}
        <div className="kpi-card rounded-2xl bg-[#0B1020]/90 p-5 flex flex-col justify-between shadow-md relative overflow-hidden min-h-[120px] animate-fade-in-up delay-60">
          <div className="flex justify-between items-center">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Critical Alarms</span>
            <ShieldAlert className="w-4.5 h-4.5 text-rose-500 animate-pulse" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-100 leading-none tracking-tight">{criticalCount}</span>
            <span className="text-[10px] text-rose-500 block mt-1.5 font-bold">Require immediate SRE action</span>
          </div>
        </div>

        {/* KPI 3: MTTR */}
        <div className="kpi-card rounded-2xl bg-[#0B1020]/90 p-5 flex flex-col justify-between shadow-md relative overflow-hidden min-h-[120px] animate-fade-in-up delay-120">
          <div className="flex justify-between items-center">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Mean Time To Resolve</span>
            <Clock className="w-4.5 h-4.5 text-sky-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-100 leading-none tracking-tight">14m</span>
            <span className="text-[10px] text-sky-400 block mt-1.5 font-bold">Average resolution latency</span>
          </div>
        </div>

        {/* KPI 4: Escalations Today */}
        <div className="kpi-card rounded-2xl bg-[#0B1020]/90 p-5 flex flex-col justify-between shadow-md relative overflow-hidden min-h-[120px] animate-fade-in-up delay-180">
          <div className="flex justify-between items-center">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Escalations Today</span>
            <Send className="w-4.5 h-4.5 text-amber-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-100 leading-none tracking-tight">
              {incidents.filter(i => i.state === 'escalated').length}
            </span>
            <span className="text-[10px] text-amber-500 block mt-1.5 font-bold">Dispatched Slack alerts</span>
          </div>
        </div>

        {/* KPI 5: Resolved Incidents */}
        <div className="kpi-card rounded-2xl bg-[#0B1020]/90 p-5 flex flex-col justify-between shadow-md relative overflow-hidden min-h-[120px] animate-fade-in-up delay-240">
          <div className="flex justify-between items-center">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Resolved Incidents</span>
            <CheckCircle className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-100 leading-none tracking-tight">{resolvedCount}</span>
            <span className="text-[10px] text-emerald-450 block mt-1.5 font-bold">Mitigated failures</span>
          </div>
        </div>

        {/* KPI 6: Closed Postmortems */}
        <div className="kpi-card rounded-2xl bg-[#0B1020]/90 p-5 flex flex-col justify-between shadow-md relative overflow-hidden min-h-[120px] animate-fade-in-up delay-300">
          <div className="flex justify-between items-center">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Closed Postmortems</span>
            <Activity className="w-4.5 h-4.5 text-indigo-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-100 leading-none tracking-tight">{resolvedCount}</span>
            <span className="text-[10px] text-indigo-450 block mt-1.5 font-bold">Written RCA documents</span>
          </div>
        </div>
      </div>

      {/* Main content Split columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Active Incidents list */}
        <div className="lg:col-span-2 flex flex-col gap-4 border border-slate-800 rounded-2xl bg-[#0B1020]/90 p-5 shadow-lg min-h-[400px] animate-fade-in-up delay-180">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3.5">
            <h3 className="text-[15.5px] font-extrabold text-slate-200 uppercase tracking-wider">Active Incident List ({activeCount})</h3>
            <Link to="/incidents" className="text-[13px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 font-bold group">
              Triage Workbench <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {activeIncidents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-[13.5px]">
                No active incidents reported. Fleet status is healthy.
              </div>
            ) : (
              activeIncidents.map((inc, index) => {
                const animDelay = `delay-${Math.min(index * 60 + 240, 480)}`;
                return (
                  <Link
                    key={inc.id}
                    to={`/incidents/${inc.id}`}
                    className={`p-4 rounded-xl border border-slate-850 bg-[#070D19]/40 hover:bg-[#070D19]/70 hover:-translate-y-0.5 hover:border-purple-500/25 hover:shadow-[0_4px_20px_rgba(168,85,247,0.1)] transition-all duration-300 ease-in-out flex items-center justify-between group sweep-hover-effect animate-fade-in-up ${animDelay}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                        <Server className="w-4.5 h-4.5 animate-pulse" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[12.5px] font-mono font-bold text-slate-350">{inc.id.slice(0, 8)}...</span>
                          <SeverityBadge severity={inc.severity} />
                        </div>
                        <span className="text-[12.5px] text-slate-200 font-extrabold mt-1.5">
                          {inc.services_affected.join(', ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5">
                      <span className="px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-extrabold uppercase">
                        {inc.state.replace('_', ' ')}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all duration-300 ease-in-out" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Recent Activity Feed & Health Widget */}
        <div className="flex flex-col gap-6">
          {/* Health Summary Card */}
          <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/90 p-5 shadow-lg animate-fade-in-up delay-180">
            <h3 className="text-[14.5px] font-extrabold text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-3.5">Fleet Diagnostics Health</h3>
            
            <div className="flex flex-col gap-4 mt-5">
              <div className="flex items-center justify-between text-[13px] font-medium">
                <span className="text-slate-450">Watchdog Heartbeat</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${watchdogActive ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                  {watchdogActive ? 'Active' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px] font-medium">
                <span className="text-slate-450">Redis Database Connection</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${redisUp ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                  {redisUp ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px] font-medium">
                <span className="text-slate-450">Neo4j Dependency Graph</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${neo4jUp ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                  {neo4jUp ? 'Connected' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="border border-slate-800 rounded-2xl bg-[#0B1020]/90 p-5 shadow-lg flex-1 animate-fade-in-up delay-240">
            <h3 className="text-[14.5px] font-extrabold text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-3.5">Recent Activity Feed</h3>

            <div className="flex flex-col gap-5 mt-5">
              {recentEvents.length === 0 ? (
                <div className="py-8 text-center text-slate-550 text-[13px]">
                  No recent activities recorded.
                </div>
              ) : (
                recentEvents.map((evt, i) => {
                  const animDelay = `delay-${Math.min(i * 60 + 300, 480)}`;
                  return (
                    <div key={i} className={`flex gap-4 text-[13.5px] leading-relaxed animate-fade-in-up ${animDelay} hover:bg-[#070D19]/30 p-2 -m-2 rounded-lg transition-colors duration-200 group`}>
                      <div className="relative flex flex-col items-center shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500/80 border border-purple-400/40 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(168,85,247,0.5)] z-10 group-hover:scale-110 transition-transform duration-200"></div>
                        {i < recentEvents.length - 1 && (
                          <div className="w-[1.5px] bg-gradient-to-b from-purple-500/50 to-purple-500/10 flex-1 my-1.5 shadow-[0_0_6px_rgba(168,85,247,0.25)]"></div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-250 font-medium tracking-wide group-hover:text-slate-100 transition-colors">{evt.message}</span>
                        <span className="text-[11px] text-slate-450 font-semibold tracking-wider mt-1.5 flex items-center gap-1.5">
                          <span className="text-slate-450">{formatTimestamp(evt.timestamp)}</span>
                          <span className="text-slate-650">&bull;</span>
                          <span className="text-purple-400 font-bold uppercase tracking-wider text-[10px]">{evt.service}</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
