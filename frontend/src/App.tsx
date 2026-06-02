import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewPage } from './pages/OverviewPage';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { RcaViewerPage } from './pages/RcaViewerPage';
import { TimelinePage } from './pages/TimelinePage';
import { PostMortemsPage } from './pages/PostMortemsPage';
import { ServicesPage } from './pages/ServicesPage';
import { AlertsPage } from './pages/AlertsPage';
import { EscalationsPage } from './pages/EscalationsPage';
import { AgentHealthPage } from './pages/AgentHealthPage';
import { DependencyGraph } from './components/incident/DependencyGraph';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        {/* Navigation Sidebar */}
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Global Header */}
          <Header />

          {/* Main viewport area */}
          <main className="flex-1 overflow-y-auto p-8 bg-[#050816]">
            <Routes>
              {/* Executive landing page */}
              <Route path="/" element={<OverviewPage />} />
              <Route path="/overview" element={<Navigate to="/" replace />} />
              
              {/* Triage workbench */}
              <Route path="/incidents" element={<DashboardPage />} />
              <Route path="/incidents/:id" element={<IncidentDetailPage />} />
              
              {/* Specialized SRE diagnostics pages */}
              <Route path="/rca" element={<RcaViewerPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/postmortems" element={<PostMortemsPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/alerts-list" element={<AlertsPage />} />
              <Route path="/escalations" element={<EscalationsPage />} />
              <Route path="/health" element={<AgentHealthPage />} />
              
              {/* Topology view */}
              <Route 
                path="/topology" 
                element={
                  <div className="h-[600px] w-full border border-slate-800 rounded-2xl p-5 bg-[#0B1020]/90 shadow-lg">
                    <DependencyGraph affectedServices={[]} />
                  </div>
                } 
              />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};
export default App;
