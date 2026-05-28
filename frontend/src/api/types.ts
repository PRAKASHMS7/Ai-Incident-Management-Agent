export interface StandardizedAlert {
  id: string;
  name: string;
  service: string;
  severity: string;
  description: string;
  starts_at: string;
  ends_at?: string | null;
  details?: Record<string, any>;
}

export interface Hypothesis {
  rank: number;
  hypothesis: string;
  confidence_score: number;
  evidence: string[];
  recommended_action: string;
}

export interface TimelineItem {
  timestamp: string;
  event_type: 'alert_triggered' | 'metric_anomaly' | 'log_error' | 'agent_milestone' | 'operator_action' | 'escalation_failed';
  source: 'prometheus' | 'loki' | 'system' | 'slack_operator';
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

export interface IncidentStateModel {
  id: string;
  state: 'open' | 'analyzing' | 'awaiting_approval' | 'escalated' | 'resolved' | 'merged';
  severity: 'critical' | 'warning' | 'info';
  services_affected: string[];
  primary_incident_alert_id: string;
  alerts: StandardizedAlert[];
  timeline: TimelineItem[];
  hypotheses: Hypothesis[];
  created_at: string;
  updated_at: string;
  merged_into?: string | null;
  rca_document_url?: string | null;
}

export interface RcaReport {
  incident_id: string;
  title: string;
  markdown_content: string;
  resolved_at: string;
  last_updated_at: string;
}

export interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  uptime_seconds?: number;
  [key: string]: any;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy';
  components: {
    redis: ComponentHealth;
    neo4j: ComponentHealth;
  };
}
