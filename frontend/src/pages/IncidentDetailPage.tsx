import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useIncidentStore, usePolling } from '../api/client';
import { TelemetryGraphs } from '../components/incident/TelemetryGraphs';
import { LokiLogsTerminal } from '../components/incident/LokiLogsTerminal';
import { HypothesisPanel } from '../components/incident/HypothesisPanel';
import { TimelineViewer } from '../components/incident/TimelineViewer';
import { DependencyGraph } from '../components/incident/DependencyGraph';
import { RCAEditor } from '../components/incident/RCAEditor';
import { SeverityBadge } from '../components/dashboard/SeverityBadge';
import { ArrowLeft, Play, ShieldCheck, Terminal, Activity, FileText, Brain, Network } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeIncident, fetchIncidentDetail, resolveIncident, loading } = useIncidentStore();
  const [leftTab, setLeftTab] = useState<'metrics' | 'logs'>('metrics');
  const [rightTab, setRightTab] = useState<'hypotheses' | 'timeline' | 'topology' | 'rca'>('hypotheses');

  // Load details on mount and poll details every 5 seconds if open
  usePolling(
    () => {
      if (id) {
        fetchIncidentDetail(id);
      }
    },
    5000,
    [id]
  );

  const handleResolve = () => {
    if (id && confirm('Resolve this incident and generate the RCA post-mortem?')) {
      resolveIncident(id);
    }
  };

  if (loading && !activeIncident) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-2 text-slate-400 text-xs">
        <Spinner /> Querying incident records...
      </div>
    );
  }

  if (!activeIncident) {
    return (
      <div className="glass-panel p-8 text-center text-red-400 text-xs flex flex-col items-center gap-4">
        <span>⚠️ Incident details not found.</span>
        <Link to="/" className="text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const primaryService = activeIncident.services_affected[0] || 'default';
  const isOpen = activeIncident.state !== 'resolved';

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Breadcrumb toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-2">
          <Link to="/" className="text-xs text-slate-400 hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Triage Workbench
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-100">Incident Triage: {activeIncident.id.slice(0, 8)}...</h2>
            <SeverityBadge severity={activeIncident.severity} />
          </div>
        </div>

        {isOpen ? (
          <button
            onClick={handleResolve}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-slate-100 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(239,68,68,0.3)]"
          >
            <ShieldCheck className="w-4 h-4" />
            Resolve Incident & Generate RCA
          </button>
        ) : (
          <span className="px-3 py-1.5 rounded-lg bg-success/15 border border-success/30 text-success text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Incident Resolved
          </span>
        )}
      </div>

      {/* Main workspace layout: Split pane */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        
        {/* Left column: Telemetry Enriched Data */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border">
            <button
              onClick={() => setLeftTab('metrics')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${leftTab === 'metrics' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Activity className="w-4 h-4" />
              Prometheus Metrics
            </button>
            <button
              onClick={() => setLeftTab('logs')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${leftTab === 'logs' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Terminal className="w-4 h-4" />
              Loki Logs
            </button>
          </div>

          <div className="min-h-[400px]">
            {leftTab === 'metrics' ? (
              <TelemetryGraphs service={primaryService} />
            ) : (
              <LokiLogsTerminal service={primaryService} />
            )}
          </div>
        </div>

        {/* Right column: Reasoning & Graph nodes */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-border">
            <button
              onClick={() => setRightTab('hypotheses')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${rightTab === 'hypotheses' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Brain className="w-4 h-4" />
              Ranked Hypotheses
            </button>
            <button
              onClick={() => setRightTab('timeline')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${rightTab === 'timeline' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Play className="w-4 h-4" />
              Timeline Logs
            </button>
            <button
              onClick={() => setRightTab('topology')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                ${rightTab === 'topology' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Network className="w-4 h-4" />
              Dependency Graph
            </button>
            {!isOpen && (
              <button
                onClick={() => setRightTab('rca')}
                className={`pb-2 px-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5
                  ${rightTab === 'rca' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                  }
                `}
              >
                <FileText className="w-4 h-4" />
                RCA Post-Mortem
              </button>
            )}
          </div>

          <div className="min-h-[400px]">
            {rightTab === 'hypotheses' && (
              <HypothesisPanel hypotheses={activeIncident.hypotheses} />
            )}
            {rightTab === 'timeline' && (
              <TimelineViewer timeline={activeIncident.timeline} />
            )}
            {rightTab === 'topology' && (
              <DependencyGraph affectedServices={activeIncident.services_affected} />
            )}
            {rightTab === 'rca' && !isOpen && (
              <RCAEditor incidentId={activeIncident.id} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
