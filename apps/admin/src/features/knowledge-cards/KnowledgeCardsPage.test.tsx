import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeCardsPage } from './KnowledgeCardsPage';

vi.mock('../../api/client', () => ({
  apiClient: {
    listKnowledgeCards: vi.fn().mockResolvedValue({
      data: [{ id: 'card-1', cardKey: 'mvp-01', name: '目标澄清', category: '目标', status: 'published', tags: ['目标'] }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    }),
    createKnowledgeCard: vi.fn(),
    updateKnowledgeCard: vi.fn(),
    publishKnowledgeCard: vi.fn(),
  },
}));

describe('KnowledgeCardsPage', () => {
  it('shows knowledge cards with category and publish state', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <KnowledgeCardsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('目标澄清')).toBeInTheDocument();
    expect(screen.getByText('目标')).toBeInTheDocument();
    expect(screen.getByText('已发布')).toBeInTheDocument();
  });
});
