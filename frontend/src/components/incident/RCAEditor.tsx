import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../../api/client';
import { Spinner } from '../ui/Spinner';
import { FileText, Download, Edit2, CheckSquare, Save } from 'lucide-react';

interface RCAEditorProps {
  incidentId: string;
}

export const RCAEditor: React.FC<RCAEditorProps> = ({ incidentId }) => {
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
          setError('Incident is not resolved yet. Resolve the incident to view/generate the RCA Post-Mortem Report.');
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
      <div className="glass-panel p-12 rounded-xl border border-border flex items-center justify-center gap-2 text-xs text-slate-400">
        <Spinner /> Loading RCA report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 rounded-xl border border-border text-center text-slate-500 text-xs flex flex-col items-center gap-3">
        <span>⚠️ {error}</span>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-border flex flex-col h-full min-h-[500px]">
      <div className="px-6 py-4 border-b border-border bg-slate-900/40 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Root Cause Analysis (RCA) Post-Mortem
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isEditing) {
                handleSave();
              } else {
                setIsEditing(true);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            {isEditing ? (
              <>
                <Save className="w-3.5 h-3.5" />
                Save
              </>
            ) : (
              <>
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </>
            )}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 hover:border-primary/40 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Left Side: Markdown View / Raw Editor */}
        <div className="flex-1 p-6 overflow-y-auto max-h-[600px] text-xs leading-relaxed text-slate-200">
          {isEditing ? (
            <textarea
              value={editedMarkdown}
              onChange={(e) => setEditedMarkdown(e.target.value)}
              className="w-full h-[450px] bg-slate-950/80 border border-border rounded-lg p-4 font-mono text-[11px] text-slate-300 focus:outline-none focus:border-primary/50"
            />
          ) : (
            <article className="prose prose-invert prose-xs max-w-none prose-headings:text-slate-100 prose-strong:text-slate-200 prose-code:text-primary prose-table:border prose-table:border-border prose-th:bg-slate-900/30 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </article>
          )}
        </div>

        {/* Right Side: Interactive Action Item Checks */}
        {actionItems.length > 0 && (
          <div className="w-full md:w-80 p-5 bg-slate-900/10 flex flex-col gap-4">
            <h4 className="text-xs font-bold text-slate-300 tracking-wider flex items-center gap-1.5 uppercase border-b border-border/80 pb-3">
              <CheckSquare className="w-4 h-4 text-primary" />
              Remediation Checklist
            </h4>
            <div className="flex flex-col gap-3">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleCheck(item.id)}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all duration-150
                    ${item.completed 
                      ? 'bg-success/5 border-success/15 text-slate-500 line-through' 
                      : 'bg-card border-border hover:border-primary/40 text-slate-300'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => {}} // Controlled by row container click
                    className="mt-1 h-3.5 w-3.5 accent-success rounded cursor-pointer"
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
