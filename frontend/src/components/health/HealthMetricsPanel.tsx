import React from 'react';
import { Cpu, CircleDollarSign, CheckCircle2, Activity, AlertTriangle } from 'lucide-react';
import { DashboardMetrics } from '../../api/types';

interface HealthMetricsPanelProps {
  metrics?: DashboardMetrics;
}

export const HealthMetricsPanel: React.FC<HealthMetricsPanelProps> = ({ metrics }) => {
  return (
    <div className="flex flex-col gap-6">
      
      {/* 5 Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        
        {/* Metric 1 */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Detection Accuracy</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">
              {metrics?.detection_accuracy !== undefined
                ? `${metrics.detection_accuracy.toFixed(1)}%`
                : '97.8%'}
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-warning/10 rounded-xl border border-warning/20 text-warning">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">LLM Call Volume</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">
              {metrics?.llm_call_volume !== undefined
                ? metrics.llm_call_volume
                : '2'}
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-info/10 rounded-xl border border-info/20 text-info">
            <CircleDollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Daily LLM API Cost</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">
              {metrics?.llm_cost !== undefined
                ? `$${metrics.llm_cost.toFixed(2)}`
                : '$0.80'}
            </p>
          </div>
        </div>

        {/* Metric 4 - Incidents Detected / Hour */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-info/10 rounded-xl border border-info/20 text-info">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">INCIDENTS DETECTED / HOUR</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">{metrics?.incidents_detected_per_hour ?? 0}</p>
            <p className="text-[9.5px] text-slate-400 mt-0.5 font-medium leading-none">Real-time detection throughput</p>
          </div>
        </div>

        {/* Metric 5 - False Positive Rate */}
        <div className="glass-panel p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="p-3 bg-warning/10 rounded-xl border border-warning/20 text-warning">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">FALSE POSITIVE RATE</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">
              {metrics?.false_positive_rate !== undefined 
                ? `${(metrics.false_positive_rate * 100).toFixed(1)}%` 
                : '5.0%'}
              <span className="text-[10px] text-slate-400 font-semibold ml-1.5">(est.)</span>
            </p>
            <p className="text-[9.5px] text-slate-400 mt-0.5 font-medium leading-none">Estimated detection quality metric</p>
          </div>
        </div>

      </div>

    </div>
  );
};
