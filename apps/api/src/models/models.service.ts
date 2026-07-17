import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  Not,
  type ObjectLiteral,
  type Repository,
} from 'typeorm';

import {
  ModelConfig,
  ModelConfigVersion,
  ModelCredential,
} from '../database/entities';
import {
  CreateAdminModelRequestDto,
  CreateCustomModelRequestDto,
  ModelDetailDto,
  ModelListResponseDto,
  ModelProtocol,
  ModelSummaryDto,
  ModelVersionDto,
  PaginationQueryDto,
  UpdateAdminModelRequestDto,
  UpdateCustomModelRequestDto,
} from './models.dto';
import {
  OllamaModelAdapter,
  OpenAiCompatibleModelAdapter,
  type ModelAdapterConfig,
  type ModelConnectionResult,
} from './model-adapters';
import { ModelCredentialCipher } from './model-credential-cipher';
import { contractNotImplemented } from '../common/contract-not-implemented';

export const DEVELOPMENT_ADMIN_ID = '00000000-0000-4000-8000-000000000001';
export const DEVELOPMENT_USER_ID = '00000000-0000-4000-8000-000000000002';

type ModelInput = {
  displayName?: string;
  modelType?: string;
  protocol?: string;
  baseUrl?: string;
  modelName?: string;
  provider?: string | null;
  apiKey?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  supportsStream?: boolean;
  supportsStructuredOutput?: boolean;
  capabilities?: Record<string, unknown>;
  isSelectable?: boolean;
};

type ModelRepositories = {
  configs: Repository<ModelConfig>;
  versions: Repository<ModelConfigVersion>;
  credentials: Repository<ModelCredential>;
};

type Pagination = { page: number; perPage: number; skip: number; take: number };

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const SENSITIVE_KEY_PATTERN = /api[_-]?key|authorization|token|secret|password|credential/i;

@Injectable()
export class ModelsService {
  constructor(
    @Optional()
    @InjectRepository(ModelConfig)
    private readonly modelConfigs?: Repository<ModelConfig>,
    @Optional()
    @InjectRepository(ModelConfigVersion)
    private readonly modelVersions?: Repository<ModelConfigVersion>,
    @Optional()
    @InjectRepository(ModelCredential)
    private readonly modelCredentials?: Repository<ModelCredential>,
    @Optional()
    private readonly credentialCipher?: ModelCredentialCipher,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  async listAvailableModels(
    query: PaginationQueryDto = {},
    userId = DEVELOPMENT_USER_ID,
  ): Promise<ModelListResponseDto> {
    const pagination = this.normalizePagination(query);
    const repositories = this.repositories();
    const models = await repositories.configs.find({
      where: [
        { ownerType: 'system', status: 'published', isSelectable: true },
        { ownerType: 'user', ownerUserId: userId, status: 'published', isSelectable: true },
      ],
      order: { displayName: 'ASC' },
      skip: pagination.skip,
      take: pagination.take,
    });
    const total = await repositories.configs.count({
      where: [
        { ownerType: 'system', status: 'published', isSelectable: true },
        { ownerType: 'user', ownerUserId: userId, status: 'published', isSelectable: true },
      ],
    });
    return this.toListResponse(models, total, pagination, repositories);
  }

  async listCustomModels(
    query: PaginationQueryDto = {},
    userId = DEVELOPMENT_USER_ID,
  ): Promise<ModelListResponseDto> {
    const pagination = this.normalizePagination(query);
    const repositories = this.repositories();
    const where = { ownerType: 'user', ownerUserId: userId, status: Not('deleted') };
    const [models, total] = await Promise.all([
      repositories.configs.find({ where, order: { updatedAt: 'DESC' }, skip: pagination.skip, take: pagination.take }),
      repositories.configs.count({ where }),
    ]);
    return this.toListResponse(models, total, pagination, repositories);
  }

  async createCustomModel(
    request: CreateCustomModelRequestDto,
    userId = DEVELOPMENT_USER_ID,
  ): Promise<ModelDetailDto> {
    this.validateCustomInput(request);
    return this.write(async (repositories) => {
      const modelId = randomUUID();
      const versionId = randomUUID();
      const model = this.createModelEntity({
        id: modelId,
        ownerType: 'user',
        ownerUserId: userId,
        slug: null,
        displayName: request.displayName,
        modelType: 'api',
        protocol: request.protocol,
        status: 'draft',
        isDefault: false,
        isSelectable: false,
        currentDraftVersionId: versionId,
        publishedVersionId: null,
        createdBy: userId,
        updatedBy: userId,
      });
      const version = this.createVersionEntity(modelId, versionId, 1, request, userId);
      await repositories.configs.save(model);
      await repositories.versions.save(version);
      await this.saveCredentialIfProvided(repositories, modelId, request.apiKey, userId);
      return this.toDetail(model, repositories, version);
    });
  }

  async updateCustomModel(
    id: string,
    request: UpdateCustomModelRequestDto,
    userId = DEVELOPMENT_USER_ID,
  ): Promise<ModelDetailDto> {
    return this.updateModel(id, request, userId, 'user');
  }

  async deleteCustomModel(id: string, userId = DEVELOPMENT_USER_ID): Promise<ModelDetailDto> {
    return this.deleteModel(id, userId, 'user');
  }

  async disableCustomModel(id: string, userId = DEVELOPMENT_USER_ID): Promise<ModelDetailDto> {
    return this.disableModel(id, userId, 'user');
  }

  async listAdminModels(query: PaginationQueryDto = {}): Promise<ModelListResponseDto> {
    const pagination = this.normalizePagination(query);
    const repositories = this.repositories();
    const where = { ownerType: 'system', status: Not('deleted') };
    const [models, total] = await Promise.all([
      repositories.configs.find({ where, order: { updatedAt: 'DESC' }, skip: pagination.skip, take: pagination.take }),
      repositories.configs.count({ where }),
    ]);
    return this.toListResponse(models, total, pagination, repositories);
  }

  async createAdminModel(
    request: CreateAdminModelRequestDto,
    actorId = DEVELOPMENT_ADMIN_ID,
  ): Promise<ModelDetailDto> {
    this.validateAdminInput(request);
    return this.write(async (repositories) => {
      const duplicate = await repositories.configs.findOne({ where: { slug: request.slug } });
      if (duplicate) {
        throw new ConflictException('Model slug already exists');
      }
      const modelId = randomUUID();
      const versionId = randomUUID();
      const model = this.createModelEntity({
        id: modelId,
        ownerType: 'system',
        ownerUserId: null,
        slug: request.slug,
        displayName: request.displayName,
        modelType: request.modelType,
        protocol: request.protocol,
        status: 'draft',
        isDefault: false,
        isSelectable: request.isSelectable ?? true,
        currentDraftVersionId: versionId,
        publishedVersionId: null,
        createdBy: actorId,
        updatedBy: actorId,
      });
      const version = this.createVersionEntity(modelId, versionId, 1, request, actorId);
      await repositories.configs.save(model);
      await repositories.versions.save(version);
      await this.saveCredentialIfProvided(repositories, modelId, request.apiKey, actorId);
      return this.toDetail(model, repositories, version);
    });
  }

  async getAdminModel(id: string): Promise<ModelDetailDto> {
    const repositories = this.repositories();
    const model = await repositories.configs.findOne({ where: { id, ownerType: 'system', status: Not('deleted') } });
    if (!model) throw new NotFoundException('Model not found');
    return this.toDetail(model, repositories);
  }

  async updateAdminModel(
    id: string,
    request: UpdateAdminModelRequestDto,
    actorId = DEVELOPMENT_ADMIN_ID,
  ): Promise<ModelDetailDto> {
    return this.updateModel(id, request, actorId, 'system');
  }

  async deleteAdminModel(id: string, actorId = DEVELOPMENT_ADMIN_ID): Promise<ModelDetailDto> {
    const model = await this.findOwnedModel(id, actorId, 'system');
    if (model.status !== 'draft' || model.publishedVersionId) {
      throw new BadRequestException('Only an unpublished draft model can be deleted');
    }
    return this.deleteModelEntity(model, actorId);
  }

  async publishModel(
    id: string,
    actorId = DEVELOPMENT_ADMIN_ID,
    ownerType: 'system' | 'user' = 'system',
  ): Promise<ModelDetailDto> {
    const repositories = this.repositories();
    const model = await this.findOwnedModel(id, actorId, ownerType, repositories);
    if (!model.currentDraftVersionId) {
      throw new BadRequestException('Model has no draft version to publish');
    }
    return this.write(async (transactionRepositories) => {
      const draft = await transactionRepositories.versions.findOne({ where: { id: model.currentDraftVersionId as string, modelConfigId: id } });
      if (!draft) throw new NotFoundException('Model draft version not found');
      if (model.publishedVersionId && model.publishedVersionId !== draft.id) {
        await transactionRepositories.versions.update(model.publishedVersionId, { versionStatus: 'superseded' });
      }
      const publishedAt = new Date();
      await transactionRepositories.versions.update(draft.id, { versionStatus: 'published', publishedAt });
      await transactionRepositories.configs.update(id, {
        status: 'published',
        isSelectable: ownerType === 'user' ? true : model.isSelectable,
        currentDraftVersionId: null,
        publishedVersionId: draft.id,
        updatedBy: actorId,
      });
      Object.assign(model, {
        status: 'published',
        isSelectable: ownerType === 'user' ? true : model.isSelectable,
        currentDraftVersionId: null,
        publishedVersionId: draft.id,
        updatedBy: actorId,
      });
      Object.assign(draft, { versionStatus: 'published', publishedAt });
      return this.toDetail(model, transactionRepositories, draft);
    });
  }

  async disableModel(id: string, actorId = DEVELOPMENT_ADMIN_ID, ownerType: 'system' | 'user' = 'system'): Promise<ModelDetailDto> {
    const model = await this.findOwnedModel(id, actorId, ownerType);
    return this.write(async (repositories) => {
      await repositories.configs.update(id, {
        status: 'disabled',
        isSelectable: false,
        isDefault: false,
        updatedBy: actorId,
      });
      Object.assign(model, { status: 'disabled', isSelectable: false, isDefault: false, updatedBy: actorId });
      return this.toDetail(model, repositories);
    });
  }

  async setDefaultModel(id: string, actorId = DEVELOPMENT_ADMIN_ID): Promise<ModelDetailDto> {
    const repositories = this.repositories();
    const model = await this.findOwnedModel(id, actorId, 'system', repositories);
    if (model.status !== 'published' || !model.publishedVersionId || !model.isSelectable) {
      throw new BadRequestException('Only a selectable published system model can be default');
    }
    return this.write(async (transactionRepositories) => {
      await transactionRepositories.configs.update(
        { ownerType: 'system', isDefault: true },
        { isDefault: false, updatedBy: actorId },
      );
      await transactionRepositories.configs.update(id, { isDefault: true, updatedBy: actorId });
      model.isDefault = true;
      model.updatedBy = actorId;
      return this.toDetail(model, transactionRepositories);
    });
  }

  async testConnection(modelConfigId: string): Promise<ModelConnectionResult> {
    if (!this.modelConfigs || !this.modelVersions) {
      return contractNotImplemented();
    }

    const modelConfig = await this.modelConfigs.findOne({
      where: { id: modelConfigId },
    });
    if (!modelConfig || modelConfig.status === 'deleted') {
      throw new NotFoundException('Model not found');
    }

    const versionId = modelConfig.currentDraftVersionId ?? modelConfig.publishedVersionId;
    if (!versionId) {
      throw new BadRequestException('Model has no testable version');
    }

    const version = await this.modelVersions.findOne({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException('Model version not found');
    }

    const adapter = this.createAdapter(modelConfig.protocol);
    let apiKey: string | undefined;
    if (this.modelCredentials) {
      const credential = await this.modelCredentials.findOne({
        where: { modelConfigId },
      });
      if (credential) {
        if (!this.credentialCipher) {
          throw new InternalServerErrorException('Model credential is unavailable');
        }
        try {
          apiKey = this.credentialCipher.decrypt(credential);
        } catch {
          throw new InternalServerErrorException('Model credential is unavailable');
        }
      }
    }

    const config: ModelAdapterConfig = {
      baseUrl: version.baseUrl,
      modelName: version.modelName,
      apiKey,
      timeoutMs: version.timeoutMs,
      maxOutputTokens: version.maxOutputTokens,
    };

    return adapter.testConnection(config);
  }

  private async updateModel(
    id: string,
    request: UpdateAdminModelRequestDto | UpdateCustomModelRequestDto,
    actorId: string,
    ownerType: 'system' | 'user',
  ): Promise<ModelDetailDto> {
    const repositories = this.repositories();
    const model = await this.findOwnedModel(id, actorId, ownerType, repositories);
    if (ownerType === 'user') this.validateCustomInput(request as UpdateCustomModelRequestDto, true);
    else this.validateAdminInput(request as UpdateAdminModelRequestDto, true);

    if (ownerType === 'system' && 'slug' in request && request.slug) {
      const duplicate = await repositories.configs.findOne({ where: { slug: request.slug } });
      if (duplicate && duplicate.id !== id) throw new ConflictException('Model slug already exists');
    }

    if (!model.currentDraftVersionId && !model.publishedVersionId) {
      throw new BadRequestException('Model has no version to update');
    }
    const baseVersionId = model.currentDraftVersionId ?? model.publishedVersionId as string;
    const baseVersion = await repositories.versions.findOne({ where: { id: baseVersionId, modelConfigId: id } });
    if (!baseVersion) throw new NotFoundException('Model version not found');

    return this.write(async (transactionRepositories) => {
      const latestVersion = await transactionRepositories.versions.findOne({
        where: { modelConfigId: id },
        order: { version: 'DESC' },
      });
      const versionId = randomUUID();
      const nextVersion = (latestVersion?.version ?? baseVersion.version) + 1;
      if (model.currentDraftVersionId) {
        await transactionRepositories.versions.update(model.currentDraftVersionId, { versionStatus: 'superseded' });
      }
      const version = this.createVersionEntity(
        id,
        versionId,
        nextVersion,
        { ...baseVersion, ...request },
        actorId,
        baseVersion,
      );
      await transactionRepositories.versions.save(version);
      const status = model.status === 'disabled' ? 'draft' : model.publishedVersionId ? model.status : 'draft';
      const changes: Partial<ModelConfig> = {
        displayName: request.displayName ?? model.displayName,
        updatedBy: actorId,
        currentDraftVersionId: versionId,
        status,
        isSelectable: status === 'published'
          ? ('isSelectable' in request ? request.isSelectable ?? model.isSelectable : model.isSelectable)
          : false,
      };
      if (ownerType === 'system') {
        Object.assign(changes, {
          slug: 'slug' in request && request.slug !== undefined ? request.slug : model.slug,
          modelType: 'modelType' in request && request.modelType !== undefined ? request.modelType : model.modelType,
          protocol: request.protocol ?? model.protocol,
        });
      }
      await transactionRepositories.configs.update(id, changes);
      await this.saveCredentialIfProvided(transactionRepositories, id, request.apiKey, actorId);
      Object.assign(model, changes);
      Object.assign(model, { currentDraftVersionId: versionId });
      return this.toDetail(model, transactionRepositories, version);
    });
  }

  private async deleteModel(id: string, actorId: string, ownerType: 'system' | 'user'): Promise<ModelDetailDto> {
    const model = await this.findOwnedModel(id, actorId, ownerType);
    return this.deleteModelEntity(model, actorId);
  }

  private async deleteModelEntity(model: ModelConfig, actorId: string): Promise<ModelDetailDto> {
    return this.write(async (repositories) => {
      await repositories.configs.update(model.id, {
        status: 'deleted',
        isSelectable: false,
        isDefault: false,
        deletedAt: new Date(),
        updatedBy: actorId,
      });
      await repositories.credentials.delete(model.id);
      Object.assign(model, { status: 'deleted', isSelectable: false, isDefault: false, deletedAt: new Date(), updatedBy: actorId });
      return this.toDetail(model, repositories);
    });
  }

  private async findOwnedModel(
    id: string,
    ownerId: string,
    ownerType: 'system' | 'user',
    repositories = this.repositories(),
  ): Promise<ModelConfig> {
    const where = ownerType === 'system'
      ? { id, ownerType: 'system', status: Not('deleted') }
      : { id, ownerType: 'user', ownerUserId: ownerId, status: Not('deleted') };
    const model = await repositories.configs.findOne({ where });
    if (
      !model ||
      model.ownerType !== ownerType ||
      (ownerType === 'user' && model.ownerUserId !== ownerId)
    ) {
      throw new NotFoundException('Model not found');
    }
    return model;
  }

  private repositories(): ModelRepositories {
    if (!this.modelConfigs || !this.modelVersions || !this.modelCredentials) {
      return contractNotImplemented();
    }
    return {
      configs: this.modelConfigs,
      versions: this.modelVersions,
      credentials: this.modelCredentials,
    };
  }

  private async write<T>(work: (repositories: ModelRepositories) => Promise<T>): Promise<T> {
    const repositories = this.repositories();
    if (!this.dataSource) return work(repositories);
    return this.dataSource.transaction(async (manager) => work({
      configs: manager.getRepository(ModelConfig),
      versions: manager.getRepository(ModelConfigVersion),
      credentials: manager.getRepository(ModelCredential),
    }));
  }

  private normalizePagination(query: PaginationQueryDto): Pagination {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    return { page, perPage, skip: (page - 1) * perPage, take: perPage };
  }

  private async toListResponse(
    models: ModelConfig[],
    total: number,
    pagination: Pagination,
    repositories: ModelRepositories,
  ): Promise<ModelListResponseDto> {
    const ids = models.map((model) => model.id);
    const credentials = ids.length
      ? await repositories.credentials.find({ where: { modelConfigId: In(ids) } })
      : [];
    const credentialsByModel = new Map(credentials.map((credential) => [credential.modelConfigId, credential]));
    return {
      data: models.map((model) => this.toSummary(model, credentialsByModel.get(model.id))),
      meta: {
        page: pagination.page,
        perPage: pagination.perPage,
        total,
        totalPages: Math.ceil(total / pagination.perPage),
      },
    };
  }

  private toSummary(model: ModelConfig, credential?: ModelCredential): ModelSummaryDto {
    return {
      id: model.id,
      ownerType: model.ownerType as ModelSummaryDto['ownerType'],
      displayName: model.displayName,
      modelType: model.modelType as ModelSummaryDto['modelType'],
      protocol: model.protocol as ModelSummaryDto['protocol'],
      status: model.status as ModelSummaryDto['status'],
      isDefault: model.isDefault,
      isSelectable: model.isSelectable,
      hasCredential: Boolean(credential),
      secretHint: credential?.secretHint ?? null,
    };
  }

  private async toDetail(
    model: ModelConfig,
    repositories: ModelRepositories,
    preferredVersion?: ModelConfigVersion,
  ): Promise<ModelDetailDto> {
    const credential = await repositories.credentials.findOne({ where: { modelConfigId: model.id } });
    const versionId = model.currentDraftVersionId ?? model.publishedVersionId;
    const version = preferredVersion ?? (versionId ? await repositories.versions.findOne({ where: { id: versionId, modelConfigId: model.id } }) : null);
    return {
      ...this.toSummary(model, credential ?? undefined),
      currentVersion: version ? this.toVersion(version) : null,
    };
  }

  private toVersion(version: ModelConfigVersion): ModelVersionDto {
    return {
      id: version.id,
      version: version.version,
      provider: version.provider ?? null,
      baseUrl: version.baseUrl,
      modelName: version.modelName,
      timeoutMs: version.timeoutMs,
      maxOutputTokens: version.maxOutputTokens,
      supportsStream: version.supportsStream,
      supportsStructuredOutput: version.supportsStructuredOutput,
      capabilities: version.capabilities,
      requestOptions: version.requestOptions,
    };
  }

  private createModelEntity(values: Partial<ModelConfig>): ModelConfig {
    return values as ModelConfig;
  }

  private createVersionEntity(
    modelConfigId: string,
    id: string,
    version: number,
    input: ModelInput,
    actorId: string,
    base?: ModelConfigVersion,
  ): ModelConfigVersion {
    const values = {
      provider: input.provider ?? base?.provider ?? null,
      baseUrl: input.baseUrl ?? base?.baseUrl,
      modelName: input.modelName ?? base?.modelName,
      timeoutMs: input.timeoutMs ?? base?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxOutputTokens: input.maxOutputTokens ?? base?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      supportsStream: input.supportsStream ?? base?.supportsStream ?? true,
      supportsStructuredOutput: input.supportsStructuredOutput ?? base?.supportsStructuredOutput ?? true,
      capabilities: input.capabilities ?? base?.capabilities ?? {},
      requestOptions: base?.requestOptions ?? {},
    };
    const baseUrl = values.baseUrl;
    const modelName = values.modelName;
    if (!baseUrl || !modelName) {
      throw new BadRequestException('Model version requires baseUrl and modelName');
    }
    this.assertSafeObject(values.capabilities);
    this.validateNumericValues(values.timeoutMs, values.maxOutputTokens);
    return {
      id,
      modelConfigId,
      version,
      versionStatus: 'draft',
      ...values,
      baseUrl,
      modelName,
      configChecksum: this.checksum(values),
      createdBy: actorId,
      publishedAt: null,
      createdAt: new Date(),
    };
  }

  private async saveCredentialIfProvided(
    repositories: ModelRepositories,
    modelConfigId: string,
    apiKey: string | undefined,
    actorId: string,
  ): Promise<void> {
    if (apiKey === undefined) return;
    if (!apiKey) throw new BadRequestException('Model API key cannot be empty');
    if (!this.credentialCipher) throw new InternalServerErrorException('Model credential is unavailable');
    const encrypted = this.credentialCipher.encrypt(apiKey);
    await repositories.credentials.save({
      modelConfigId,
      ...encrypted,
      secretHint: ModelCredentialCipher.createSecretHint(apiKey),
      updatedBy: actorId,
    });
  }

  private validateCustomInput(input: ModelInput, partial = false): void {
    if (input.protocol !== undefined && input.protocol !== ModelProtocol.OpenAiCompatible) {
      throw new BadRequestException('Custom models only support OpenAI-compatible protocol');
    }
    if (!partial || input.baseUrl !== undefined) {
      this.validateCustomBaseUrl(input.baseUrl);
    }
    if (!partial && (!input.displayName || !input.modelName)) {
      throw new BadRequestException('Custom model requires displayName and modelName');
    }
  }

  private validateAdminInput(input: ModelInput, partial = false): void {
    if (input.modelType !== undefined && input.modelType === 'local' && input.protocol !== ModelProtocol.Ollama) {
      throw new BadRequestException('Local models must use Ollama protocol');
    }
    if (input.protocol === ModelProtocol.Ollama && input.modelType !== undefined && input.modelType !== 'local') {
      throw new BadRequestException('Ollama models must be local models');
    }
    if (!partial && (!input.displayName || !input.modelType || !input.protocol || !input.baseUrl || !input.modelName)) {
      throw new BadRequestException('Admin model requires complete model configuration');
    }
    if (input.baseUrl) {
      try {
        const url = new URL(input.baseUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
      } catch {
        throw new BadRequestException('Model baseUrl is invalid');
      }
    }
  }

  private validateCustomBaseUrl(baseUrl: string | undefined): void {
    if (!baseUrl) throw new BadRequestException('Custom model requires baseUrl');
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new BadRequestException('Custom model baseUrl is invalid');
    }
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (url.protocol !== 'https:' || url.username || url.password || this.isPrivateHost(hostname)) {
      throw new BadRequestException('Custom model baseUrl must be a public HTTPS URL');
    }
  }

  private isPrivateHost(hostname: string): boolean {
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return true;
    }
    const octets = hostname.split('.').map(Number);
    const [first = -1, second = -1] = octets;
    if (octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)) {
      return first === 10 || first === 127 || first === 0 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 169 && second === 254);
    }
    return hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:');
  }

  private assertSafeObject(value: Record<string, unknown>, path = 'capabilities'): void {
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        throw new BadRequestException(`${path}.${key} cannot contain sensitive configuration`);
      }
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        this.assertSafeObject(nested as Record<string, unknown>, `${path}.${key}`);
      }
    }
  }

  private validateNumericValues(timeoutMs: number, maxOutputTokens: number): void {
    if (timeoutMs < 1000 || timeoutMs > 300000) throw new BadRequestException('Model timeoutMs is out of range');
    if (maxOutputTokens < 1 || maxOutputTokens > 100000) throw new BadRequestException('Model maxOutputTokens is out of range');
  }

  private checksum(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private createAdapter(protocol: string): OpenAiCompatibleModelAdapter | OllamaModelAdapter {
    switch (protocol) {
      case 'openai_compatible':
        return new OpenAiCompatibleModelAdapter();
      case 'ollama':
        return new OllamaModelAdapter();
      default:
        throw new BadRequestException('Model protocol is not supported for connection tests');
    }
  }
}
