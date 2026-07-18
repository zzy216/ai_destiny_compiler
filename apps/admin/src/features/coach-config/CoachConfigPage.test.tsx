import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CoachConfigPage } from './CoachConfigPage';

vi.mock('../../api/client', () => ({
  apiClient: {
    listCoachConfigs: vi.fn().mockResolvedValue({
      data: [{ id: 'coach-1', version: 1, name: '默认教练', status: 'draft', productGoal: '帮助用户行动' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    }),
    createCoachConfig: vi.fn(),
    updateCoachConfig: vi.fn(),
    publishCoachConfig: vi.fn(),
  },
}));

describe('CoachConfigPage', () => {
  it('lists coach configuration drafts and gives an edit entry', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CoachConfigPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('默认教练')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /编\s*辑/ })).toBeInTheDocument();
  });
});
