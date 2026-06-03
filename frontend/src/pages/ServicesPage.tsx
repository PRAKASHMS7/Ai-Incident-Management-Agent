import React from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { Server, Cpu, Network, AlertCircle } from 'lucide-react';

const getSparklinePath = (status: string) => {
  if (status === 'critical') {
    return "M0,15 L15,5 L30,25 L45,8 L60,22 L75,3 L90,27 L105,10 L120,25 L135,5 L150,20 L160,15";
  }
  if (status === 'warning') {
    return "M0,15 L20,10 L40,20 L60,12 L80,18 L100,10 L120,20 L140,13 L160,15";
  }
  return "M0,15 L20,16 L40,14 L60,15 L80,14 L100,16 L120,15 L140,16 L160,15";
};

export const ServicesPage: React.FC = () => {
  const { incidents, fetchIncidents } = useIncidentStore();

  usePolling(fetchIncidents, 5000, []);

  // Compute active incidents per service from the store
  const getIncidentsForService = (serviceName: string) => {
    return incidents.filter(
      (inc) => inc.services_affected.includes(serviceName) && inc.state !== 'resolved' && inc.state !== 'approval_rejected'
    );
  };

  const services = [
    { name: 'payment-service', dependencies: 4, fallbackStatus: 'healthy', latency: '24ms', availability: '99.98%', cpu: '18%', memory: '42%' },
    { name: 'auth-service', dependencies: 3, fallbackStatus: 'warning', latency: '112ms', availability: '99.15%', cpu: '64%', memory: '72%' },
    { name: 'inventory-service', dependencies: 2, fallbackStatus: 'healthy', latency: '14ms', availability: '99.99%', cpu: '12%', memory: '38%' },
    { name: 'api-gateway', dependencies: 5, fallbackStatus: 'healthy', latency: '8ms', availability: '99.99%', cpu: '22%', memory: '52%' },
    { name: 'checkout-service', dependencies: 6, fallbackStatus: 'critical', latency: '1,420ms', availability: '93.40%', cpu: '94%', memory: '86%' },
  ];

  const getServiceStatus = (serviceName: string, fallback: string) => {
    const active = getIncidentsForService(serviceName);
    if (active.length > 0) {
      const hasCritical = active.some(i => i.severity.toLowerCase() === 'critical');
      return hasCritical ? 'critical' : 'warning';
    }
    return fallback;
  };

  const getStatusBadge = (status: string) => {
    const pulseClass = 
      status === 'critical' ? 'live-pulse-critical bg-rose-500' :
      status === 'warning' ? 'live-pulse-warning bg-amber-500' :
      'live-pulse-healthy bg-emerald-500';

    const textClass = 
      status === 'critical' ? 'text-rose-400 border-rose-500/25 bg-rose-500/5' :
      status === 'warning' ? 'text-amber-400 border-amber-500/25 bg-amber-500/5' :
      'text-emerald-400 border-emerald-500/25 bg-emerald-500/5';

    return (
      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 badge-interactive ${textClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${pulseClass}`}></span>
        {status}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none">
      {/* Header */}
      <div className="bg-[#0B1020]/80 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg animate-fade-in-up delay-0">
        <div className="flex flex-col gap-1.5 z-10">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-sans tracking-tight bg-gradient-to-r from-purple-400 via-indigo-200 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(168,85,247,0.35)]">
            AI Service Dependency Center
          </h2>
          <p className="text-[14px] text-slate-400 mt-1">
            Fleet registry mapping downstream dependencies, topology links, and operational status states.
          </p>
        </div>
        <div className="p-3.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0 badge-interactive animate-pulse">
          <Server className="w-6 h-6" />
        </div>
      </div>

      {/* Grid of Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {services.map((svc, index) => {
          const status = getServiceStatus(svc.name, svc.fallbackStatus);
          const activeIncidents = getIncidentsForService(svc.name);
          const serviceClass = 
            status === 'critical' ? 'service-card-critical' :
            status === 'warning' ? 'service-card-warning' :
            'service-card-healthy';
            
          const delayClass = `delay-${Math.min(index * 60 + 60, 480)}`;
          
          return (
            <div 
              key={svc.name}
              className={`border rounded-2xl bg-[#0B1020]/80 p-6 flex flex-col justify-between gap-6 relative overflow-hidden shadow-lg group transition-all duration-300 ${serviceClass} animate-fade-in-up ${delayClass}`}
            >
              <div className="flex flex-col gap-4.5 z-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <span className="text-[16px] font-extrabold text-slate-100">{svc.name}</span>
                  </div>
                  {getStatusBadge(status)}
                </div>

                {/* Service Health Metrics Grid */}
                <div className="grid grid-cols-2 gap-3.5 bg-slate-950/40 p-4 rounded-xl border border-slate-900 mt-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Latency</span>
                    <span className="text-[14px] font-extrabold text-slate-200 mt-1 flex items-center gap-1">
                      {status === 'critical' ? '1,420 ms' : status === 'warning' ? '112 ms' : svc.latency}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Availability</span>
                    <span className="text-[14px] font-extrabold text-slate-200 mt-1 flex items-center gap-1">
                      {status === 'critical' ? '93.40%' : status === 'warning' ? '99.15%' : svc.availability}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">CPU Usage</span>
                    <span className="text-[14px] font-extrabold text-slate-200 mt-1 flex items-center gap-1">
                      {status === 'critical' ? '94%' : status === 'warning' ? '64%' : svc.cpu}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Memory Usage</span>
                    <span className="text-[14px] font-extrabold text-slate-200 mt-1 flex items-center gap-1">
                      {status === 'critical' ? '86%' : status === 'warning' ? '72%' : svc.memory}
                    </span>
                  </div>
                </div>

                {/* Trend sparkline visualization */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Metrics Trend</span>
                  <div className="h-7 bg-slate-950/45 rounded-lg border border-slate-900/60 flex items-center justify-center px-2">
                    <svg className="w-full h-5 opacity-90" viewBox="0 0 160 30">
                      <path
                        d={getSparklinePath(status)}
                        fill="none"
                        stroke={
                          status === 'critical' ? '#ef4444' :
                          status === 'warning' ? '#f59e0b' :
                          '#10b981'
                        }
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-all duration-300"
                      />
                    </svg>
                  </div>
                </div>

                {/* Topology & Active Outages */}
                <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-900 mt-1">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Topology Links</span>
                    <span className="text-[16px] font-extrabold text-slate-200 mt-1 flex items-center gap-1.5">
                      <Network className="w-4 h-4 text-sky-400" />
                      {svc.dependencies} Services
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Active Outages</span>
                    <span className={`text-[16px] font-extrabold mt-1 flex items-center gap-1.5 ${
                      activeIncidents.length > 0 ? 'text-rose-400' : 'text-slate-350'
                    }`}>
                      <AlertCircle className="w-4 h-4 text-purple-400" />
                      {activeIncidents.length} Active
                    </span>
                  </div>
                </div>
              </div>

              {activeIncidents.length > 0 && (
                <div className="border-t border-slate-900 pt-4 mt-1 flex flex-col gap-2 z-10">
                  <span className="text-[11px] font-bold text-rose-450 uppercase tracking-widest leading-none">Linked Outage Event</span>
                  <div className="flex justify-between items-center text-[13px] text-slate-400 mt-1 bg-rose-500/5 p-2.5 rounded border border-rose-500/10">
                    <span className="font-mono font-semibold">{activeIncidents[0].id.slice(0, 8)}...</span>
                    <span className="font-extrabold text-rose-400">{activeIncidents[0].alerts[0]?.name || 'HttpErrorRateHigh'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
