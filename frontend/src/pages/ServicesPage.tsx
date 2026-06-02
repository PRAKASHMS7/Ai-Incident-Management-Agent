import React from 'react';
import { useIncidentStore, usePolling } from '../api/client';
import { Server, Cpu, Network, AlertCircle } from 'lucide-react';

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
    { name: 'payment-service', dependencies: 4, fallbackStatus: 'healthy' },
    { name: 'auth-service', dependencies: 3, fallbackStatus: 'warning' },
    { name: 'inventory-service', dependencies: 2, fallbackStatus: 'healthy' },
    { name: 'api-gateway', dependencies: 5, fallbackStatus: 'healthy' },
    { name: 'checkout-service', dependencies: 6, fallbackStatus: 'critical' },
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
    switch (status) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-extrabold uppercase tracking-wide">
            Critical
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-extrabold uppercase tracking-wide">
            Warning
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-extrabold uppercase tracking-wide">
            Healthy
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none animate-fadeIn">
      {/* Header */}
      <div className="bg-[#0B1020]/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg">
        <div className="flex flex-col gap-1 z-10">
          <h2 className="text-lg font-extrabold font-sans tracking-tight">SRE Service Catalog</h2>
          <p className="text-xs text-slate-400 mt-0.5">Fleet registry mapping downstream dependencies, topology links, and operational status states.</p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-md shrink-0">
          <Server className="w-5 h-5" />
        </div>
      </div>

      {/* Grid of Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {services.map((svc) => {
          const status = getServiceStatus(svc.name, svc.fallbackStatus);
          const activeIncidents = getIncidentsForService(svc.name);
          
          return (
            <div 
              key={svc.name}
              className={`border rounded-2xl bg-[#0B1020]/80 p-5 flex flex-col justify-between gap-5 relative overflow-hidden shadow-md group transition-all duration-200 hover:-translate-y-0.5
                ${status === 'critical' ? 'border-rose-500/30 shadow-[0_0_16px_rgba(239,68,68,0.06)]' : 
                  status === 'warning' ? 'border-amber-500/30 shadow-[0_0_16px_rgba(245,158,11,0.06)]' : 'border-slate-800'}
              `}
            >
              <div className="flex flex-col gap-3.5 z-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                      <Cpu className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-sm font-extrabold text-slate-100">{svc.name}</span>
                  </div>
                  {getStatusBadge(status)}
                </div>

                <div className="grid grid-cols-2 gap-4 bg-[#050816] p-3 rounded-xl border border-slate-850 mt-1">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Topology Links</span>
                    <span className="text-sm font-extrabold text-slate-200 mt-1 flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-sky-400" />
                      {svc.dependencies} Services
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Active Outages</span>
                    <span className={`text-sm font-extrabold mt-1 flex items-center gap-1.5 ${
                      activeIncidents.length > 0 ? 'text-rose-400' : 'text-slate-350'
                    }`}>
                      <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
                      {activeIncidents.length} Active
                    </span>
                  </div>
                </div>
              </div>

              {activeIncidents.length > 0 && (
                <div className="border-t border-slate-850 pt-3.5 mt-1 flex flex-col gap-2 z-10">
                  <span className="text-[9px] font-bold text-rose-450 uppercase tracking-widest leading-none">Linked Outage Event</span>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1 bg-rose-500/5 p-2 rounded border border-rose-500/10">
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
