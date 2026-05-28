import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { RcaViewerPage } from './pages/RcaViewerPage';
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
          <main className="flex-1 overflow-y-auto p-8">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/incidents/:id" element={<IncidentDetailPage />} />
              <Route path="/rca" element={<RcaViewerPage />} />
              <Route path="/health" element={<AgentHealthPage />} />
              <Route 
                path="/topology" 
                element={
                  <div className="h-[600px] w-full">
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
