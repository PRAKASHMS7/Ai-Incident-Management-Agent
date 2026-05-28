import React, { useMemo, useState } from 'react';
import { Terminal, Search, Filter } from 'lucide-react';

interface LokiLogsTerminalProps {
  service: string;
}

export const LokiLogsTerminal: React.FC<LokiLogsTerminalProps> = ({ service }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Generate simulated logs representing application error spikes
  const logs = useMemo(() => {
    const lines = [];
    const timestamp = new Date().toISOString().slice(0, 10);
    
    // Ingest logs
    lines.push({ ts: `${timestamp}T10:00:01.002Z`, lvl: 'INFO', msg: `Starting connection listener on ${service}:8080` });
    lines.push({ ts: `${timestamp}T10:00:05.150Z`, lvl: 'INFO', msg: 'Spring DataSource configuration established. Pool size: 10' });
    lines.push({ ts: `${timestamp}T10:01:12.441Z`, lvl: 'DEBUG', msg: 'Fetching dependency graph config endpoints' });
    lines.push({ ts: `${timestamp}T10:02:18.995Z`, lvl: 'INFO', msg: 'Successful keep-alive ping to database user-db' });
    
    // The anomaly begins
    lines.push({ ts: `${timestamp}T10:03:00.005Z`, lvl: 'WARN', msg: 'Database connection pool usage reached 90% (9 active connections)' });
    lines.push({ ts: `${timestamp}T10:03:02.112Z`, lvl: 'WARN', msg: 'Slow query detected: SELECT * FROM transaction_records WHERE status = PENDING (duration: 1250ms)' });
    lines.push({ ts: `${timestamp}T10:03:05.510Z`, lvl: 'ERROR', msg: 'ConnectionAcquisitionTimeoutException: Failed to acquire JDBC Connection within 1000ms' });
    lines.push({ ts: `${timestamp}T10:03:05.511Z`, lvl: 'ERROR', msg: '  at org.hibernate.engine.jdbc.connections.internal.BasicConnectionCreator.createConnection(BasicConnectionCreator.java:54)' });
    lines.push({ ts: `${timestamp}T10:03:05.512Z`, lvl: 'ERROR', msg: '  at org.hibernate.engine.jdbc.connections.internal.PooledConnections.borrowConnection(PooledConnections.java:102)' });
    lines.push({ ts: `${timestamp}T10:03:05.513Z`, lvl: 'ERROR', msg: '  at com.zaxxer.hikari.HikariPool.getConnection(HikariPool.java:162)' });
    lines.push({ ts: `${timestamp}T10:03:07.881Z`, lvl: 'ERROR', msg: 'Servlet.service() for servlet [dispatcherServlet] in context with path [] threw exception [Request processing failed; nested exception is org.springframework.dao.DataAccessResourceFailureException: Could not obtain DB connection]' });
    lines.push({ ts: `${timestamp}T10:03:10.002Z`, lvl: 'FATAL', msg: `Critical failure on ${service}: JVM OutOfMemoryError: Metaspace limit exceeded` });
    lines.push({ ts: `${timestamp}T10:03:12.404Z`, lvl: 'ERROR', msg: 'HTTP 500: Internal Server error on path /checkout' });
    lines.push({ ts: `${timestamp}T10:04:00.015Z`, lvl: 'INFO', msg: 'Restarting JVM process container...' });
    lines.push({ ts: `${timestamp}T10:04:15.550Z`, lvl: 'INFO', msg: `Service ${service} re-started successfully.` });

    return lines;
  }, [service]);

  // Filtering
  const filteredLogs = logs.filter((log) => {
    const rowText = `${log.ts} ${log.lvl} ${log.msg}`.toLowerCase();
    return rowText.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-border flex flex-col h-[400px]">
      {/* Console Controls bar */}
      <div className="px-5 py-3 border-b border-border bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
            Loki Live Logs Console
          </span>
        </div>
        <div className="flex items-center gap-2 max-w-xs w-full">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs stream..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 bg-slate-950 p-4 font-mono text-[10px] overflow-y-auto flex flex-col gap-1 select-text">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 text-center py-12">
            No matching log entries found.
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            let levelColor = 'text-slate-400';
            if (log.lvl === 'ERROR' || log.lvl === 'FATAL') levelColor = 'text-red-500 font-bold';
            else if (log.lvl === 'WARN') levelColor = 'text-amber-500 font-bold';
            else if (log.lvl === 'INFO') levelColor = 'text-green-500';

            const highlightMsg = (msg: string) => {
              // Highlight common SRE exception keywords in the log line
              const regex = /(Exception|Timeout|500|OutOfMemoryError|database|failed)/gi;
              const parts = msg.split(regex);
              if (parts.length === 1) return msg;

              return parts.map((part, i) => {
                if (part.match(regex)) {
                  return <span key={i} className="text-red-400 bg-red-950/30 px-0.5 rounded font-bold">{part}</span>;
                }
                return part;
              });
            };

            return (
              <div key={idx} className="flex gap-2 hover:bg-slate-900/40 py-0.5 px-1 rounded transition-colors">
                <span className="text-slate-600 select-none">{log.ts}</span>
                <span className={`w-10 select-none ${levelColor}`}>[{log.lvl}]</span>
                <span className="text-slate-300 flex-1 whitespace-pre-wrap">{highlightMsg(log.msg)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
