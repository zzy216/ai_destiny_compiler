import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ObjectLiteral, Repository } from 'typeorm';

import {
  ModelConfig,
  ModelConfigVersion,
  ModelCredential,
} from '../src/database/entities';
import {
  ModelProtocol,
  ModelType,
} from '../src/models/models.dto';
import { ModelCredentialCipher } from '../src/models/model-credential-cipher';
import { ModelsService } from '../src/models/models.service';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const MODEL_ID = '6cdbbfa1-7674-4b53-a2d9-a38af20aa1b0';
const DRAFT_ID = '7cdbbfa1-7674-4b53-a2d9-a38af20aa1b0';
const PUBLISHED_ID = '8cdbbfa1-7674-4b53-a2d9-a38af20aa1b0';

function repository<T extends ObjectLiteral>(methods: Record<string, jest.Mock>): Repository<T> {
  return methods as unknown as Repository<T>;
}

function createService(overrides: {
  config?: Record<string, jest.Mock>;
  versions?: Record<string, jest.Mock>;
  credentials?: Record<string, jest.Mock>;
} = {}) {
  return new ModelsService(
    repository<ModelConfig>({
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      save: jest.fn(async (value) => value),
      update: jest.fn(),
      ...overrides.config,
    }),
    repository<ModelConfigVersion>({
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
      update: jest.fn(),
      ...overrides.versions,
    }),
    repository<ModelCredential>({
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
      delete: jest.fn(),
      ...overrides.credentials,
    }),
    new ModelCredentialCipher(Buffer.alloc(32, 7), 1),
  );
}

describe('ModelsService model lifecycle', () => {
  it('creates an admin model as a draft and encrypts the API key', async () => {
    const configSave = jest.fn(async (value) => value);
    const versionSave = jest.fn(async (value) => value);
    const credentialSave = jest.fn(async (value) => value);
    const service = createService({
      config: { save: configSave, findOne: jest.fn().mockResolvedValue(null) },
      versions: { save: versionSave, findOne: jest.fn().mockResolvedValue(null) },
      credentials: { save: credentialSave },
    });

    const result = await service.createAdminModel(
      {
        slug: 'primary-model',
        displayName: '主模型',
        modelType: ModelType.Api,
        protocol: ModelProtocol.OpenAiCompatible,
        baseUrl: 'https://api.example.com/v1',
        modelName: 'example-model',
        apiKey: 'secret-api-key',
      },
      ADMIN_ID,
    );

    expect(result).toMatchObject({
      ownerType: 'system',
      status: 'draft',
      displayName: '主模型',
      currentVersion: { version: 1, modelName: 'example-model' },
      hasCredential: true,
      secretHint: '…-key',
    });
    expect(configSave).toHaveBeenCalledWith(
      expect.objectContaining({ ownerType: 'system', createdBy: ADMIN_ID }),
    );
    expect(versionSave).toHaveBeenCalledWith(
      expect.objectContaining({ versionStatus: 'draft', createdBy: ADMIN_ID }),
    );
    expect(credentialSave).toHaveBeenCalledWith(
      expect.objectContaining({ updatedBy: ADMIN_ID, ciphertext: expect.any(Buffer) }),
    );
    expect(JSON.stringify(result)).not.toContain('secret-api-key');
  });

  it('creates a new draft version when an existing model is updated', async () => {
    const model: ModelConfig = {
      id: MODEL_ID,
      ownerType: 'system',
      ownerUserId: null,
      slug: 'primary-model',
      displayName: '旧名称',
      modelType: 'api',
      protocol: 'openai_compatible',
      status: 'published',
      isDefault: false,
      isSelectable: true,
      currentDraftVersionId: DRAFT_ID,
      publishedVersionId: PUBLISHED_ID,
      createdBy: ADMIN_ID,
      updatedBy: ADMIN_ID,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const draft: ModelConfigVersion = {
      id: DRAFT_ID,
      modelConfigId: MODEL_ID,
      version: 1,
      versionStatus: 'draft',
      provider: 'openai',
      baseUrl: 'https://api.example.com/v1',
      modelName: 'old-model',
      timeoutMs: 60000,
      maxOutputTokens: 4096,
      supportsStream: true,
      supportsStructuredOutput: true,
      capabilities: {},
      requestOptions: {},
      configChecksum: 'a'.repeat(64),
      createdBy: ADMIN_ID,
      publishedAt: null,
      createdAt: new Date(),
    };
    const versionSave = jest.fn(async (value) => value);
    const versionFindOne = jest.fn(async ({ where }: { where: { id?: string; modelConfigId?: string } }) => {
      if (where.id === DRAFT_ID) return draft;
      if (where.modelConfigId === MODEL_ID) return draft;
      return null;
    });
    const configUpdate = jest.fn();
    const service = createService({
      config: {
        findOne: jest.fn(async ({ where }: { where: { id?: string; slug?: string } }) =>
          where.id === MODEL_ID ? model : null),
        update: configUpdate,
      },
      versions: { findOne: versionFindOne, save: versionSave },
    });

    const result = await service.updateAdminModel(
      MODEL_ID,
      { displayName: '新名称', modelName: 'new-model' },
      ADMIN_ID,
    );

    expect(versionSave).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2, versionStatus: 'draft', modelName: 'new-model' }),
    );
    expect(configUpdate).toHaveBeenCalledWith(
      MODEL_ID,
      expect.objectContaining({ currentDraftVersionId: expect.any(String), updatedBy: ADMIN_ID }),
    );
    expect(result).toMatchObject({ displayName: '新名称', currentVersion: { version: 2 } });
  });

  it('publishes the current draft and supersedes the previous published version', async () => {
    const model = {
      id: MODEL_ID,
      ownerType: 'system',
      ownerUserId: null,
      displayName: '主模型',
      modelType: 'api',
      protocol: 'openai_compatible',
      status: 'draft',
      isDefault: false,
      isSelectable: false,
      currentDraftVersionId: DRAFT_ID,
      publishedVersionId: PUBLISHED_ID,
      createdBy: ADMIN_ID,
      updatedBy: ADMIN_ID,
      deletedAt: null,
    } as ModelConfig;
    const draft = { id: DRAFT_ID, modelConfigId: MODEL_ID, version: 2, versionStatus: 'draft', baseUrl: 'https://api.example.com/v1', modelName: 'new-model' } as ModelConfigVersion;
    const oldPublished = { id: PUBLISHED_ID, modelConfigId: MODEL_ID, version: 1, versionStatus: 'published' } as ModelConfigVersion;
    const versionUpdate = jest.fn();
    const configUpdate = jest.fn();
    const service = createService({
      config: { findOne: jest.fn().mockResolvedValue(model), update: configUpdate },
      versions: {
        findOne: jest.fn(async ({ where }: { where: { id: string } }) => where.id === DRAFT_ID ? draft : oldPublished),
        update: versionUpdate,
      },
    });

    await service.publishModel(MODEL_ID, ADMIN_ID);

    expect(versionUpdate).toHaveBeenCalledWith(PUBLISHED_ID, expect.objectContaining({ versionStatus: 'superseded' }));
    expect(versionUpdate).toHaveBeenCalledWith(DRAFT_ID, expect.objectContaining({ versionStatus: 'published', publishedAt: expect.any(Date) }));
    expect(configUpdate).toHaveBeenCalledWith(MODEL_ID, expect.objectContaining({ status: 'published', publishedVersionId: DRAFT_ID, currentDraftVersionId: null }));
  });

  it('only allows a published system model to become the default', async () => {
    const service = createService({
      config: {
        findOne: jest.fn().mockResolvedValue({
          id: MODEL_ID,
          ownerType: 'system',
          status: 'published',
          isSelectable: true,
          isDefault: false,
          publishedVersionId: PUBLISHED_ID,
        } as ModelConfig),
        update: jest.fn(),
      },
    });

    await service.setDefaultModel(MODEL_ID, ADMIN_ID);

    const update = (service as unknown as { modelConfigs: Repository<ModelConfig> }).modelConfigs.update;
    expect(update).toHaveBeenCalledWith(
      { ownerType: 'system', isDefault: true },
      expect.objectContaining({ isDefault: false }),
    );
    expect(update).toHaveBeenCalledWith(MODEL_ID, expect.objectContaining({ isDefault: true, updatedBy: ADMIN_ID }));
  });

  it('soft-deletes a custom model and removes its encrypted credential', async () => {
    const configUpdate = jest.fn();
    const credentialDelete = jest.fn();
    const service = createService({
      config: {
        findOne: jest.fn().mockResolvedValue({
          id: MODEL_ID,
          ownerType: 'user',
          ownerUserId: USER_ID,
          status: 'published',
          isDefault: false,
        } as ModelConfig),
        update: configUpdate,
      },
      credentials: { delete: credentialDelete },
    });

    await service.deleteCustomModel(MODEL_ID, USER_ID);

    expect(configUpdate).toHaveBeenCalledWith(MODEL_ID, expect.objectContaining({ status: 'deleted', deletedAt: expect.any(Date), isSelectable: false }));
    expect(credentialDelete).toHaveBeenCalledWith(MODEL_ID);
  });

  it('rejects unsafe custom model URLs and invalid default candidates', async () => {
    const configSave = jest.fn();
    const service = createService({ config: { save: configSave, findOne: jest.fn().mockResolvedValue(null) } });

    await expect(service.createCustomModel({
      displayName: '本地模型',
      protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'http://127.0.0.1:11434/v1',
      modelName: 'example-model',
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(configSave).not.toHaveBeenCalled();

    const invalidDefaultService = createService({
      config: { findOne: jest.fn().mockResolvedValue({ ownerType: 'user', status: 'published' } as ModelConfig) },
    });
    await expect(invalidDefaultService.setDefaultModel(MODEL_ID, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns only safe model fields when listing available models', async () => {
    const model = { id: MODEL_ID, ownerType: 'system', ownerUserId: null, displayName: '主模型', modelType: 'api', protocol: 'openai_compatible', status: 'published', isDefault: true, isSelectable: true, currentDraftVersionId: null, publishedVersionId: PUBLISHED_ID } as ModelConfig;
    const version = { id: PUBLISHED_ID, modelConfigId: MODEL_ID, version: 1, versionStatus: 'published', provider: 'openai', baseUrl: 'https://api.example.com/v1', modelName: 'example-model', timeoutMs: 60000, maxOutputTokens: 4096, supportsStream: true, supportsStructuredOutput: true, capabilities: {}, requestOptions: {} } as ModelConfigVersion;
    const service = createService({
      config: { find: jest.fn().mockResolvedValue([model]), count: jest.fn().mockResolvedValue(1) },
      versions: { find: jest.fn().mockResolvedValue([version]) },
      credentials: { find: jest.fn().mockResolvedValue([{ modelConfigId: MODEL_ID, secretHint: '…-key', ciphertext: Buffer.from('secret') } as ModelCredential]) },
    });

    const result = await service.listAvailableModels({ page: 1, perPage: 20 }, USER_ID);

    expect(result).toMatchObject({ meta: { total: 1 }, data: [{ id: MODEL_ID, hasCredential: true, secretHint: '…-key' }] });
    expect(JSON.stringify(result)).not.toContain('ciphertext');
  });

  it('returns not found when a custom model is not owned by the caller', async () => {
    const service = createService({
      config: { findOne: jest.fn().mockResolvedValue({ id: MODEL_ID, ownerType: 'user', ownerUserId: ADMIN_ID } as ModelConfig) },
    });

    await expect(service.deleteCustomModel(MODEL_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
