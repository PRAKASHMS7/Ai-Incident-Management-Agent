import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Activity, Cpu, Percent, Server } from 'lucide-react';

interface TelemetryGraphsProps {
  service: string;
}

export const TelemetryGraphs: React.FC<TelemetryGraphsProps> = ({ service }) => {
  // Generate mock timeseries telemetry representing anomaly spikes around an incident window
  const chartData = useMemo(() => {
    const data = [];
    const now = Date.now();
    for (let i = 20; i >= 0; i--) {
      const time = new Date(now - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // Create a simulated spike around the center of the timeline
      const isSpikeRange = i >= 8 && i <= 14;
      
      const cpu = isSpikeRange 
        ? Math.floor(82 + Math.random() * 15) 
        : Math.floor(25 + Math.random() * 15);
        
      const memory = isSpikeRange
        ? Math.floor(75 + Math.random() * 8)
        : Math.floor(45 + Math.random() * 5);
        
      const errorRate = isSpikeRange
        ? parseFloat((15 + Math.random() * 25).toFixed(2))
        : parseFloat((0 + Math.random() * 0.5).toFixed(2));
        
      const latency = isSpikeRange
        ? Math.floor(850 + Math.random() * 450)
        : Math.floor(80 + Math.random() * 40);

      data.push({ time, cpu, memory, errorRate, latency });
    }
    return data;
  }, [service]);

  return (
    <div className="flex flex-col gap-6">
      {/* 2x2 Grid of charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* CPU saturation chart */}
        <div className="glass-panel p-5 rounded-xl border border-border flex flex-col gap-3">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Cpu className="w-4 h-4 text-primary" />
            CPU Utilization ({service})
          </h4>
          <div className="h-48 w-full text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis unit="%" stroke="#64748b" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                  labelClassName="text-slate-400"
                />
                <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU Load" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory allocation chart */}
        <div className="glass-panel p-5 rounded-xl border border-border flex flex-col gap-3">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Server className="w-4 h-4 text-info" />
            Memory Saturation ({service})
          </h4>
          <div className="h-48 w-full text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis unit="%" stroke="#64748b" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                  labelClassName="text-slate-400"
                />
                <Line type="monotone" dataKey="memory" stroke="#06b6d4" strokeWidth={2} dot={false} name="Memory Load" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Error Rate chart */}
        <div className="glass-panel p-5 rounded-xl border border-border flex flex-col gap-3">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Percent className="w-4 h-4 text-critical" />
            HTTP 5xx Error Rate
          </h4>
          <div className="h-48 w-full text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis unit="%" stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                  labelClassName="text-slate-400"
                />
                <Line type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={2} dot={false} name="HTTP 500 %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency curve chart */}
        <div className="glass-panel p-5 rounded-xl border border-border flex flex-col gap-3">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Activity className="w-4 h-4 text-warning" />
            p99 Latency (ms)
          </h4>
          <div className="h-48 w-full text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis unit="ms" stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                  labelClassName="text-slate-400"
                />
                <Line type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} dot={false} name="Latency" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
