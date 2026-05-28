import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver for Recharts compatibility inside JSDOM environment
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

// Mock window.open
window.open = vi.fn();
