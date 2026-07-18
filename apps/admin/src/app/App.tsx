import { Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './AuthProvider';
import { AdminLayout } from '../layouts/AdminLayout';
import { AgentRunsPage } from '../features/agent-runs/AgentRunsPage';
import { LoginPage } from '../features/auth/LoginPage';
import { CoachConfigPage } from '../features/coach-config/CoachConfigPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { KnowledgeCardsPage } from '../features/knowledge-cards/KnowledgeCardsPage';
import { ModelsPage } from '../features/models/ModelsPage';

function AuthenticatedRoutes() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="coach-config" element={<CoachConfigPage />} />
        <Route path="knowledge-cards" element={<KnowledgeCardsPage />} />
        <Route path="agent-runs" element={<AgentRunsPage />} />
      </Route>
    </Routes>
  );
}

export function AdminApp() {
  return <AuthProvider><AuthenticatedRoutes /></AuthProvider>;
}
