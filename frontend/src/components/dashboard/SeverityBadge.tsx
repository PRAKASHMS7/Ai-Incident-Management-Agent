import React from 'react';

interface SeverityBadgeProps {
  severity: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const sev = severity.toLowerCase();
  
  if (sev === 'critical') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 badge-breathing-red shadow-[0_0_8px_rgba(239,68,68,0.1)]">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
        CRITICAL
      </span>
    );
  }

  if (sev === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 badge-breathing-amber shadow-[0_0_8px_rgba(245,158,11,0.1)]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
        WARNING
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.1)]">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
      INFO
    </span>
  );
};
