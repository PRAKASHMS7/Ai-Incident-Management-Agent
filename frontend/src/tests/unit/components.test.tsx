import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SeverityBadge } from '../../components/dashboard/SeverityBadge';
import { IncidentCard } from '../../components/dashboard/IncidentCard';
import { IncidentTable } from '../../components/dashboard/IncidentTable';
import { IncidentStateModel } from '../../api/types';
import { TimelineViewer } from '../../components/incident/TimelineViewer';

// Mock react-router-dom useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useNavigate: () => mockNavigate
  };
});

describe('SeverityBadge Component', () => {
  test('renders critical badge correctly', () => {
    render(<SeverityBadge severity="critical" />);
    const el = screen.getByText('CRITICAL');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('text-red-400');
  });

  test('renders warning badge correctly', () => {
    render(<SeverityBadge severity="warning" />);
    const el = screen.getByText('WARNING');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('text-amber-400');
  });

  test('renders info badge correctly', () => {
    render(<SeverityBadge severity="info" />);
    const el = screen.getByText('INFO');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('text-blue-400');
  });
});

const mockIncident: IncidentStateModel = {
  id: 'inc-test-uuid-12345',
  state: 'open',
  severity: 'critical',
  services_affected: ['payment-service', 'checkout-service'],
  primary_incident_alert_id: 'alert-1',
  alerts: [],
  timeline: [],
  hypotheses: [],
  created_at: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
  updated_at: new Date().toISOString()
};

describe('IncidentCard Component', () => {
  test('renders incident information details', () => {
    render(
      <BrowserRouter>
        <IncidentCard incident={mockIncident} onResolve={vi.fn()} />
      </BrowserRouter>
    );

    expect(screen.getByText('payment-service, checkout-service')).toBeInTheDocument();
    expect(screen.getByText('State:')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('Resolve')).toBeInTheDocument();
  });

  test('navigates to incident details page on click', () => {
    render(
      <BrowserRouter>
        <IncidentCard incident={mockIncident} onResolve={vi.fn()} />
      </BrowserRouter>
    );

    const card = screen.getByText('payment-service, checkout-service');
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith('/incidents/inc-test-uuid-12345');
  });
});

describe('IncidentTable Component', () => {
  test('renders incident list rows', () => {
    render(
      <BrowserRouter>
        <IncidentTable incidents={[mockIncident]} onResolve={vi.fn()} />
      </BrowserRouter>
    );

    expect(screen.getByText('inc-test...')).toBeInTheDocument();
    expect(screen.getByText('payment-service, checkout-service')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
  });

  test('resolves incident when clicked', () => {
    const mockResolve = vi.fn();
    window.confirm = () => true;

    render(
      <BrowserRouter>
        <IncidentTable incidents={[mockIncident]} onResolve={mockResolve} />
      </BrowserRouter>
    );

    const btn = screen.getByText('Resolve');
    fireEvent.click(btn);
    expect(mockResolve).toHaveBeenCalledWith('inc-test-uuid-12345');
  });
});

describe('TimelineViewer Component', () => {
  test('renders timeline event timestamps in correct IST format', () => {
    const mockTimeline = [
      {
        timestamp: '2026-05-30T16:07:12Z',
        event_type: 'alert_triggered',
        source: 'prometheus',
        message: 'High CPU utilization detected on database node.',
        severity: 'critical',
        metadata: {}
      }
    ];

    render(<TimelineViewer timeline={mockTimeline} />);
    
    // We expect "30 May 2026, 09:37:12 PM IST" to be displayed in the document
    expect(screen.getByText(/30 May 2026, 09:37:12 PM IST/)).toBeInTheDocument();
  });
});
