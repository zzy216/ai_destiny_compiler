import {
  OllamaModelAdapter,
  OpenAiCompatibleModelAdapter,
  type ModelAdapterConfig,
} from '../src/models/model-adapters';

describe('model adapters', () => {
  const config: ModelAdapterConfig = {
    baseUrl: 'https://models.example.com/v1/',
    modelName: 'destiny-test',
    apiKey: 'secret-api-key',
    timeoutMs: 1000,
    maxOutputTokens: 128,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls the OpenAI-compatible chat endpoint without exposing credentials in results', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'request-1',
          choices: [{ message: { content: '先做一个最小动作。' } }],
          usage: { prompt_tokens: 12, completion_tokens: 8 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await new OpenAiCompatibleModelAdapter().complete(config, [
      { role: 'user', content: '我应该先做什么？' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://models.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer secret-api-key' }),
      }),
    );
    expect(result).toMatchObject({
      content: '先做一个最小动作。',
      providerRequestId: 'request-1',
      usage: { inputTokens: 12, outputTokens: 8 },
    });
    expect(JSON.stringify(result)).not.toContain('secret-api-key');
  });

  it('normalizes OpenAI-compatible failures to a safe connection result', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('provider secret details', { status: 503 }),
    );

    await expect(new OpenAiCompatibleModelAdapter().testConnection(config)).resolves.toMatchObject({
      reachable: false,
      errorCode: 'provider_http_error',
      errorMessage: 'Model provider returned HTTP 503',
    });
  });

  it('calls the Ollama chat endpoint and supports local models without an API key', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          message: { content: '从今天开始记录一个阻力。' },
          prompt_eval_count: 4,
          eval_count: 6,
        }),
        { status: 200 },
      ),
    );

    const result = await new OllamaModelAdapter().complete(
      { ...config, baseUrl: 'http://127.0.0.1:11434', apiKey: undefined },
      [{ role: 'user', content: '给我一个行动建议。' }],
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toMatchObject({
      content: '从今天开始记录一个阻力。',
      usage: { inputTokens: 4, outputTokens: 6 },
    });
  });

  it('returns a timeout-safe error without leaking the provider error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('socket secret details'));

    await expect(new OllamaModelAdapter().testConnection({
      ...config,
      baseUrl: 'http://127.0.0.1:11434',
      apiKey: undefined,
    })).resolves.toMatchObject({
      reachable: false,
      errorCode: 'provider_unreachable',
      errorMessage: 'Model provider is unreachable',
    });
  });
});
