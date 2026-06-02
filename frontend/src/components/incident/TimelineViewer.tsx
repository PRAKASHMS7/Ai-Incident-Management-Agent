import React from 'react';
import { TimelineItem } from '../../api/types';
import { Bell, Activity, Terminal, Brain, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface TimelineViewerProps {
  timeline: TimelineItem[];
}

export const TimelineViewer: React.FC<TimelineViewerProps> = ({ timeline }) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'alert_triggered':
        return <Bell className="w-4 h-4 text-red-400" />;
      case 'metric_anomaly':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'log_error':
        return <Terminal className="w-4 h-4 text-red-500" />;
      case 'agent_milestone':
        return <Brain className="w-4 h-4 text-blue-400" />;
      case 'incident_ingested':
        return <Activity className="w-4 h-4 text-blue-400" />;
      case 'operator_action':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'escalation_failed':
        return <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getEventBg = (type: string) => {
    switch (type) {
      case 'alert_triggered':
        return 'bg-red-500/10 border-red-500/20';
      case 'metric_anomaly':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'log_error':
        return 'bg-red-950/20 border-red-900/30';
      case 'agent_milestone':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'incident_ingested':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'operator_action':
        return 'bg-green-500/10 border-green-500/20';
      case 'escalation_failed':
        return 'bg-red-950/40 border-red-800/40';
      default:
        return 'bg-slate-800/40 border-slate-700/40';
    }
  };

  return (
    <div className="relative pl-6 border-l-2 border-slate-800 flex flex-col gap-6 py-2">
      {timeline.map((item, idx) => {
        const date = new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZoneName: 'short'
        }).format(new Date(item.timestamp)).replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
        const formattedType = item.event_type.replace('_', ' ');

        return (
          <div key={idx} className="relative group">
            {/* Anchor Bullet Icon */}
            <div className={`absolute -left-[35px] top-1 flex items-center justify-center w-8 h-8 rounded-full border bg-slate-900 shadow-md transition-transform group-hover:scale-115 duration-150
              ${getEventBg(item.event_type)}
            `}>
              {getEventIcon(item.event_type)}
            </div>

            {/* Timeline event card */}
            <div className="glass-panel p-4 rounded-xl flex flex-col gap-1 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  {formattedType}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold font-mono">
                  {date} ({item.source})
                </span>
              </div>
              <p className="text-[12px] text-slate-200 mt-1 leading-relaxed">
                {item.message}
              </p>
              {item.metadata && Object.keys(item.metadata).length > 0 && (
                <pre className="text-[9px] bg-slate-950/80 border border-border rounded p-2 mt-2 font-mono text-slate-400 overflow-x-auto max-w-full">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
