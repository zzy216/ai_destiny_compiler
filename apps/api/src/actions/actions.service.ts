import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';

import { contractNotImplemented } from '../common/contract-not-implemented';
import {
  ActionCard,
  ExecutionRecord,
  Memory,
  Review,
} from '../database/entities';
import {
  ActionCardQueryDto,
  ActionCardStatus,
  ActionPaginationQueryDto,
  CreateExecutionRecordRequestDto,
  CreateMemoryRequestDto,
  CreateReviewRequestDto,
  ExecutionRecordResultDto,
  ExecutionResult,
  MemoryQueryDto,
  ReviewQueryDto,
  ReviewType,
} from './actions.dto';

type PaginatedResult<T> = {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVELOPMENT_USER_ID = '00000000-0000-4000-8000-000000000002';

@Injectable()
export class ActionsService {
  constructor(
    @Optional() @InjectRepository(ActionCard) private readonly actionCards?: Repository<ActionCard>,
    @Optional() @InjectRepository(ExecutionRecord) private readonly executionRecords?: Repository<ExecutionRecord>,
    @Optional() @InjectRepository(Review) private readonly reviews?: Repository<Review>,
    @Optional() @InjectRepository(Memory) private readonly memories?: Repository<Memory>,
  ) {}

  async listActionCards(
    query: ActionCardQueryDto = {},
    userId = DEVELOPMENT_USER_ID,
  ): Promise<PaginatedResult<ActionCard>> {
    const pagination = this.pagination(query);
    const where: FindOptionsWhere<ActionCard> = { userId };
    if (query.status) where.status = query.status;

    const [data, total] = await this.actionCardRepository().findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.perPage,
    });
    return { data, meta: this.meta(pagination, total) };
  }

  async getActionCard(id: string, userId = DEVELOPMENT_USER_ID): Promise<ActionCard> {
    this.validateUuid(id, 'actionCardId');
    const actionCard = await this.actionCardRepository().findOne({ where: { id, userId } });
    if (!actionCard) throw new NotFoundException('Action card not found');
    return actionCard;
  }

  async listExecutionRecords(
    actionCardId: string,
    query: ActionPaginationQueryDto = {},
    userId = DEVELOPMENT_USER_ID,
  ): Promise<PaginatedResult<ExecutionRecord>> {
    await this.getActionCard(actionCardId, userId);
    const pagination = this.pagination(query);
    const [data, total] = await this.executionRecordRepository().findAndCount({
      where: { actionCardId, userId },
      order: { submittedAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.perPage,
    });
    return { data, meta: this.meta(pagination, total) };
  }

  async submitExecutionRecord(
    actionCardId: string,
    input: CreateExecutionRecordRequestDto,
    userId = DEVELOPMENT_USER_ID,
  ): Promise<ExecutionRecordResultDto> {
    const actionCard = await this.getActionCard(actionCardId, userId);
    if (actionCard.status === ActionCardStatus.Abandoned) {
      throw new BadRequestException('Abandoned action cards cannot accept execution feedback');
    }

    const now = new Date();
    const nextStatus = this.statusFromExecutionResult(input.result);
    const record = await this.executionRecordRepository().save(this.executionRecordRepository().create({
      id: randomUUID(),
      userId,
      actionCardId,
      result: input.result,
      note: input.note ?? null,
      obstacleType: input.obstacleType ?? null,
      evidence: input.evidence ?? {},
      submittedAt: now,
      createdAt: now,
    } as ExecutionRecord));

    await this.actionCardRepository().update(actionCardId, {
      status: nextStatus,
      completedAt: nextStatus === ActionCardStatus.Completed ? now : null,
      updatedAt: now,
    });

    return { data: record as never, actionCardStatus: nextStatus };
  }

  async listReviews(
    query: ReviewQueryDto = {},
    userId = DEVELOPMENT_USER_ID,
  ): Promise<PaginatedResult<Review>> {
    const pagination = this.pagination(query);
    const where: FindOptionsWhere<Review> = { userId };
    if (query.reviewType) where.reviewType = query.reviewType;

    const [data, total] = await this.reviewRepository().findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.perPage,
    });
    return { data, meta: this.meta(pagination, total) };
  }

  async createReview(input: CreateReviewRequestDto, userId = DEVELOPMENT_USER_ID): Promise<Review> {
    if (input.reviewType === ReviewType.Action && !input.actionCardId) {
      throw new BadRequestException('actionCardId is required for action reviews');
    }
    if (input.actionCardId) {
      await this.getActionCard(input.actionCardId, userId);
    }

    const now = new Date();
    return this.reviewRepository().save(this.reviewRepository().create({
      id: randomUUID(),
      userId,
      reviewType: input.reviewType,
      actionCardId: input.actionCardId ?? null,
      generatedByRunId: input.generatedByRunId ?? null,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      summary: input.summary,
      progress: input.progress ?? {},
      frictions: input.frictions ?? [],
      nextFocus: input.nextFocus ?? null,
      createdAt: now,
      updatedAt: now,
    } as Review));
  }

  async listMemories(
    query: MemoryQueryDto = {},
    userId = DEVELOPMENT_USER_ID,
  ): Promise<PaginatedResult<Memory>> {
    const pagination = this.pagination(query);
    const where: FindOptionsWhere<Memory> = { userId };
    if (query.category) where.category = query.category;

    const [data, total] = await this.memoryRepository().findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.perPage,
    });
    return { data, meta: this.meta(pagination, total) };
  }

  async createMemory(input: CreateMemoryRequestDto, userId = DEVELOPMENT_USER_ID): Promise<Memory> {
    if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1)) {
      throw new BadRequestException('confidence must be between 0 and 1');
    }

    const now = new Date();
    return this.memoryRepository().save(this.memoryRepository().create({
      id: randomUUID(),
      userId,
      sourceConversationId: input.sourceConversationId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      category: input.category,
      content: input.content,
      confidence: input.confidence === undefined ? null : input.confidence.toFixed(3),
      confirmedByUser: input.confirmedByUser ?? false,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    } as Memory));
  }

  async deleteMemory(id: string, userId = DEVELOPMENT_USER_ID): Promise<void> {
    this.validateUuid(id, 'memoryId');
    const memory = await this.memoryRepository().findOne({ where: { id, userId } });
    if (!memory) throw new NotFoundException('Memory not found');
    await this.memoryRepository().delete({ id, userId });
  }

  private statusFromExecutionResult(result: ExecutionResult): ActionCardStatus {
    if (result === ExecutionResult.Completed) return ActionCardStatus.Completed;
    if (result === ExecutionResult.PartiallyCompleted) return ActionCardStatus.PartiallyCompleted;
    if (result === ExecutionResult.NotCompleted) return ActionCardStatus.NotCompleted;
    throw new BadRequestException('Execution result is invalid');
  }

  private validateUuid(value: string, name: string): void {
    if (!UUID_V4_PATTERN.test(value)) throw new BadRequestException(`${name} must be a UUID v4 value`);
  }

  private pagination(query: ActionPaginationQueryDto): { page: number; perPage: number; skip: number } {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    return { page, perPage, skip: (page - 1) * perPage };
  }

  private meta(pagination: { page: number; perPage: number }, total: number) {
    return { page: pagination.page, perPage: pagination.perPage, total, totalPages: Math.ceil(total / pagination.perPage) };
  }

  private actionCardRepository(): Repository<ActionCard> {
    return this.actionCards ?? contractNotImplemented();
  }

  private executionRecordRepository(): Repository<ExecutionRecord> {
    return this.executionRecords ?? contractNotImplemented();
  }

  private reviewRepository(): Repository<Review> {
    return this.reviews ?? contractNotImplemented();
  }

  private memoryRepository(): Repository<Memory> {
    return this.memories ?? contractNotImplemented();
  }
}
