import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';

import { AgentRun, CoachConfig, KnowledgeCard } from '../database/entities';
import { contractNotImplemented } from '../common/contract-not-implemented';
import type {
  CreateCoachConfigRequestDto,
  CreateKnowledgeCardRequestDto,
  UpdateCoachConfigRequestDto,
  UpdateKnowledgeCardRequestDto,
} from './admin-management.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;

export type AdminPagination = {
  page?: number;
  perPage?: number;
  status?: string;
  category?: string;
};

export type AdminPage<T> = {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

type AdminActor = string;

@Injectable()
export class AdminManagementService {
  constructor(
    @Optional() @InjectRepository(CoachConfig)
    private readonly coachConfigs?: Repository<CoachConfig>,
    @Optional() @InjectRepository(KnowledgeCard)
    private readonly knowledgeCards?: Repository<KnowledgeCard>,
    @Optional() @InjectRepository(AgentRun)
    private readonly agentRuns?: Repository<AgentRun>,
  ) {}

  async listCoachConfigs(query: AdminPagination = {}): Promise<AdminPage<Record<string, unknown>>> {
    const pagination = this.pagination(query);
    const [rows, total] = await this.coachRepository().findAndCount({
      where: this.contentWhere(query),
      order: { version: 'DESC' },
      skip: pagination.skip,
      take: pagination.perPage,
    });
    return this.page(rows.map((row) => this.coachSummary(row)), total, pagination);
  }

  async getCoachConfig(id: string): Promise<Record<string, unknown>> {
    const row = await this.coachRepository().findOne({ where: { id } });
    if (!row) throw new NotFoundException('Coach config not found');
    return this.coachDetail(row);
  }

  async createCoachConfig(input: CreateCoachConfigRequestDto, actor: AdminActor): Promise<Record<string, unknown>> {
    const latest = await this.coachRepository().findOne({ order: { version: 'DESC' } });
    const row = this.coachRepository().create({
      id: randomUUID(),
      version: (latest?.version ?? 0) + 1,
      ...input,
      status: 'draft',
      createdBy: actor,
      publishedAt: null,
    } as CoachConfig);
    return this.coachDetail(await this.coachRepository().save(row));
  }

  async updateCoachConfig(id: string, input: UpdateCoachConfigRequestDto, actor: AdminActor): Promise<Record<string, unknown>> {
    const row = await this.coachRepository().findOne({ where: { id } });
    if (!row) throw new NotFoundException('Coach config not found');
    if (row.status === 'published') throw new ConflictException('Published coach config is read-only');
    Object.assign(row, input, { createdBy: row.createdBy ?? actor });
    return this.coachDetail(await this.coachRepository().save(row));
  }

  async publishCoachConfig(id: string, actor: AdminActor): Promise<Record<string, unknown>> {
    const row = await this.coachRepository().findOne({ where: { id } });
    if (!row) throw new NotFoundException('Coach config not found');
    await this.coachRepository().update({ status: 'published' }, { status: 'disabled' });
    Object.assign(row, { status: 'published', publishedAt: new Date(), createdBy: row.createdBy ?? actor });
    await this.coachRepository().update(row.id, { status: row.status, publishedAt: row.publishedAt, createdBy: row.createdBy });
    return this.coachDetail(row);
  }

  async listKnowledgeCards(query: AdminPagination = {}): Promise<AdminPage<Record<string, unknown>>> {
    const pagination = this.pagination(query);
    const [rows, total] = await this.cardRepository().findAndCount({
      where: this.contentWhere(query),
      order: { updatedAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.perPage,
    });
    return this.page(rows.map((row) => this.cardDetail(row)), total, pagination);
  }

  async getKnowledgeCard(id: string): Promise<Record<string, unknown>> {
    const row = await this.cardRepository().findOne({ where: { id } });
    if (!row) throw new NotFoundException('Knowledge card not found');
    return this.cardDetail(row);
  }

  async createKnowledgeCard(input: CreateKnowledgeCardRequestDto, actor: AdminActor): Promise<Record<string, unknown>> {
    const row = this.cardRepository().create({
      id: randomUUID(),
      version: 1,
      ...input,
      status: 'draft',
      createdBy: actor,
      publishedAt: null,
    } as KnowledgeCard);
    return this.cardDetail(await this.cardRepository().save(row));
  }

  async updateKnowledgeCard(id: string, input: UpdateKnowledgeCardRequestDto, actor: AdminActor): Promise<Record<string, unknown>> {
    const row = await this.cardRepository().findOne({ where: { id } });
    if (!row) throw new NotFoundException('Knowledge card not found');
    if (row.status === 'published') throw new ConflictException('Published knowledge card is read-only');
    Object.assign(row, input, { createdBy: row.createdBy ?? actor });
    return this.cardDetail(await this.cardRepository().save(row));
  }

  async publishKnowledgeCard(id: string, actor: AdminActor): Promise<Record<string, unknown>> {
    const row = await this.cardRepository().findOne({ where: { id } });
    if (!row) throw new NotFoundException('Knowledge card not found');
    Object.assign(row, { status: 'published', publishedAt: new Date(), createdBy: row.createdBy ?? actor });
    return this.cardDetail(await this.cardRepository().save(row));
  }

  async listAgentRuns(query: AdminPagination = {}): Promise<AdminPage<Record<string, unknown>>> {
    const pagination = this.pagination(query);
    const [rows, total] = await this.runRepository().findAndCount({
      where: this.contentWhere(query),
      order: { startedAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.perPage,
    });
    return this.page(rows.map((row) => this.runSummary(row)), total, pagination);
  }

  async getAgentRun(id: string): Promise<Record<string, unknown>> {
    const row = await this.runRepository().findOne({ where: { id } });
    if (!row) throw new NotFoundException('Agent run not found');
    return this.runSummary(row);
  }

  private contentWhere(query: AdminPagination): FindOptionsWhere<CoachConfig | KnowledgeCard | AgentRun> {
    const where: Record<string, string> = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    return where as FindOptionsWhere<CoachConfig | KnowledgeCard | AgentRun>;
  }

  private coachRepository(): Repository<CoachConfig> {
    if (!this.coachConfigs) return contractNotImplemented();
    return this.coachConfigs;
  }

  private cardRepository(): Repository<KnowledgeCard> {
    if (!this.knowledgeCards) return contractNotImplemented();
    return this.knowledgeCards;
  }

  private runRepository(): Repository<AgentRun> {
    if (!this.agentRuns) return contractNotImplemented();
    return this.agentRuns;
  }

  private pagination(query: AdminPagination): { page: number; perPage: number; skip: number } {
    const page = Math.max(DEFAULT_PAGE, query.page ?? DEFAULT_PAGE);
    const perPage = Math.min(100, Math.max(1, query.perPage ?? DEFAULT_PER_PAGE));
    return { page, perPage, skip: (page - 1) * perPage };
  }

  private page<T>(data: T[], total: number, pagination: { page: number; perPage: number }): AdminPage<T> {
    return {
      data,
      meta: { page: pagination.page, perPage: pagination.perPage, total, totalPages: Math.ceil(total / pagination.perPage) },
    };
  }

  private coachSummary(row: CoachConfig): Record<string, unknown> {
    return {
      id: row.id,
      version: row.version,
      name: row.name,
      status: row.status,
      productGoal: row.productGoal,
      defaultModelConfigId: row.defaultModelConfigId,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  }

  private coachDetail(row: CoachConfig): Record<string, unknown> {
    return {
      ...this.coachSummary(row),
      roleDefinition: row.roleDefinition,
      systemPrompt: row.systemPrompt,
      conversationRules: row.conversationRules,
      actionRules: row.actionRules,
      prohibitedContent: row.prohibitedContent,
      safetyRules: row.safetyRules,
      outputSchema: row.outputSchema,
    };
  }

  private cardDetail(row: KnowledgeCard): Record<string, unknown> {
    return {
      id: row.id,
      cardKey: row.cardKey,
      version: row.version,
      name: row.name,
      category: row.category,
      tags: row.tags,
      problemSignals: row.problemSignals,
      variables: row.variables,
      diagnosticQuestions: row.diagnosticQuestions,
      candidateActions: row.candidateActions,
      stopDoing: row.stopDoing,
      reviewQuestions: row.reviewQuestions,
      status: row.status,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  }

  private runSummary(row: AgentRun): Record<string, unknown> {
    const snapshot = row.modelSnapshot && typeof row.modelSnapshot === 'object' ? row.modelSnapshot : {};
    return {
      id: row.id,
      status: row.status,
      modelName: typeof snapshot.modelName === 'string' ? snapshot.modelName : '未知模型',
      modelConfigId: row.modelConfigId,
      modelConfigVersionId: row.modelConfigVersionId,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedCost: row.estimatedCost,
      durationMs: row.durationMs,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
    };
  }
}
