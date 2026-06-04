import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewPage } from './pages/OverviewPage';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { RcaViewerPage } from './pages/RcaViewerPage';
import { TimelinePage } from './pages/TimelinePage';
import { PostMortemsPage } from './pages/PostMortemsPage';
import { AlertsPage } from './pages/AlertsPage';
import { EscalationsPage } from './pages/EscalationsPage';
import { AgentHealthPage } from './pages/AgentHealthPage';
import { DependencyGraph } from './components/incident/DependencyGraph';
import { PageHeader } from './components/layout/PageHeader';
import { LoginPage } from './pages/LoginPage';

const AppContent: React.FC = () => {
  const location = useLocation();
  const isAuthenticated = localStorage.getItem('demo-auth') === 'true';

  if (!isAuthenticated) {
    if (location.pathname !== '/login') {
      return <Navigate to="/login" replace />;
    }
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return (
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
            <Route path="/alerts-list" element={<AlertsPage />} />
            <Route path="/escalations" element={<EscalationsPage />} />
            <Route path="/health" element={<AgentHealthPage />} />
            
            {/* Topology view */}
            <Route 
              path="/topology" 
              element={
                <div className="flex flex-col gap-6">
                  <PageHeader 
                    title="Dependency Map" 
                    subtitle="Real-time SRE microservices topology and telemetry correlation graph." 
                    showSearch={false}
                  />
                  <div className="h-[600px] w-full border border-slate-800 rounded-2xl p-5 bg-[#0B1020]/90 shadow-lg">
                    <DependencyGraph affectedServices={[]} />
                  </div>
                </div>
              } 
            />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};
export default App;
