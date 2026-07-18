import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelsPage } from './ModelsPage';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    listModels: vi.fn(),
    createModel: vi.fn(),
    updateModel: vi.fn(),
    publishModel: vi.fn(),
    disableModel: vi.fn(),
    setDefaultModel: vi.fn(),
    testModel: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ModelsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ModelsPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.listModels).mockResolvedValue({
      data: [
        {
          id: 'model-1',
          displayName: 'Ollama 本地模型',
          modelType: 'local',
          protocol: 'ollama',
          status: 'published',
          isDefault: true,
          isSelectable: true,
          hasCredential: false,
          secretHint: null,
        },
      ],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });
  });

  it('shows managed models and protects credential contents', async () => {
    renderPage();

    expect(await screen.findByText('Ollama 本地模型')).toBeInTheDocument();
    expect(screen.getByText('已发布')).toBeInTheDocument();
    expect(screen.queryByText(/api[_-]?key|secret-api-key/i)).not.toBeInTheDocument();
  });
});
