import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AdminApp } from './App';

const mocks = vi.hoisted(() => ({
  login: vi.fn().mockResolvedValue({
    data: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'admin-1', role: 'admin', status: 'active' },
    },
  }),
}));

vi.mock('../api/client', () => ({
  setAuthSession: vi.fn(),
  clearAuthSession: vi.fn(),
  apiClient: {
    login: mocks.login,
    listModels: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } }),
    listCoachConfigs: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } }),
    listKnowledgeCards: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } }),
    listAgentRuns: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } }),
  },
}));

describe('AdminApp', () => {
  it('requires login before rendering the admin navigation', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/']}><AdminApp /></MemoryRouter></QueryClientProvider>);

    expect(screen.queryByRole('link', { name: '模型设置' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '管理员登录' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('账号'), 'admin@destiny.local');
    await userEvent.type(screen.getByLabelText('密码'), 'correct-horse-battery-staple');
    await userEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    expect(mocks.login).toHaveBeenCalledWith({
      identifier: 'admin@destiny.local',
      password: 'correct-horse-battery-staple',
      deviceName: 'React 管理后台',
    });
    expect(await screen.findByRole('link', { name: '模型设置' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '运营总览' })).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();
  });
});
