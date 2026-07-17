import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  ModelConfig,
  ModelConfigVersion,
  ModelCredential,
} from '../src/database/entities';
import { ModelCredentialCipher } from '../src/models/model-credential-cipher';
import { ModelsService } from '../src/models/models.service';

type FakeRepository<T> = {
  findOne: jest.Mock<Promise<T | null>, [unknown]>;
};

function repository<T>(record: T | null): FakeRepository<T> {
  return { findOne: jest.fn().mockResolvedValue(record) };
}

describe('ModelsService connection tests', () => {
  const cipher = new ModelCredentialCipher(Buffer.alloc(32, 7), 1);
  const model: Partial<ModelConfig> = {
    id: '6cdbbfa1-7674-4b53-a2d9-a38af20aa1b0',
    ownerType: 'system',
    modelType: 'api',
    protocol: 'openai_compatible',
    currentDraftVersionId: '7cdbbfa1-7674-4b53-a2d9-a38af20aa1b0',
    publishedVersionId: '8cdbbfa1-7674-4b53-a2d9-a38af20aa1b0',
  };
  const draftVersion: Partial<ModelConfigVersion> = {
    id: '7cdbbfa1-7674-4b53-a2d9-a38af20aa1b0',
    modelConfigId: model.id,
    baseUrl: 'https://models.example.com/v1',
    modelName: 'destiny-test',
    timeoutMs: 1000,
    maxOutputTokens: 128,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the current draft, decrypts its credential, and returns a safe success result', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'pong' } }] }),
        { status: 200 },
      ),
    );
    const encrypted = cipher.encrypt('secret-api-key');
    const service = new ModelsService(
      repository(model as ModelConfig),
      repository(draftVersion as ModelConfigVersion),
      repository({
        modelConfigId: model.id,
        ...encrypted,
      } as ModelCredential),
      cipher,
    );

    const result = await service.testConnection(model.id as string);

    expect(result).toMatchObject({ reachable: true, errorCode: null });
    expect(JSON.stringify(result)).not.toContain('secret-api-key');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://models.example.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer secret-api-key' }),
      }),
    );
  });

  it('falls back to the published version when no draft version exists', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: { content: 'pong' } }), { status: 200 }),
    );
    const publishedModel = { ...model, currentDraftVersionId: null };
    const publishedVersion = {
      ...draftVersion,
      id: model.publishedVersionId,
      modelConfigId: model.id,
      baseUrl: 'http://127.0.0.1:11434',
      modelName: 'llama3.2',
    };
    const service = new ModelsService(
      repository(publishedModel as ModelConfig),
      repository(publishedVersion as ModelConfigVersion),
      repository(null),
      cipher,
    );

    await expect(service.testConnection(model.id as string)).resolves.toMatchObject({
      reachable: true,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.anything(),
    );
  });

  it('does not call a provider when the model or protocol cannot be tested', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const service = new ModelsService(
      repository({ ...model, protocol: 'provider_specific' } as ModelConfig),
      repository(draftVersion as ModelConfigVersion),
      repository(null),
      cipher,
    );

    await expect(service.testConnection(model.id as string)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();

    const missingService = new ModelsService(
      repository(null),
      repository(null),
      repository(null),
      cipher,
    );
    await expect(missingService.testConnection(model.id as string)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('normalizes provider failures without exposing the provider response body', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('provider secret response', { status: 503 }),
    );
    const service = new ModelsService(
      repository(model as ModelConfig),
      repository(draftVersion as ModelConfigVersion),
      repository(null),
      cipher,
    );

    const result = await service.testConnection(model.id as string);

    expect(result).toMatchObject({
      reachable: false,
      errorCode: 'provider_http_error',
      errorMessage: 'Model provider returned HTTP 503',
    });
    expect(JSON.stringify(result)).not.toContain('provider secret response');
  });
});
