import { describe, expect, it, vi } from 'vitest';

import { apiClient, clearAuthSession, setAuthSession } from './client';

describe('api client authentication', () => {
  it('attaches the in-memory access token and never writes tokens to localStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const setItem = vi.spyOn(window.localStorage.__proto__, 'setItem');

    setAuthSession({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    await apiClient.listModels();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/models', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
    }));
    expect(setItem).not.toHaveBeenCalled();

    clearAuthSession();
    setItem.mockRestore();
    vi.unstubAllGlobals();
  });
});
