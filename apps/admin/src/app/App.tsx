import { Route, Routes } from 'react-router-dom';

import { AdminLayout } from '../layouts/AdminLayout';
import { AgentRunsPage } from '../features/agent-runs/AgentRunsPage';
import { CoachConfigPage } from '../features/coach-config/CoachConfigPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { KnowledgeCardsPage } from '../features/knowledge-cards/KnowledgeCardsPage';
import { ModelsPage } from '../features/models/ModelsPage';

export function AdminApp() {
  return <Routes><Route element={<AdminLayout />}><Route index element={<DashboardPage />} /><Route path="models" element={<ModelsPage />} /><Route path="coach-config" element={<CoachConfigPage />} /><Route path="knowledge-cards" element={<KnowledgeCardsPage />} /><Route path="agent-runs" element={<AgentRunsPage />} /></Route></Routes>;
}
