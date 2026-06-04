import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api, useIncidentStore } from '../../api/client';
import { Spinner } from '../ui/Spinner';
import { 
  FileText, 
  Download, 
  Edit2, 
  CheckSquare, 
  Save, 
  Brain, 
  Clock, 
  BarChart3, 
  Layers
} from 'lucide-react';

interface RCAEditorProps {
  incidentId: string;
}

const renderTable = (lines: string[], key: number) => {
  const rows = lines
    .map(line => {
      const cells = line.split('|').map(c => c.trim());
      if (cells[0] === '') cells.shift();
      if (cells[cells.length - 1] === '') cells.pop();
      return cells;
    })
    .filter(row => row.length > 0);
    
  if (rows.length === 0) return null;
  
  const hasDivider = rows[1] && rows[1].every(cell => /^:?-+:?$/.test(cell));
  
  const headerRow = rows[0];
  const dataRows = hasDivider ? rows.slice(2) : rows.slice(1);
  
  return (
    <div key={key} className="overflow-x-auto my-3 rounded-xl border border-slate-850 shadow-inner">
      <table className="w-full text-left border-collapse text-[11px]">
        <thead className="bg-[#0b1222]/85 border-b border-slate-850 text-slate-400 font-extrabold">
          <tr>
            {headerRow.map((cell, idx) => (
              <th key={idx} className="px-3 py-1.5">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody className="text-slate-200">
          {dataRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b border-slate-850/50 hover:bg-slate-850/20 transition-colors">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-1.5 font-medium leading-relaxed">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const renderParsedMarkdown = (mdText: string) => {
  const lines = mdText.split('\n');
  const blocks: Array<{ type: 'markdown' | 'table'; content: string; lines?: string[] }> = [];
  
  let currentBlock: { type: 'markdown' | 'table'; content: string; lines?: string[] } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableLine = line.trim().startsWith('|');
    
    if (isTableLine) {
      if (currentBlock && currentBlock.type === 'table') {
        currentBlock.lines!.push(line);
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'table', content: '', lines: [line] };
      }
    } else {
      if (currentBlock && currentBlock.type === 'markdown') {
        currentBlock.content += '\n' + line;
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'markdown', content: line };
      }
    }
  }
  if (currentBlock) {
    blocks.push(currentBlock);
  }
  
  return blocks.map((block, idx) => {
    if (block.type === 'table') {
      return renderTable(block.lines!, idx);
    } else {
      return (
        <ReactMarkdown
          key={idx}
          components={{
            h1: ({ node, ...props }) => (
              <h1 className="text-[16px] font-black text-slate-100 mt-2 mb-4 border-b border-slate-800 pb-1.5 flex items-center gap-2" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="text-[14px] font-extrabold text-slate-200 mt-5 mb-2.5 flex items-center gap-2" {...props} />
            ),
            h3: ({ node, ...props }) => {
              const text = props.children?.toString() || '';
              let icon = <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
              if (text.toLowerCase().includes('summary')) {
                icon = <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
              } else if (text.toLowerCase().includes('root cause') || text.toLowerCase().includes('hypotheses')) {
                icon = <Brain className="w-4 h-4 text-purple-400 shrink-0" />;
              } else if (text.toLowerCase().includes('timeline')) {
                icon = <Clock className="w-4 h-4 text-purple-400 shrink-0" />;
              } else if (text.toLowerCase().includes('remediation') || text.toLowerCase().includes('action items')) {
                icon = <CheckSquare className="w-4 h-4 text-purple-400 shrink-0" />;
              }
              return (
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 mt-6 mb-3 animate-fade-in-up">
                  {icon}
                  <h3 className="text-[12.5px] font-extrabold text-slate-150 uppercase tracking-wide" {...props} />
                </div>
              );
            },
            p: ({ node, ...props }) => (
              <p className="text-[11px] leading-relaxed text-slate-355 mb-3 font-medium" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="text-[11px] leading-relaxed text-slate-300 ml-4 list-disc mb-1 font-medium" {...props} />
            ),
            strong: ({ node, ...props }) => <strong className="font-extrabold text-slate-100" {...props} />,
            hr: () => <div className="my-4 border-t border-slate-850" />
          }}
        >
          {block.content}
        </ReactMarkdown>
      );
    }
  });
};

export const RCAEditor: React.FC<RCAEditorProps> = ({ incidentId }) => {
  const { incidents } = useIncidentStore();
  const incident = incidents.find((i) => i.id === incidentId);

  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedMarkdown, setEditedMarkdown] = useState<string>('');
  const [actionItems, setActionItems] = useState<{ id: number; text: string; completed: boolean }[]>([]);

  useEffect(() => {
    async function fetchRca() {
      try {
        setLoading(true);
        const res = await api.get<string>(`/rca/${incidentId}`);
        setMarkdown(res.data);
        setEditedMarkdown(res.data);
        
        // Parse simple markdown checklist checkboxes e.g. - [ ] or - [x]
        const lines = res.data.split('\n');
        const items: { id: number; text: string; completed: boolean }[] = [];
        let count = 0;
        lines.forEach((line) => {
          const match = line.match(/^-\s+\[(x|\s| )\]\s+(.*)$/i);
          if (match) {
            items.push({
              id: count++,
              completed: match[1].toLowerCase() === 'x',
              text: match[2].trim()
            });
          }
        });
        setActionItems(items);
        setError(null);
      } catch (err: any) {
        // Incident might not be resolved yet
        if (err.response && err.response.status === 404) {
          setError('Incident is not resolved yet. Resolve the incident to view/generate the POST-INCIDENT REPORT.');
        } else {
          setError(err.message || 'Failed to retrieve RCA report.');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchRca();
  }, [incidentId]);

  const handleExport = () => {
    window.open(`${api.defaults.baseURL || ''}/rca/${incidentId}/export`, '_blank');
  };

  const handleJsonExport = () => {
    window.open(`${api.defaults.baseURL || ''}/rca/${incidentId}/json`, '_blank');
  };

  const handleToggleCheck = async (id: number) => {
    let updatedMd = '';
    const newItems = actionItems.map((item) => {
      if (item.id === id) {
        const updatedVal = !item.completed;
        let currentMd = isEditing ? editedMarkdown : markdown;
        const escapedText = item.text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(-\\s+\\[[x\\s ]\\]\\s+)(${escapedText})`, 'i');
        const replacement = ` - [${updatedVal ? 'x' : ' '}] ${item.text}`;
        updatedMd = currentMd.replace(regex, replacement);
        return { ...item, completed: updatedVal };
      }
      return item;
    });

    if (updatedMd) {
      setMarkdown(updatedMd);
      setEditedMarkdown(updatedMd);
      setActionItems(newItems);
      try {
        await api.put(`/rca/${incidentId}`, { markdown_content: updatedMd });
      } catch (err: any) {
        console.error('Failed to save checklist state:', err);
      }
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/rca/${incidentId}`, { markdown_content: editedMarkdown });
      setMarkdown(editedMarkdown);
      setIsEditing(false);
    } catch (err: any) {
      alert('Failed to save RCA edits: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-xl border border-border flex items-center justify-center gap-2 text-[13px] text-slate-400">
        <Spinner /> Loading RCA report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 rounded-xl border border-border text-center text-slate-500 text-[13px] flex flex-col items-center gap-3">
        <span>⚠️ {error}</span>
      </div>
    );
  }

  // Parse severity and hypotheses metadata from markdown
  const severityVal = incident?.severity || 'warning';
  const hypothesisCount = incident?.hypotheses?.length || 3;
  const businessImpact = severityVal.toLowerCase() === 'critical' ? 'High' : 'Medium';

  // Calculate action list progress
  const completedCount = actionItems.filter(item => item.completed).length;
  const totalCount = actionItems.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="rca-report-container rounded-2xl overflow-hidden border border-slate-800/80 flex flex-col h-full min-h-[500px] shadow-2xl animate-fade-in-up delay-120">
      {/* Report Header Panel */}
      <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[13px] font-extrabold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span>POST-INCIDENT REPORT</span>
          </h3>
          <span className="text-[9.5px] text-slate-550 font-mono">Incident ID: {incidentId}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isEditing) {
                handleSave();
              } else {
                setIsEditing(true);
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-purple-450 hover:border-purple-500/30 hover:shadow-[0_0_12px_rgba(168,85,247,0.15)] transition-all duration-250 flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
          >
            {isEditing ? (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Report
              </>
            ) : (
              <>
                <Edit2 className="w-3.5 h-3.5" />
                Edit Markdown
              </>
            )}
          </button>
          
          <button
            onClick={handleExport}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-655 to-indigo-655 text-slate-100 hover:from-purple-600 hover:to-indigo-600 hover:shadow-[0_4px_16px_rgba(168,85,247,0.25)] hover:-translate-y-0.5 transition-all duration-250 flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            PDF Export
          </button>

          <button
            onClick={handleJsonExport}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-655 to-sky-655 text-slate-100 hover:from-blue-600 hover:to-sky-600 hover:shadow-[0_4px_16px_rgba(59,130,246,0.25)] hover:-translate-y-0.5 transition-all duration-250 flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            JSON Export
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border-b border-slate-800 bg-[#070b16]/30">
        {/* Metric 1 */}
        <div className="bg-[#0b1222]/40 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-0.5 hover:shadow-[0_4px_12px_rgba(168,85,247,0.05)] transition-all duration-300">
          <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Severity</span>
          <span className={`text-[11px] font-bold uppercase inline-flex items-center gap-1 mt-0.5
            ${severityVal.toLowerCase() === 'critical' ? 'text-rose-455 status-glow-critical' : 
              severityVal.toLowerCase() === 'warning' ? 'text-amber-400 status-glow-warning' : 'text-blue-405 status-glow-open'}
          `}>
            {severityVal}
          </span>
        </div>
        {/* Metric 2 */}
        <div className="bg-[#0b1222]/40 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-0.5 hover:shadow-[0_4px_12px_rgba(168,85,247,0.05)] transition-all duration-300">
          <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Hypotheses</span>
          <span className="text-[12px] font-bold text-purple-400 flex items-center gap-1 mt-0.5 leading-none">
            <Brain className="w-3.5 h-3.5" /> {hypothesisCount} Generated
          </span>
        </div>
        {/* Metric 3 */}
        <div className="bg-[#0b1222]/40 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.05)] transition-all duration-300">
          <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Business Impact</span>
          <span className="text-[12px] font-bold text-indigo-400 flex items-center gap-1 mt-0.5 leading-none">
            <BarChart3 className="w-3.5 h-3.5" /> {businessImpact}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
        {/* Left Side: Markdown View / Raw Editor */}
        <div className="flex-1 p-6 overflow-y-auto max-h-[600px] text-[11px] leading-relaxed text-slate-200">
          {isEditing ? (
            <textarea
              value={editedMarkdown}
              onChange={(e) => setEditedMarkdown(e.target.value)}
              className="w-full h-[450px] bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 font-mono text-[10px] text-slate-350 focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_12px_rgba(168,85,247,0.15)] transition-all duration-300"
            />
          ) : (
            <article className="prose prose-invert max-w-none text-[11px]">
              {renderParsedMarkdown(markdown)}
            </article>
          )}
        </div>

        {/* Right Side: Interactive Action Item Checks */}
        {actionItems.length > 0 && (
          <div className="w-full md:w-72 p-4 bg-slate-900/10 flex flex-col gap-3.5 shrink-0">
            <div className="flex flex-col gap-1.5 border-b border-slate-800 pb-2.5">
              <h4 className="text-[11px] font-bold text-slate-200 tracking-wider flex items-center gap-1.5 uppercase">
                <CheckSquare className="w-4 h-4 text-purple-400" />
                Remediation Checklist
              </h4>
              {/* Progress Indicator */}
              <div className="flex flex-col gap-1 mt-1.5">
                <div className="flex justify-between items-center text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">
                  <span>Progress</span>
                  <span className="text-purple-400">{completedCount} / {totalCount} Done ({progressPercent}%)</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 h-[450px] overflow-y-auto pr-1">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleCheck(item.id)}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all duration-200
                    ${item.completed 
                      ? 'bg-emerald-500/5 border-emerald-500/15 text-slate-500 line-through shadow-[0_0_10px_rgba(16,185,129,0.06)] scale-[0.99]' 
                      : 'bg-[#090e1c]/45 border-amber-500/15 hover:border-amber-500/40 text-slate-200 shadow-[0_0_10px_rgba(245,158,11,0.05)] hover:shadow-[0_0_12px_rgba(245,158,11,0.12)] hover:-translate-y-0.5'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => {}} // Controlled by row container click
                    className={`mt-0.5 h-3 w-3 rounded cursor-pointer ${item.completed ? 'accent-emerald-500' : 'accent-amber-500'}`}
                  />
                  <span className="text-[11px] font-medium leading-normal select-none">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
