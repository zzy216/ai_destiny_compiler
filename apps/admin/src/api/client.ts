export type PageMeta = { page: number; perPage: number; total: number; totalPages: number };

export type Page<T> = { data: T[]; meta: PageMeta };

export type Model = {
  id: string;
  displayName: string;
  modelType: 'api' | 'local';
  protocol: string;
  status: 'draft' | 'published' | 'disabled' | 'deleted';
  isDefault: boolean;
  isSelectable: boolean;
  hasCredential: boolean;
  secretHint: string | null;
  currentVersion?: { baseUrl: string; modelName: string; timeoutMs: number; maxOutputTokens: number } | null;
};

export type CoachConfig = {
  id: string;
  version: number;
  name: string;
  status: 'draft' | 'published' | 'disabled';
  productGoal: string;
  roleDefinition?: string;
  systemPrompt?: string;
  conversationRules?: Record<string, unknown>;
  actionRules?: Record<string, unknown>;
  prohibitedContent?: Record<string, unknown>;
  safetyRules?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  defaultModelConfigId?: string | null;
};

export type KnowledgeCard = {
  id: string;
  cardKey: string;
  version: number;
  name: string;
  category: string;
  tags: string[];
  problemSignals?: string[];
  diagnosticQuestions?: string[];
  candidateActions?: string[];
  stopDoing?: string[];
  reviewQuestions?: string[];
  status: 'draft' | 'published' | 'disabled';
};

export type AgentRun = {
  id: string;
  status: 'running' | 'succeeded' | 'failed' | 'timeout' | 'cancelled';
  modelName: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost?: string | null;
  durationMs: number | null;
  startedAt: string;
  completedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type CreateModelInput = {
  slug: string;
  displayName: string;
  modelType: 'api' | 'local';
  protocol: string;
  baseUrl: string;
  modelName: string;
  provider?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  supportsStream?: boolean;
  supportsStructuredOutput?: boolean;
};

export type CoachConfigInput = Omit<CoachConfig, 'id' | 'version' | 'status'>;
export type KnowledgeCardInput = Omit<KnowledgeCard, 'id' | 'version' | 'status'>;

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
  deviceName?: string;
};

export type LoginResponse = {
  data: AuthSession & {
    expiresInSeconds: number;
    user: { id: string; role: 'user' | 'admin'; status: 'active' | 'disabled' | 'locked' };
  };
};

let authSession: AuthSession | null = null;

export function setAuthSession(session: AuthSession) {
  authSession = session;
}

export function clearAuthSession() {
  authSession = null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(authSession ? { Authorization: `Bearer ${authSession.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string; error?: { message?: string } } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object'
      ? 'error' in payload && payload.error?.message
        ? payload.error.message
        : 'message' in payload
          ? payload.message
          : undefined
      : undefined;
    throw new Error(message || `请求失败（${response.status}）`);
  }
  return payload as T;
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value !== undefined && search.set(key, String(value)));
  return search.toString() ? `?${search.toString()}` : '';
};

export const apiClient = {
  login: (input: LoginInput) => request<LoginResponse>('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  listModels: () => request<Page<Model>>('/v1/admin/models'),
  createModel: (input: CreateModelInput) => request<{ data: Model }>('/v1/admin/models', { method: 'POST', body: JSON.stringify(input) }),
  updateModel: (id: string, input: Partial<CreateModelInput>) => request<{ data: Model }>(`/v1/admin/models/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  publishModel: (id: string) => request<{ data: Model }>(`/v1/admin/models/${id}/publish`, { method: 'POST' }),
  disableModel: (id: string) => request<{ data: Model }>(`/v1/admin/models/${id}/disable`, { method: 'POST' }),
  setDefaultModel: (id: string) => request<{ data: Model }>(`/v1/admin/models/${id}/set-default`, { method: 'POST' }),
  testModel: (id: string) => request<{ data: { ok: boolean; message?: string } }>(`/v1/admin/models/${id}/test`, { method: 'POST' }),
  listCoachConfigs: (params?: { status?: string }) => request<Page<CoachConfig>>(`/v1/admin/coach-configs${query(params ?? {})}`),
  createCoachConfig: (input: CoachConfigInput) => request<{ data: CoachConfig }>('/v1/admin/coach-configs', { method: 'POST', body: JSON.stringify(input) }),
  updateCoachConfig: (id: string, input: Partial<CoachConfigInput>) => request<{ data: CoachConfig }>(`/v1/admin/coach-configs/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  publishCoachConfig: (id: string) => request<{ data: CoachConfig }>(`/v1/admin/coach-configs/${id}/publish`, { method: 'POST' }),
  listKnowledgeCards: (params?: { status?: string; category?: string }) => request<Page<KnowledgeCard>>(`/v1/admin/knowledge-cards${query(params ?? {})}`),
  createKnowledgeCard: (input: KnowledgeCardInput) => request<{ data: KnowledgeCard }>('/v1/admin/knowledge-cards', { method: 'POST', body: JSON.stringify(input) }),
  updateKnowledgeCard: (id: string, input: Partial<KnowledgeCardInput>) => request<{ data: KnowledgeCard }>(`/v1/admin/knowledge-cards/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  publishKnowledgeCard: (id: string) => request<{ data: KnowledgeCard }>(`/v1/admin/knowledge-cards/${id}/publish`, { method: 'POST' }),
  listAgentRuns: (params?: { status?: string }) => request<Page<AgentRun>>(`/v1/admin/agent-runs${query(params ?? {})}`),
};
