import React from 'react';
import { Hypothesis } from '../../api/types';
import { ShieldCheck, BookOpen } from 'lucide-react';

interface HypothesisPanelProps {
  hypotheses: Hypothesis[];
}

export const HypothesisPanel: React.FC<HypothesisPanelProps> = ({ hypotheses }) => {
  if (!hypotheses || hypotheses.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-xl border border-border text-center text-slate-500 text-xs">
        No root cause hypotheses generated for this incident.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {hypotheses.map((h) => {
        const pct = Math.round(h.confidence_score * 100);
        
        // Dynamic color coding based on confidence
        let progressBg = 'bg-primary';
        if (pct >= 80) progressBg = 'bg-success';
        else if (pct >= 50) progressBg = 'bg-warning';
        else progressBg = 'bg-critical';

        return (
          <div 
            key={h.rank}
            className={`glass-panel p-5 rounded-xl border border-border/80 flex flex-col gap-3 relative
              ${h.rank === 1 ? 'border-primary/20 shadow-[0_0_12px_rgba(59,130,246,0.06)]' : ''}
            `}
          >
            {/* Rank badge */}
            <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 w-7 h-7 rounded-full bg-slate-900 border border-border text-xs font-bold text-primary flex items-center justify-center shadow-lg">
              #{h.rank}
            </div>

            {/* Title / Description */}
            <h4 className="text-sm font-bold text-slate-100 flex items-start gap-2 pr-4 leading-snug">
              {h.hypothesis}
            </h4>

            {/* Confidence Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>Diagnostic Confidence</span>
                <span className="font-mono text-slate-200">{pct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                <div 
                  className={`h-full rounded-full ${progressBg} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>

            {/* Evidence items */}
            <div className="flex flex-col gap-1.5 mt-1 border-t border-border/60 pt-3">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1 uppercase">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                Evidence Logs/Metrics
              </span>
              <ul className="flex flex-col gap-1 pl-1">
                {h.evidence.map((ev, idx) => (
                  <li key={idx} className="text-[11px] text-slate-300 font-mono flex items-start gap-1.5 leading-relaxed">
                    <span className="text-primary mt-1">•</span>
                    {ev}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action recommended */}
            <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3 text-xs bg-slate-900/10 -mx-5 -mb-5 p-4 rounded-b-xl border-l-2 border-l-primary/60">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1 uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                Recommended Operator Action
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                {h.recommended_action}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
