import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { AgentRunsService } from '../agent-runs/agent-runs.service';
import { contractNotImplemented } from '../common/contract-not-implemented';
import {
  ActionCard,
  CoachConfig,
  Conversation,
  KnowledgeCard,
  Message,
} from '../database/entities';
import { ModelsService } from '../models/models.service';
import type { ModelMessage } from '../models/model-adapters';
import type {
  ConversationPaginationQueryDto,
  CreateConversationRequestDto,
  SendMessageRequestDto,
} from './conversations.dto';

export type CreateConversationInput = Pick<CreateConversationRequestDto, 'modelConfigId' | 'goalId' | 'title' | 'inheritedSummary'>;
export type SendMessageInput = SendMessageRequestDto;
export type ConversationStreamEvent = {
  event: 'run.started' | 'message.delta' | 'message.completed' | 'run.failed';
  data: Record<string, unknown>;
};
export type ConversationExecutionResult = {
  agentRunId: string;
  responseMessageId: string | null;
  actionCardId: string | null;
  events: ConversationStreamEvent[];
};
export type PaginatedResult<T> = {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

const DEVELOPMENT_USER_ID = '00000000-0000-4000-8000-000000000002';
const PROMPT_VERSION = 'mvp-0.1';
const MAX_MESSAGE_LENGTH = 20_000;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DiagnosticAction = {
  title: string;
  durationMinutes?: number;
  deliverable: string;
  completionCriteria: string[];
  stopDoing?: string[];
};

type DiagnosticOutput = {
  diagnosis: string;
  assumptions: string[];
  nextActions: DiagnosticAction[];
  followUpQuestion: string;
};

@Injectable()
export class ConversationsService {
  constructor(
    @Optional() @InjectRepository(Conversation) private readonly conversations?: Repository<Conversation>,
    @Optional() @InjectRepository(Message) private readonly messages?: Repository<Message>,
    @Optional() @InjectRepository(ActionCard) private readonly actionCards?: Repository<ActionCard>,
    @Optional() @InjectRepository(CoachConfig) private readonly coaches?: Repository<CoachConfig>,
    @Optional() @InjectRepository(KnowledgeCard) private readonly knowledgeCards?: Repository<KnowledgeCard>,
    @Optional() @Inject(ModelsService) private readonly models?: ModelsService,
    @Optional() @Inject(AgentRunsService) private readonly agentRuns?: AgentRunsService,
  ) {}

  async createConversation(input: CreateConversationInput, userId = DEVELOPMENT_USER_ID): Promise<Conversation> {
    this.validateUuid(userId, 'userId');
    if (!input.modelConfigId || !UUID_V4_PATTERN.test(input.modelConfigId)) {
      throw new BadRequestException('modelConfigId must be a UUID v4 value');
    }
    if (input.title !== undefined && input.title.length > 150) throw new BadRequestException('title is too long');
    if (input.inheritedSummary !== undefined && input.inheritedSummary.length > 4000) {
      throw new BadRequestException('inheritedSummary is too long');
    }

    const runtime = await this.modelService().getPublishedModelRuntime(input.modelConfigId, userId);
    const now = new Date();
    const conversation = this.conversationRepository().create({
      id: randomUUID(),
      userId,
      goalId: input.goalId ?? null,
      title: input.title ?? null,
      status: 'active',
      modelSource: runtime.snapshot.ownerType === 'user' ? 'custom' : 'managed',
      modelConfigId: runtime.modelConfigId,
      modelConfigVersionId: runtime.modelConfigVersionId,
      modelSnapshot: runtime.snapshot,
      summary: input.inheritedSummary ?? null,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    } as Conversation);
    return this.conversationRepository().save(conversation);
  }

  async listConversations(
    query: ConversationPaginationQueryDto = {},
    userId = DEVELOPMENT_USER_ID,
  ): Promise<PaginatedResult<Conversation>> {
    const pagination = this.pagination(query);
    const repository = this.conversationRepository();
    const [data, total] = await Promise.all([
      repository.find({ where: { userId }, order: { createdAt: 'DESC' }, skip: pagination.skip, take: pagination.perPage }),
      repository.count({ where: { userId } }),
    ]);
    return { data, meta: this.meta(pagination, total) };
  }

  async listMessages(
    conversationId: string,
    query: ConversationPaginationQueryDto = {},
    userId = DEVELOPMENT_USER_ID,
  ): Promise<PaginatedResult<Message>> {
    this.validateUuid(conversationId, 'conversationId');
    await this.getConversation(conversationId, userId);
    const pagination = this.pagination(query);
    const repository = this.messageRepository();
    const [data, total] = await Promise.all([
      repository.find({ where: { conversationId, userId }, order: { sequence: 'ASC' }, skip: pagination.skip, take: pagination.perPage }),
      repository.count({ where: { conversationId, userId } }),
    ]);
    return { data, meta: this.meta(pagination, total) };
  }

  async executeMessage(
    conversationId: string,
    input: SendMessageInput,
    userId = DEVELOPMENT_USER_ID,
  ): Promise<ConversationExecutionResult> {
    this.validateMessageInput(input);
    const conversation = await this.getConversation(conversationId, userId);
    const existingRun = await this.agentRunService().findByIdempotencyKey(userId, input.idempotencyKey);
    if (existingRun) {
      return {
        agentRunId: existingRun.id,
        responseMessageId: existingRun.responseMessageId ?? null,
        actionCardId: null,
        events: [{ event: 'run.started', data: { agentRunId: existingRun.id, replay: true } }],
      };
    }

    const runtime = await this.modelService().getPublishedModelRuntime(conversation.modelConfigId, userId);
    const coach = await this.coachRepository().findOne({ where: { status: 'published' }, order: { version: 'DESC' } });
    if (!coach) throw new NotFoundException('Published coach configuration not found');
    const cards = await this.matchKnowledgeCards(input.content);
    const requestMessage = await this.saveMessage({
      id: randomUUID(),
      conversationId,
      userId,
      sequence: await this.nextSequence(conversationId),
      role: 'user',
      content: input.content,
      contentJson: null,
      status: 'completed',
      agentRunId: null,
      completedAt: new Date(),
    });
    const run = await this.agentRunService().startRun({
      userId,
      conversationId,
      requestMessageId: requestMessage.id,
      idempotencyKey: input.idempotencyKey,
      modelConfigId: runtime.modelConfigId,
      modelConfigVersionId: runtime.modelConfigVersionId,
      modelSnapshot: runtime.snapshot,
      coachConfigId: coach.id,
      coachConfigSnapshot: this.coachSnapshot(coach),
      matchedKnowledgeCards: cards.map((card) => this.cardSnapshot(card)),
      promptVersion: PROMPT_VERSION,
    });
    await this.messageRepository().update(requestMessage.id, { agentRunId: run.id });

    const startedAt = Date.now();
    const startedEvent: ConversationStreamEvent = { event: 'run.started', data: { agentRunId: run.id } };
    try {
      const completion = await runtime.complete(this.buildPrompt(coach, cards, input.content));
      const diagnostic = this.parseDiagnostic(completion.content);
      const responseMessage = await this.saveMessage({
        id: randomUUID(),
        conversationId,
        userId,
        sequence: await this.nextSequence(conversationId),
        role: 'assistant',
        content: completion.content,
        contentJson: diagnostic as unknown as Record<string, unknown>,
        status: 'completed',
        agentRunId: run.id,
        completedAt: new Date(),
      });
      const action = diagnostic.nextActions[0];
      if (!action) throw new DiagnosticOutputError();
      const actionCard = await this.actionCardRepository().save(this.actionCardRepository().create({
        id: randomUUID(),
        userId,
        conversationId,
        agentRunId: run.id,
        goalId: conversation.goalId ?? null,
        isPrimary: true,
        title: action.title,
        durationMinutes: action.durationMinutes ?? null,
        deliverable: action.deliverable,
        completionCriteria: action.completionCriteria,
        stopDoing: action.stopDoing ?? [],
        status: 'pending',
        dueAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ActionCard));
      await this.messageRepository().update(responseMessage.id, { status: 'completed', completedAt: new Date() });
      await this.conversationRepository().update(conversation.id, { lastMessageAt: new Date(), updatedAt: new Date() });
      await this.agentRunService().succeedRun(run.id, userId, {
        responseMessageId: responseMessage.id,
        inputTokens: completion.usage.inputTokens ?? undefined,
        outputTokens: completion.usage.outputTokens ?? undefined,
        providerRequestId: completion.providerRequestId ?? undefined,
        durationMs: Date.now() - startedAt,
        resultJson: diagnostic as unknown as Record<string, unknown>,
      });
      return {
        agentRunId: run.id,
        responseMessageId: responseMessage.id,
        actionCardId: actionCard.id,
        events: [
          startedEvent,
          { event: 'message.delta', data: { agentRunId: run.id, delta: completion.content } },
          { event: 'message.completed', data: { agentRunId: run.id, messageId: responseMessage.id, actionCardId: actionCard.id, contentJson: diagnostic } },
        ],
      };
    } catch (error) {
      const errorCode = error instanceof DiagnosticOutputError ? 'INVALID_DIAGNOSTIC_OUTPUT' : 'MODEL_EXECUTION_FAILED';
      const errorMessage = errorCode === 'INVALID_DIAGNOSTIC_OUTPUT'
        ? 'Model returned an invalid diagnostic response'
        : 'Model execution failed';
      await this.agentRunService().failRun(run.id, userId, { errorCode, errorMessage, durationMs: Date.now() - startedAt });
      return {
        agentRunId: run.id,
        responseMessageId: null,
        actionCardId: null,
        events: [startedEvent, { event: 'run.failed', data: { agentRunId: run.id, errorCode, errorMessage } }],
      };
    }
  }

  async *streamMessage(
    conversationId: string,
    input: SendMessageInput,
    userId = DEVELOPMENT_USER_ID,
  ): AsyncGenerator<ConversationStreamEvent> {
    const result = await this.executeMessage(conversationId, input, userId);
    yield* result.events;
  }

  private async getConversation(id: string, userId: string): Promise<Conversation> {
    this.validateUuid(id, 'conversationId');
    const conversation = await this.conversationRepository().findOne({ where: { id, userId } });
    if (!conversation || conversation.userId !== userId) throw new NotFoundException('Conversation not found');
    if (conversation.status !== 'active') throw new BadRequestException('Conversation is not active');
    return conversation;
  }

  private async matchKnowledgeCards(content: string): Promise<KnowledgeCard[]> {
    const cards = await this.knowledgeCardRepository().find({ where: { status: 'published' }, order: { version: 'DESC' } }) ?? [];
    const lower = content.toLocaleLowerCase();
    const matching = cards.filter((card) => [...(card.problemSignals ?? []), ...(card.tags ?? []), card.name]
      .filter((signal): signal is string => typeof signal === 'string')
      .some((signal) => lower.includes(signal.toLocaleLowerCase())));
    return (matching.length > 0 ? matching : cards).slice(0, 3);
  }

  private buildPrompt(coach: CoachConfig, cards: KnowledgeCard[], content: string): ModelMessage[] {
    const knowledge = cards.map((card) => ({
      name: card.name,
      category: card.category,
      diagnosticQuestions: card.diagnosticQuestions,
      candidateActions: card.candidateActions,
      stopDoing: card.stopDoing,
    }));
    return [
      { role: 'system', content: `${coach.systemPrompt}\n输出必须是 JSON，字段为 diagnosis、assumptions、nextActions、followUpQuestion。知识卡：${JSON.stringify(knowledge)}` },
      { role: 'user', content },
    ];
  }

  private parseDiagnostic(content: string): DiagnosticOutput {
    let value: unknown;
    try {
      value = JSON.parse(content);
    } catch {
      throw new DiagnosticOutputError();
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DiagnosticOutputError();
    const output = value as Record<string, unknown>;
    const actions = output.nextActions;
    if (
      typeof output.diagnosis !== 'string' || !output.diagnosis.trim() ||
      !Array.isArray(output.assumptions) || output.assumptions.some((item) => typeof item !== 'string') ||
      !Array.isArray(actions) || actions.length < 1 || actions.length > 3 ||
      typeof output.followUpQuestion !== 'string'
    ) throw new DiagnosticOutputError();
    const nextActions = actions.map((action) => {
      if (!action || typeof action !== 'object' || Array.isArray(action)) throw new DiagnosticOutputError();
      const candidate = action as Record<string, unknown>;
      const durationMinutes = candidate.durationMinutes;
      const stopDoing = candidate.stopDoing;
      if (
        typeof candidate.title !== 'string' || !candidate.title.trim() ||
        typeof candidate.deliverable !== 'string' || !candidate.deliverable.trim() ||
        !Array.isArray(candidate.completionCriteria) || candidate.completionCriteria.some((item) => typeof item !== 'string') ||
        (durationMinutes !== undefined && (!Number.isInteger(durationMinutes) || typeof durationMinutes !== 'number' || durationMinutes < 1 || durationMinutes > 1440)) ||
        (stopDoing !== undefined && (!Array.isArray(stopDoing) || stopDoing.some((item) => typeof item !== 'string')))
      ) throw new DiagnosticOutputError();
      return {
        title: candidate.title,
        durationMinutes: durationMinutes as number | undefined,
        deliverable: candidate.deliverable,
        completionCriteria: candidate.completionCriteria as string[],
        stopDoing: stopDoing as string[] | undefined,
      };
    });
    return {
      diagnosis: output.diagnosis,
      assumptions: output.assumptions as string[],
      nextActions,
      followUpQuestion: output.followUpQuestion as string,
    };
  }

  private coachSnapshot(coach: CoachConfig): Record<string, unknown> {
    return {
      id: coach.id,
      version: coach.version,
      name: coach.name,
      conversationRules: coach.conversationRules,
      actionRules: coach.actionRules,
      outputSchema: coach.outputSchema,
    };
  }

  private cardSnapshot(card: KnowledgeCard): Record<string, unknown> {
    return {
      id: card.id,
      cardKey: card.cardKey,
      version: card.version,
      name: card.name,
      category: card.category,
      tags: card.tags,
      problemSignals: card.problemSignals,
      candidateActions: card.candidateActions,
      stopDoing: card.stopDoing,
    };
  }

  private async nextSequence(conversationId: string): Promise<number> {
    const latest = await this.messageRepository().findOne({ where: { conversationId }, order: { sequence: 'DESC' } });
    return (latest?.sequence ?? 0) + 1;
  }

  private async saveMessage(input: Partial<Message>): Promise<Message> {
    return this.messageRepository().save(this.messageRepository().create(input as Message));
  }

  private validateMessageInput(input: SendMessageInput): void {
    if (!input || typeof input.content !== 'string' || !input.content.trim() || input.content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('Message content is invalid');
    }
    this.validateUuid(input.idempotencyKey, 'idempotencyKey');
  }

  private validateUuid(value: string, name: string): void {
    if (!UUID_V4_PATTERN.test(value)) throw new BadRequestException(`${name} must be a UUID v4 value`);
  }

  private pagination(query: ConversationPaginationQueryDto): { page: number; perPage: number; skip: number } {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    return { page, perPage, skip: (page - 1) * perPage };
  }

  private meta(pagination: { page: number; perPage: number }, total: number) {
    return { page: pagination.page, perPage: pagination.perPage, total, totalPages: Math.ceil(total / pagination.perPage) };
  }

  private conversationRepository(): Repository<Conversation> {
    return this.conversations ?? contractNotImplemented();
  }

  private messageRepository(): Repository<Message> {
    return this.messages ?? contractNotImplemented();
  }

  private actionCardRepository(): Repository<ActionCard> {
    return this.actionCards ?? contractNotImplemented();
  }

  private coachRepository(): Repository<CoachConfig> {
    return this.coaches ?? contractNotImplemented();
  }

  private knowledgeCardRepository(): Repository<KnowledgeCard> {
    return this.knowledgeCards ?? contractNotImplemented();
  }

  private modelService(): ModelsService {
    return this.models ?? contractNotImplemented();
  }

  private agentRunService(): AgentRunsService {
    return this.agentRuns ?? contractNotImplemented();
  }
}

class DiagnosticOutputError extends Error {}
