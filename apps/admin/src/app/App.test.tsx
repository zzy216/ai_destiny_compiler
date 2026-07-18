import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AdminApp } from './App';

vi.mock('../api/client', () => ({
  apiClient: {
    listModels: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } }),
    listCoachConfigs: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } }),
    listKnowledgeCards: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } }),
    listAgentRuns: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } }),
  },
}));

describe('AdminApp', () => {
  it('renders the admin navigation and dashboard overview', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/']}><AdminApp /></MemoryRouter></QueryClientProvider>);

    expect(screen.getByText('命运编译器')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '模型设置' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '运营总览' })).toBeInTheDocument();
    expect(screen.getByText('开发模式')).toBeInTheDocument();
  });
});
