import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AgentRunsPage } from './AgentRunsPage';

vi.mock('../../api/client', () => ({
  apiClient: {
    listAgentRuns: vi.fn().mockResolvedValue({
      data: [{ id: 'run-1', status: 'succeeded', modelName: 'llama3.2', durationMs: 1200, inputTokens: 100, outputTokens: 50, startedAt: '2026-07-18T08:00:00.000Z' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    }),
  },
}));

describe('AgentRunsPage', () => {
  it('shows safe run summaries without rendering full result payloads', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AgentRunsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('llama3.2')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.queryByText(/resultJson|api[_-]?key|systemPrompt/i)).not.toBeInTheDocument();
  });
});
