import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { api } from '../../api/client';
import { Spinner } from '../ui/Spinner';

interface DependencyGraphProps {
  affectedServices: string[];
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ affectedServices }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDatasetRef = useRef<DataSet<any> | null>(null);
  const edgesDatasetRef = useRef<DataSet<any> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // 1. Initial graph fetch and setup
  useEffect(() => {
    let active = true;

    async function drawGraph() {
      try {
        setLoading(true);
        const res = await api.get<{ nodes: any[]; edges: any[] }>('/topology/graph');
        if (!active || !containerRef.current) return;

        const backendNodes = res.data.nodes || [];
        const backendEdges = res.data.edges || [];

        // Map backend schemas to Vis.js nodes dataset
        const mappedNodes = backendNodes.map((n) => {
          const isDb = n.label === 'Database';
          const isAffected = affectedServices.includes(n.id);
          
          let color = isDb ? '#8b5cf6' : '#3b82f6'; // Purple for Database, Blue for Service
          if (isAffected) {
            color = '#ef4444'; // Red flashing indicators for anomalous nodes
          }

          return {
            id: n.id,
            label: n.id,
            shape: isDb ? 'database' : 'dot',
            size: isAffected ? 25 : 16,
            font: {
              color: '#f8fafc',
              size: 12,
              face: 'Outfit'
            },
            color: {
              background: color,
              border: isAffected ? '#fca5a5' : '#334155',
              highlight: {
                background: color,
                border: '#f8fafc'
              }
            },
            title: `
              <strong>Name:</strong> ${n.id}<br/>
              <strong>Type:</strong> ${n.label}<br/>
              ${Object.entries(n.properties || {})
                .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
                .join('<br/>')}
            `
          };
        });

        // Map backend relationships to Vis.js edges dataset
        const mappedEdges = backendEdges.map((e, idx) => {
          const props = e.props || {};
          return {
            id: `edge-${idx}`,
            from: e.source,
            to: e.target,
            arrows: {
              to: { enabled: true, scaleFactor: 0.8 }
            },
            label: props.protocol || 'http',
            font: {
              color: '#94a3b8',
              size: 9,
              align: 'horizontal',
              face: 'Outfit'
            },
            color: {
              color: '#334155',
              highlight: '#3b82f6',
              hover: '#3b82f6'
            },
            title: `Protocol: ${props.protocol || 'http'}<br/>Latency Limit: ${props.p99_latency_threshold_ms || 200}ms`
          };
        });

        const nodesDataset = new DataSet(mappedNodes);
        const edgesDataset = new DataSet(mappedEdges);

        nodesDatasetRef.current = nodesDataset;
        edgesDatasetRef.current = edgesDataset;

        const options = {
          physics: {
            forceAtlas2Based: {
              gravitationalConstant: -26,
              centralGravity: 0.005,
              springLength: 120,
              springConstant: 0.18
            },
            maxVelocity: 146,
            solver: 'forceAtlas2Based',
            timestep: 0.35,
            stabilization: { iterations: 150, updateInterval: 25 }
          },
          interaction: {
            hover: true,
            tooltipDelay: 100,
            zoomView: true,
            dragView: true
          },
          nodes: {
            borderWidth: 2,
            shadow: true
          },
          edges: {
            width: 1.5,
            smooth: {
              type: 'cubicBezier',
              forceDirection: 'none',
              roundness: 0.5
            }
          }
        };

        // Create the graph canvas network
        if (networkRef.current) {
          networkRef.current.destroy();
        }
        networkRef.current = new Network(containerRef.current, { nodes: nodesDataset, edges: edgesDataset }, options);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to load topology graph:', err);
        if (active) {
          setError(err.message || 'Failed to parse service dependency graph.');
          setLoading(false);
        }
      }
    }

    drawGraph();

    return () => {
      active = false;
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
      nodesDatasetRef.current = null;
      edgesDatasetRef.current = null;
    };
  }, []);

  // 2. Respond to affectedServices changes dynamically
  useEffect(() => {
    if (!nodesDatasetRef.current) return;

    const allNodes = nodesDatasetRef.current.get();
    const updates = allNodes.map((node: any) => {
      const isDb = node.shape === 'database';
      const isAffected = affectedServices.includes(node.id);
      const color = isAffected ? '#ef4444' : (isDb ? '#8b5cf6' : '#3b82f6');

      return {
        id: node.id,
        size: isAffected ? 25 : 16,
        color: {
          background: color,
          border: isAffected ? '#fca5a5' : '#334155',
          highlight: {
            background: color,
            border: '#f8fafc'
          }
        }
      };
    });

    nodesDatasetRef.current.update(updates);
  }, [affectedServices]);

  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-border h-full relative flex flex-col">
      <div className="px-5 py-3 border-b border-border bg-slate-900/30 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
          Service Dependency Topology
        </span>
        {affectedServices.length > 0 && (
          <span className="text-[10px] text-critical bg-critical/10 border border-critical/20 px-2 py-0.5 rounded font-semibold font-mono animate-pulse">
            Active Outage Scope
          </span>
        )}
      </div>

      <div className="flex-1 w-full min-h-[300px] bg-slate-950/20 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 z-10 gap-2 text-xs text-slate-400">
            <Spinner /> Loading Graph...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 gap-3 text-xs text-red-400 p-6 text-center">
            <span>⚠️ {error}</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full min-h-[300px]"></div>
      </div>
    </div>
  );
};
