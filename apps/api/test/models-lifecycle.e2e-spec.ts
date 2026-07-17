import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource, ObjectLiteral, Repository } from 'typeorm';

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
      credentials: {
        save: credentialSave,
        findOne: jest.fn().mockResolvedValue({
          modelConfigId: MODEL_ID,
          secretHint: '…-key',
        } as ModelCredential),
      },
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
      config: { findOne: jest.fn().mockResolvedValue({ ownerType: 'system', status: 'published' } as ModelConfig) },
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
      config: {
        findOne: jest.fn().mockResolvedValue({
          id: MODEL_ID,
          ownerType: 'user',
          ownerUserId: ADMIN_ID,
        } as ModelConfig),
      },
    });

    await expect(service.deleteCustomModel(MODEL_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists custom and admin models with empty-page metadata', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = createService({
      config: { find, count },
      credentials: { find: jest.fn().mockResolvedValue([]) },
    });

    await expect(service.listCustomModels({ page: 2, perPage: 10 }, USER_ID)).resolves.toMatchObject({
      data: [],
      meta: { page: 2, perPage: 10, total: 0, totalPages: 0 },
    });
    await expect(service.listAdminModels()).resolves.toMatchObject({ data: [], meta: { page: 1, perPage: 20 } });
    expect(find).toHaveBeenCalled();
    expect(count).toHaveBeenCalled();
  });

  it('creates a custom model and can publish it for the owner', async () => {
    const configUpdate = jest.fn();
    const credentialSave = jest.fn();
    const credentialFindOne = jest.fn().mockResolvedValue({ modelConfigId: MODEL_ID, secretHint: '…-key' } as ModelCredential);
    const service = createService({
      config: { save: jest.fn(async (value) => value), update: configUpdate, findOne: jest.fn().mockResolvedValue(null) },
      versions: { save: jest.fn(async (value) => value), findOne: jest.fn().mockResolvedValue(null), update: jest.fn() },
      credentials: { save: credentialSave, findOne: credentialFindOne },
    });

    const created = await service.createCustomModel({
      displayName: '我的模型',
      protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'https://api.example.com/v1',
      modelName: 'example-model',
      apiKey: 'custom-api-key',
    }, USER_ID);
    expect(created).toMatchObject({ ownerType: 'user', status: 'draft', hasCredential: true });
    expect(credentialSave).toHaveBeenCalledWith(expect.objectContaining({ updatedBy: USER_ID }));

    const model = {
      id: MODEL_ID,
      ownerType: 'user',
      ownerUserId: USER_ID,
      status: 'draft',
      isSelectable: false,
      isDefault: false,
      currentDraftVersionId: DRAFT_ID,
      publishedVersionId: null,
    } as ModelConfig;
    const draft = { id: DRAFT_ID, modelConfigId: MODEL_ID, version: 1, versionStatus: 'draft', baseUrl: 'https://api.example.com/v1', modelName: 'example-model' } as ModelConfigVersion;
    const publishService = createService({
      config: { findOne: jest.fn().mockResolvedValue(model), update: configUpdate },
      versions: { findOne: jest.fn().mockResolvedValue(draft), update: jest.fn() },
      credentials: { findOne: credentialFindOne },
    });
    await expect(publishService.publishModel(MODEL_ID, USER_ID, 'user')).resolves.toMatchObject({ status: 'published', isSelectable: true });
  });

  it('disables custom models and deletes unpublished admin drafts', async () => {
    const configUpdate = jest.fn();
    const credentialDelete = jest.fn();
    const customService = createService({
      config: { findOne: jest.fn().mockResolvedValue({ id: MODEL_ID, ownerType: 'user', ownerUserId: USER_ID, status: 'published', isSelectable: true, isDefault: false } as ModelConfig), update: configUpdate },
      credentials: { delete: credentialDelete, findOne: jest.fn().mockResolvedValue(null) },
    });
    await expect(customService.disableCustomModel(MODEL_ID, USER_ID)).resolves.toMatchObject({ status: 'disabled', isSelectable: false });

    const adminService = createService({
      config: { findOne: jest.fn().mockResolvedValue({ id: MODEL_ID, ownerType: 'system', status: 'draft', publishedVersionId: null, isSelectable: false, isDefault: false } as ModelConfig), update: configUpdate },
      credentials: { delete: credentialDelete, findOne: jest.fn().mockResolvedValue(null) },
    });
    await expect(adminService.deleteAdminModel(MODEL_ID, ADMIN_ID)).resolves.toMatchObject({ status: 'deleted' });
    expect(credentialDelete).toHaveBeenCalledWith(MODEL_ID);
  });

  it('rejects duplicate slugs, invalid model combinations, and sensitive capabilities', async () => {
    const duplicateService = createService({
      config: { findOne: jest.fn().mockResolvedValue({ id: 'another-model' } as ModelConfig) },
    });
    await expect(duplicateService.createAdminModel({
      slug: 'primary-model', displayName: '主模型', modelType: ModelType.Api, protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'https://api.example.com/v1', modelName: 'example-model',
    }, ADMIN_ID)).rejects.toBeInstanceOf(ConflictException);

    const invalidService = createService({ config: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(invalidService.createAdminModel({
      slug: 'local-model', displayName: '本地模型', modelType: ModelType.Local, protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'http://127.0.0.1:11434', modelName: 'llama3.2',
    }, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(invalidService.createAdminModel({
      slug: 'unsafe-model', displayName: '不安全配置', modelType: ModelType.Api, protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'https://api.example.com/v1', modelName: 'example-model', capabilities: { apiKey: 'should-not-be-here' },
    }, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid lifecycle transitions and malformed update input', async () => {
    const modelWithoutVersion = { id: MODEL_ID, ownerType: 'system', status: 'draft', currentDraftVersionId: null, publishedVersionId: null } as ModelConfig;
    const service = createService({ config: { findOne: jest.fn().mockResolvedValue(modelWithoutVersion) } });
    await expect(service.publishModel(MODEL_ID, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateAdminModel(MODEL_ID, { displayName: '无版本' }, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);

    const publishedModel = { id: MODEL_ID, ownerType: 'system', status: 'published', currentDraftVersionId: null, publishedVersionId: PUBLISHED_ID } as ModelConfig;
    const deleteService = createService({ config: { findOne: jest.fn().mockResolvedValue(publishedModel) } });
    await expect(deleteService.deleteAdminModel(MODEL_ID, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);

    const invalidUrlService = createService({ config: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(invalidUrlService.createCustomModel({
      displayName: '坏地址', protocol: ModelProtocol.OpenAiCompatible, baseUrl: 'not-a-url', modelName: 'x',
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('covers admin detail lookup and missing model versions', async () => {
    const model = {
      id: MODEL_ID,
      ownerType: 'system',
      displayName: '主模型',
      modelType: 'api',
      protocol: 'openai_compatible',
      status: 'published',
      isDefault: true,
      isSelectable: true,
      currentDraftVersionId: null,
      publishedVersionId: PUBLISHED_ID,
    } as ModelConfig;
    const service = createService({
      config: { findOne: jest.fn().mockResolvedValue(model) },
      versions: { findOne: jest.fn().mockResolvedValue(null) },
      credentials: { findOne: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.getAdminModel(MODEL_ID)).resolves.toMatchObject({ id: MODEL_ID, currentVersion: null });

    const missingService = createService({ config: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(missingService.getAdminModel(MODEL_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates protocol, URL, nested capability and numeric boundaries in service code', async () => {
    const validService = createService({
      config: { findOne: jest.fn().mockResolvedValue(null), save: jest.fn(async (value) => value) },
      versions: { save: jest.fn(async (value) => value), findOne: jest.fn().mockResolvedValue(null) },
      credentials: { findOne: jest.fn().mockResolvedValue(null) },
    });
    await expect(validService.createAdminModel({
      slug: 'ollama-local', displayName: '本地模型', modelType: ModelType.Local, protocol: ModelProtocol.Ollama,
      baseUrl: 'http://127.0.0.1:11434', modelName: 'llama3.2', capabilities: { nested: { chat: true } },
    }, ADMIN_ID)).resolves.toMatchObject({ status: 'draft' });

    await expect(validService.createAdminModel({
      slug: 'bad-ollama', displayName: '错误模型', modelType: ModelType.Api, protocol: ModelProtocol.Ollama,
      baseUrl: 'https://api.example.com', modelName: 'x',
    }, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(validService.createAdminModel({
      slug: 'missing-fields', displayName: '', modelType: ModelType.Api, protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'https://api.example.com', modelName: '',
    }, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(validService.createAdminModel({
      slug: 'bad-url', displayName: '坏 URL', modelType: ModelType.Api, protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'ftp://api.example.com', modelName: 'x',
    }, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(validService.createAdminModel({
      slug: 'nested-secret', displayName: '嵌套密钥', modelType: ModelType.Api, protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'https://api.example.com', modelName: 'x', capabilities: { nested: { token: 'secret' } },
    }, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(validService.createAdminModel({
      slug: 'bad-timeout', displayName: '超时配置', modelType: ModelType.Api, protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'https://api.example.com', modelName: 'x', timeoutMs: 999,
    }, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(validService.createCustomModel({
      displayName: '内部地址', protocol: ModelProtocol.OpenAiCompatible, baseUrl: 'https://service.internal/v1', modelName: 'x',
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(validService.createCustomModel({
      displayName: 'IPv6 本地地址', protocol: ModelProtocol.OpenAiCompatible, baseUrl: 'https://[::1]/v1', modelName: 'x',
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(validService.createCustomModel({
      displayName: '带凭据地址', protocol: ModelProtocol.OpenAiCompatible, baseUrl: 'https://user:pass@api.example.com/v1', modelName: 'x',
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(validService.createCustomModel({
      displayName: '', protocol: ModelProtocol.OpenAiCompatible, baseUrl: 'https://api.example.com/v1', modelName: '',
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported custom protocol and incomplete update versions', async () => {
    const service = createService({ config: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(service.createCustomModel({
      displayName: '错误协议', protocol: ModelProtocol.Ollama as never, baseUrl: 'https://api.example.com/v1', modelName: 'x',
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);

    const model = { id: MODEL_ID, ownerType: 'user', ownerUserId: USER_ID, status: 'draft', currentDraftVersionId: DRAFT_ID, publishedVersionId: null } as ModelConfig;
    const incomplete = { id: DRAFT_ID, modelConfigId: MODEL_ID, version: 1, versionStatus: 'draft', provider: null, baseUrl: '', modelName: '' } as ModelConfigVersion;
    const updateService = createService({
      config: { findOne: jest.fn().mockResolvedValue(model) },
      versions: { findOne: jest.fn().mockResolvedValue(incomplete) },
    });
    await expect(updateService.updateCustomModel(MODEL_ID, { displayName: '新草稿' }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing provider versions and duplicate update slugs', async () => {
    const missingVersionService = createService({
      config: {
        findOne: jest.fn().mockResolvedValue({ id: MODEL_ID, status: 'published', currentDraftVersionId: DRAFT_ID } as ModelConfig),
      },
      versions: { findOne: jest.fn().mockResolvedValue(null) },
    });
    await expect(missingVersionService.testConnection(MODEL_ID)).rejects.toBeInstanceOf(NotFoundException);

    const model = { id: MODEL_ID, ownerType: 'system', status: 'published', currentDraftVersionId: DRAFT_ID, publishedVersionId: PUBLISHED_ID } as ModelConfig;
    const draft = { id: DRAFT_ID, modelConfigId: MODEL_ID, version: 1, versionStatus: 'draft', baseUrl: 'https://api.example.com', modelName: 'x' } as ModelConfigVersion;
    const findOne = jest.fn()
      .mockResolvedValueOnce(model)
      .mockResolvedValueOnce({ id: 'different-model', slug: 'taken' } as ModelConfig);
    const duplicateService = createService({
      config: { findOne },
      versions: { findOne: jest.fn().mockResolvedValue(draft) },
    });
    await expect(duplicateService.updateAdminModel(MODEL_ID, { slug: 'taken' }, ADMIN_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses a TypeORM transaction for persistent writes', async () => {
    const configRepository = repository<ModelConfig>({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (value) => value),
    });
    const versionRepository = repository<ModelConfigVersion>({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (value) => value),
    });
    const credentialRepository = repository<ModelCredential>({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (value) => value),
    });
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ModelConfig) return configRepository;
        if (entity === ModelConfigVersion) return versionRepository;
        return credentialRepository;
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (value: typeof manager) => Promise<unknown>) => callback(manager)),
    } as unknown as DataSource;
    const service = new ModelsService(configRepository, versionRepository, credentialRepository, new ModelCredentialCipher(Buffer.alloc(32, 7), 1), dataSource);

    await service.createAdminModel({
      slug: 'transaction-model', displayName: '事务模型', modelType: ModelType.Api, protocol: ModelProtocol.OpenAiCompatible,
      baseUrl: 'https://api.example.com', modelName: 'x',
    }, ADMIN_ID);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.getRepository).toHaveBeenCalledTimes(3);
  });

  it('supports temporary default actors while authentication is not implemented', async () => {
    const emptyService = createService({
      config: { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findOne: jest.fn().mockResolvedValue(null) },
      versions: { findOne: jest.fn().mockResolvedValue(null) },
      credentials: { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) },
    });
    await emptyService.listAvailableModels();
    await emptyService.listCustomModels();
    await emptyService.listAdminModels();
    await expect(emptyService.updateCustomModel(MODEL_ID, { displayName: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(emptyService.deleteCustomModel(MODEL_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(emptyService.disableCustomModel(MODEL_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(emptyService.updateAdminModel(MODEL_ID, { displayName: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(emptyService.deleteAdminModel(MODEL_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(emptyService.publishModel(MODEL_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(emptyService.disableModel(MODEL_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(emptyService.setDefaultModel(MODEL_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
