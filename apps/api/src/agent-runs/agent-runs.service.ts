import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { contractNotImplemented } from '../common/contract-not-implemented';
import { AgentRun } from '../database/entities';

export type AgentRunStatus = 'running' | 'succeeded' | 'failed' | 'timeout' | 'cancelled';

export type CreateAgentRunInput = {
  userId: string;
  conversationId: string;
  requestMessageId: string;
  idempotencyKey: string;
  modelConfigId: string;
  modelConfigVersionId: string;
  modelSnapshot: Record<string, unknown>;
  coachConfigId: string;
  coachConfigSnapshot: Record<string, unknown>;
  matchedKnowledgeCards?: unknown[];
  promptVersion: string;
};

export type FinishAgentRunInput = {
  responseMessageId?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: string | number;
  providerRequestId?: string;
  durationMs?: number;
  resultJson?: Record<string, unknown>;
};

export type FailAgentRunInput = {
  errorCode: string;
  errorMessage: string;
  durationMs?: number;
};

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY_PATTERN = /api[_-]?key|authorization|token|secret|password|credential|prompt|chat|content/i;
const TERMINAL_STATUSES = new Set<AgentRunStatus>(['succeeded', 'failed', 'timeout', 'cancelled']);

@Injectable()
export class AgentRunsService {
  constructor(
    @Optional()
    @InjectRepository(AgentRun)
    private readonly agentRuns?: Repository<AgentRun>,
  ) {}

  async startRun(input: CreateAgentRunInput): Promise<AgentRun> {
    this.validateCreateInput(input);
    const repository = this.repository();
    const existing = await repository.findOne({
      where: { userId: input.userId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const now = new Date();
    const run = repository.create({
      id: randomUUID(),
      ...input,
      matchedKnowledgeCards: input.matchedKnowledgeCards ?? [],
      status: 'running',
      responseMessageId: null,
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
      providerRequestId: null,
      durationMs: null,
      resultJson: null,
      errorCode: null,
      errorMessage: null,
      startedAt: now,
      completedAt: null,
      createdAt: now,
    } as AgentRun);

    try {
      return await repository.save(run);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const concurrent = await repository.findOne({
          where: { userId: input.userId, idempotencyKey: input.idempotencyKey },
        });
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<AgentRun | null> {
    if (!UUID_V4_PATTERN.test(userId) || !UUID_V4_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException('Agent run identifiers must be UUID v4 values');
    }
    return this.repository().findOne({ where: { userId, idempotencyKey } });
  }

  async succeedRun(id: string, userId: string, input: FinishAgentRunInput = {}): Promise<AgentRun> {
    this.validateFinishInput(input);
    return this.finishRun(id, userId, 'succeeded', input);
  }

  async failRun(id: string, userId: string, input: FailAgentRunInput): Promise<AgentRun> {
    this.validateFailureInput(input);
    return this.finishRun(id, userId, 'failed', {
      errorCode: input.errorCode,
      errorMessage: this.normalizeErrorMessage(input.errorMessage),
      durationMs: input.durationMs,
    });
  }

  async timeoutRun(id: string, userId: string, input: FailAgentRunInput = {
    errorCode: 'AGENT_RUN_TIMEOUT',
    errorMessage: 'Agent run timed out',
  }): Promise<AgentRun> {
    this.validateFailureInput(input);
    return this.finishRun(id, userId, 'timeout', {
      errorCode: input.errorCode,
      errorMessage: this.normalizeErrorMessage(input.errorMessage),
      durationMs: input.durationMs,
    });
  }

  async cancelRun(id: string, userId: string): Promise<AgentRun> {
    return this.finishRun(id, userId, 'cancelled', {});
  }

  private async finishRun(
    id: string,
    userId: string,
    status: Exclude<AgentRunStatus, 'running'>,
    input: FinishAgentRunInput & Partial<FailAgentRunInput>,
  ): Promise<AgentRun> {
    const repository = this.repository();
    const run = await repository.findOne({ where: { id, userId } });
    if (!run || run.userId !== userId) throw new NotFoundException('Agent run not found');
    if (TERMINAL_STATUSES.has(run.status as AgentRunStatus) || run.status !== 'running') {
      throw new ConflictException('Agent run is already finished');
    }

    const changes: Partial<AgentRun> = {
      status,
      completedAt: new Date(),
    };
    if (input.responseMessageId !== undefined) changes.responseMessageId = input.responseMessageId;
    if (input.inputTokens !== undefined) changes.inputTokens = input.inputTokens;
    if (input.outputTokens !== undefined) changes.outputTokens = input.outputTokens;
    if (input.estimatedCost !== undefined) changes.estimatedCost = String(input.estimatedCost);
    if (input.providerRequestId !== undefined) changes.providerRequestId = input.providerRequestId;
    if (input.durationMs !== undefined) changes.durationMs = input.durationMs;
    if (input.resultJson !== undefined) changes.resultJson = input.resultJson;
    if (input.errorCode !== undefined) changes.errorCode = input.errorCode;
    if (input.errorMessage !== undefined) changes.errorMessage = input.errorMessage;

    await repository.update(id, changes as never);
    Object.assign(run, changes);
    return run;
  }

  private repository(): Repository<AgentRun> {
    if (!this.agentRuns) return contractNotImplemented();
    return this.agentRuns;
  }

  private validateCreateInput(input: CreateAgentRunInput): void {
    const identifiers = [
      input.userId,
      input.conversationId,
      input.requestMessageId,
      input.modelConfigId,
      input.modelConfigVersionId,
      input.coachConfigId,
    ];
    if (identifiers.some((value) => !UUID_V4_PATTERN.test(value))) {
      throw new BadRequestException('Agent run identifiers must be UUID v4 values');
    }
    if (!UUID_V4_PATTERN.test(input.idempotencyKey)) {
      throw new BadRequestException('Agent run idempotencyKey must be a UUID v4 value');
    }
    if (!input.promptVersion || input.promptVersion.length > 50) {
      throw new BadRequestException('Agent run promptVersion is invalid');
    }
    this.validateSafeObject(input.modelSnapshot, 'modelSnapshot');
    this.validateSafeObject(input.coachConfigSnapshot, 'coachConfigSnapshot');
    const cards = input.matchedKnowledgeCards ?? [];
    if (!Array.isArray(cards) || cards.length > 3) {
      throw new BadRequestException('Agent run matchedKnowledgeCards cannot contain more than 3 items');
    }
    cards.forEach((card, index) => this.validateSafeValue(card, `matchedKnowledgeCards[${index}]`));
  }

  private validateFinishInput(input: FinishAgentRunInput): void {
    if (input.responseMessageId !== undefined && !UUID_V4_PATTERN.test(input.responseMessageId)) {
      throw new BadRequestException('Agent run responseMessageId must be a UUID v4 value');
    }
    for (const [name, value] of [
      ['inputTokens', input.inputTokens],
      ['outputTokens', input.outputTokens],
      ['durationMs', input.durationMs],
    ] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        throw new BadRequestException(`Agent run ${name} must be a non-negative integer`);
      }
    }
    if (input.estimatedCost !== undefined && (!Number.isFinite(Number(input.estimatedCost)) || Number(input.estimatedCost) < 0)) {
      throw new BadRequestException('Agent run estimatedCost must be non-negative');
    }
    if (input.providerRequestId !== undefined && input.providerRequestId.length > 150) {
      throw new BadRequestException('Agent run providerRequestId is too long');
    }
    if (input.resultJson !== undefined) this.validateSafeObject(input.resultJson, 'resultJson');
  }

  private validateFailureInput(input: FailAgentRunInput): void {
    if (!input.errorCode || input.errorCode.length > 80 || !input.errorMessage || input.errorMessage.length > 500) {
      throw new BadRequestException('Agent run error details are invalid');
    }
    if (SENSITIVE_KEY_PATTERN.test(input.errorMessage) || /stack trace|at \S+\(/i.test(input.errorMessage)) {
      throw new BadRequestException('Agent run errorMessage contains sensitive diagnostic data');
    }
    if (input.durationMs !== undefined && (!Number.isInteger(input.durationMs) || input.durationMs < 0)) {
      throw new BadRequestException('Agent run durationMs must be a non-negative integer');
    }
  }

  private normalizeErrorMessage(value: string): string {
    return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  }

  private validateSafeObject(value: Record<string, unknown>, path: string): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`${path} must be an object`);
    }
    Object.entries(value).forEach(([key, nested]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        throw new BadRequestException(`${path}.${key} contains sensitive data`);
      }
      this.validateSafeValue(nested, `${path}.${key}`);
    });
  }

  private validateSafeValue(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => this.validateSafeValue(item, `${path}[${index}]`));
    } else if (value && typeof value === 'object') {
      this.validateSafeObject(value as Record<string, unknown>, path);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505');
  }
}
