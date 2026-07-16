export type ModelMessageRole = 'system' | 'user' | 'assistant';

export interface ModelMessage {
  role: ModelMessageRole;
  content: string;
}

export interface ModelAdapterConfig {
  baseUrl: string;
  modelName: string;
  apiKey?: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

export interface ModelUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface ModelCompletionResult {
  content: string;
  providerRequestId: string | null;
  usage: ModelUsage;
}

export interface ModelConnectionResult {
  reachable: boolean;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export class ModelAdapterError extends Error {
  constructor(
    public readonly code: 'provider_http_error' | 'provider_invalid_response' | 'provider_timeout' | 'provider_unreachable',
    message: string,
  ) {
    super(message);
    this.name = 'ModelAdapterError';
  }
}

type JsonRecord = Record<string, unknown>;

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

abstract class HttpModelAdapter {
  protected abstract buildRequest(
    config: ModelAdapterConfig,
    messages: ModelMessage[],
  ): { url: string; init: RequestInit };

  protected abstract parseResponse(body: JsonRecord): ModelCompletionResult;

  async complete(
    config: ModelAdapterConfig,
    messages: ModelMessage[],
  ): Promise<ModelCompletionResult> {
    const { url, init } = this.buildRequest(config, messages);
    const response = await this.fetchJson(url, init, config.timeoutMs);
    return this.parseResponse(response);
  }

  async testConnection(config: ModelAdapterConfig): Promise<ModelConnectionResult> {
    const startedAt = Date.now();
    try {
      await this.complete(config, [{ role: 'user', content: 'ping' }]);
      return {
        reachable: true,
        latencyMs: Math.max(0, Date.now() - startedAt),
        errorCode: null,
        errorMessage: null,
      };
    } catch (error) {
      const adapterError = error instanceof ModelAdapterError ? error : undefined;
      return {
        reachable: false,
        latencyMs: Math.max(0, Date.now() - startedAt),
        errorCode: adapterError?.code ?? 'provider_unreachable',
        errorMessage: adapterError?.message ?? 'Model provider is unreachable',
      };
    }
  }

  private async fetchJson(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<JsonRecord> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        throw new ModelAdapterError(
          'provider_http_error',
          `Model provider returned HTTP ${response.status}`,
        );
      }

      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ModelAdapterError(
          'provider_invalid_response',
          'Model provider returned an invalid response',
        );
      }
      return body as JsonRecord;
    } catch (error) {
      if (error instanceof ModelAdapterError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ModelAdapterError('provider_timeout', 'Model provider timed out');
      }
      throw new ModelAdapterError('provider_unreachable', 'Model provider is unreachable');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class OpenAiCompatibleModelAdapter extends HttpModelAdapter {
  protected buildRequest(config: ModelAdapterConfig, messages: ModelMessage[]): { url: string; init: RequestInit } {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (config.apiKey) {
      headers.authorization = `Bearer ${config.apiKey}`;
    }
    return {
      url: joinUrl(config.baseUrl, 'chat/completions'),
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.modelName,
          messages,
          max_tokens: config.maxOutputTokens,
          stream: false,
        }),
      },
    };
  }

  protected parseResponse(body: JsonRecord): ModelCompletionResult {
    const choices = Array.isArray(body.choices) ? body.choices : [];
    const firstChoice = choices[0];
    const message = firstChoice && typeof firstChoice === 'object' ? (firstChoice as JsonRecord).message : undefined;
    const content = message && typeof message === 'object' ? stringOrNull((message as JsonRecord).content) : null;
    if (!content) {
      throw new ModelAdapterError('provider_invalid_response', 'Model provider returned no message');
    }
    const usage = body.usage && typeof body.usage === 'object' ? (body.usage as JsonRecord) : {};
    return {
      content,
      providerRequestId: stringOrNull(body.id),
      usage: {
        inputTokens: numberOrNull(usage.prompt_tokens),
        outputTokens: numberOrNull(usage.completion_tokens),
      },
    };
  }
}

export class OllamaModelAdapter extends HttpModelAdapter {
  protected buildRequest(config: ModelAdapterConfig, messages: ModelMessage[]): { url: string; init: RequestInit } {
    return {
      url: joinUrl(config.baseUrl, 'api/chat'),
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: config.modelName,
          messages,
          stream: false,
          options: { num_predict: config.maxOutputTokens },
        }),
      },
    };
  }

  protected parseResponse(body: JsonRecord): ModelCompletionResult {
    const message = body.message && typeof body.message === 'object' ? (body.message as JsonRecord) : undefined;
    const content = message ? stringOrNull(message.content) : null;
    if (!content) {
      throw new ModelAdapterError('provider_invalid_response', 'Model provider returned no message');
    }
    return {
      content,
      providerRequestId: stringOrNull(body.id),
      usage: {
        inputTokens: numberOrNull(body.prompt_eval_count),
        outputTokens: numberOrNull(body.eval_count),
      },
    };
  }
}
