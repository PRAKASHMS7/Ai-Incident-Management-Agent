import axios from 'axios';
import { create } from 'zustand';
import { useEffect, useRef } from 'react';
import { IncidentStateModel, SystemHealth } from './types';

// Detect host for cross-origin API routing fallback
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : '');

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

interface IncidentStore {
  incidents: IncidentStateModel[];
  activeIncident: IncidentStateModel | null;
  systemHealth: SystemHealth | null;
  loading: boolean;
  error: string | null;
  fetchIncidents: () => Promise<void>;
  fetchIncidentDetail: (id: string) => Promise<void>;
  resolveIncident: (id: string, operatorName?: string) => Promise<void>;
  fetchSystemHealth: () => Promise<void>;
  setActiveIncident: (incident: IncidentStateModel | null) => void;
  fetchChannels: (id: string) => Promise<string[]>;
  approveEscalation: (id: string, channel: string, notes: string, operatorName?: string) => Promise<void>;
  rejectEscalation: (id: string, operatorName?: string) => Promise<void>;
}

export const useIncidentStore = create<IncidentStore>((set, get) => ({
  incidents: [],
  activeIncident: null,
  systemHealth: null,
  loading: false,
  error: null,

  fetchIncidents: async () => {
    try {
      const res = await api.get<IncidentStateModel[]>('/incidents');
      // Sort incidents: active open ones first, then resolved, newest created first
      const sorted = res.data.sort((a, b) => {
        if (a.state === 'resolved' && b.state !== 'resolved') return 1;
        if (a.state !== 'resolved' && b.state === 'resolved') return -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      set({ incidents: sorted, error: null });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch incidents' });
    }
  },

  fetchIncidentDetail: async (id: string) => {
    const currentActive = get().activeIncident;
    if (!currentActive || currentActive.id !== id) {
      set({ loading: true });
    }
    try {
      const res = await api.get<IncidentStateModel>(`/incidents/${id}`);
      set({ activeIncident: res.data, loading: false, error: null });
    } catch (err: any) {
      set({ error: err.message || `Failed to fetch incident ${id}`, loading: false });
    }
  },

  resolveIncident: async (id: string, operatorName = 'operator') => {
    try {
      const res = await api.post<IncidentStateModel>(`/incidents/${id}/resolve?operator_name=${operatorName}`);
      set((state) => ({
        activeIncident: state.activeIncident?.id === id ? res.data : state.activeIncident,
        incidents: state.incidents.map((inc) => (inc.id === id ? res.data : inc)),
        error: null
      }));
    } catch (err: any) {
      set({ error: err.message || `Failed to resolve incident ${id}` });
    }
  },

  fetchSystemHealth: async () => {
    try {
      const res = await api.get<SystemHealth>('/health');
      set({ systemHealth: res.data, error: null });
    } catch (err: any) {
      // In degraded/down mode, health endpoint can throw 503 containing components state
      if (err.response && err.response.data) {
        set({ systemHealth: err.response.data, error: null });
      } else {
        set({ error: err.message || 'Failed to check system health' });
      }
    }
  },

  setActiveIncident: (incident) => set({ activeIncident: incident }),

  fetchChannels: async (id: string) => {
    try {
      const res = await api.get<string[]>(`/incidents/${id}/channels`);
      return res.data;
    } catch (err: any) {
      set({ error: err.message || `Failed to fetch channels for incident ${id}` });
      return [];
    }
  },

  approveEscalation: async (id: string, channel: string, notes: string, operatorName = 'Prakash') => {
    try {
      const res = await api.post<IncidentStateModel>(
        `/incidents/${id}/approve?operator_name=${operatorName}`,
        { channel, notes }
      );
      set((state) => ({
        activeIncident: state.activeIncident?.id === id ? res.data : state.activeIncident,
        incidents: state.incidents.map((inc) => (inc.id === id ? res.data : inc)),
        error: null
      }));
    } catch (err: any) {
      set({ error: err.message || `Failed to approve escalation for incident ${id}` });
    }
  },

  rejectEscalation: async (id: string, operatorName = 'Prakash') => {
    try {
      const res = await api.post<IncidentStateModel>(
        `/incidents/${id}/reject?operator_name=${operatorName}`
      );
      set((state) => ({
        activeIncident: state.activeIncident?.id === id ? res.data : state.activeIncident,
        incidents: state.incidents.map((inc) => (inc.id === id ? res.data : inc)),
        error: null
      }));
    } catch (err: any) {
      set({ error: err.message || `Failed to reject escalation for incident ${id}` });
    }
  }
}));

// Polling custom hook
export function usePolling(callback: () => void, delay: number, dependencies: any[] = []) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    // Immediate call on mount/dependencies changes
    savedCallback.current();

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(id);
  }, [delay, ...dependencies]);
}
