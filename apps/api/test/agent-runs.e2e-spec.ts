import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { AgentRun } from '../src/database/entities';
import {
  AgentRunsService,
  type CreateAgentRunInput,
  type FinishAgentRunInput,
} from '../src/agent-runs/agent-runs.service';

const USER_ID = '00000000-0000-4000-8000-000000000002';
const RUN_ID = '00000000-0000-4000-8000-000000000101';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000201';
const REQUEST_MESSAGE_ID = '00000000-0000-4000-8000-000000000301';
const MODEL_ID = '00000000-0000-4000-8000-000000000401';
const MODEL_VERSION_ID = '00000000-0000-4000-8000-000000000402';
const COACH_ID = '00000000-0000-4000-8000-000000000501';

const input: CreateAgentRunInput = {
  userId: USER_ID,
  conversationId: CONVERSATION_ID,
  requestMessageId: REQUEST_MESSAGE_ID,
  idempotencyKey: '6c5d20e5-2b4c-4d1a-8a75-0e7cf31f9c4c',
  modelConfigId: MODEL_ID,
  modelConfigVersionId: MODEL_VERSION_ID,
  modelSnapshot: { modelName: 'gpt-test', protocol: 'openai_compatible' },
  coachConfigId: COACH_ID,
  coachConfigSnapshot: { name: '测试教练', version: 1 },
  matchedKnowledgeCards: [{ id: 'card-1', version: 1, name: '行动优先' }],
  promptVersion: 'mvp-0.1',
};

function createRepository() {
  return {
    findOne: jest.fn(),
    create: jest.fn((value: Partial<AgentRun>) => value),
    save: jest.fn(async (value: AgentRun) => value),
    update: jest.fn(),
  };
}

describe('AgentRunsService', () => {
  it('creates a running run and reuses it for the same user idempotency key', async () => {
    const repository = createRepository();
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: RUN_ID, ...input, status: 'running' });
    const service = new AgentRunsService(repository as never);

    const created = await service.startRun(input);
    const retried = await service.startRun(input);

    expect(created).toMatchObject({ id: expect.any(String), status: 'running', ...input });
    expect(retried).toMatchObject({ id: RUN_ID, status: 'running' });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }));
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.findOne).toHaveBeenLastCalledWith({
      where: { userId: USER_ID, idempotencyKey: input.idempotencyKey },
    });
  });

  it('rejects invalid idempotency keys, oversized knowledge matches, and sensitive snapshots', async () => {
    const repository = createRepository();
    const service = new AgentRunsService(repository as never);

    await expect(service.startRun({ ...input, idempotencyKey: 'retry' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.startRun({ ...input, matchedKnowledgeCards: Array.from({ length: 4 }, () => ({ id: 'x' })) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.startRun({ ...input, modelSnapshot: { apiKey: 'should-not-be-stored' } })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('finishes a running run and rejects updates after it reaches a terminal state', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({ id: RUN_ID, userId: USER_ID, status: 'running' });
    const service = new AgentRunsService(repository as never);
    const result: FinishAgentRunInput = {
      responseMessageId: '00000000-0000-4000-8000-000000000302',
      inputTokens: 12,
      outputTokens: 34,
      estimatedCost: '0.001200',
      providerRequestId: 'provider-request-1',
      durationMs: 456,
      resultJson: { diagnosis: '先做一个动作' },
    };

    await service.succeedRun(RUN_ID, USER_ID, result);
    expect(repository.update).toHaveBeenCalledWith(RUN_ID, expect.objectContaining({ status: 'succeeded', ...result, completedAt: expect.any(Date) }));

    repository.findOne.mockResolvedValue({ id: RUN_ID, userId: USER_ID, status: 'succeeded' });
    await expect(service.failRun(RUN_ID, USER_ID, { errorCode: 'MODEL_TIMEOUT', errorMessage: '请求超时' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('records failed, timeout, and cancelled terminal states with safe errors', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({ id: RUN_ID, userId: USER_ID, status: 'running' });
    const service = new AgentRunsService(repository as never);

    await service.failRun(RUN_ID, USER_ID, { errorCode: 'MODEL_ERROR', errorMessage: 'provider failed' });
    await service.timeoutRun(RUN_ID, USER_ID, { errorCode: 'TIMEOUT', errorMessage: 'timeout' });
    await service.cancelRun(RUN_ID, USER_ID);

    expect(repository.update).toHaveBeenNthCalledWith(1, RUN_ID, expect.objectContaining({ status: 'failed', errorCode: 'MODEL_ERROR' }));
    expect(repository.update).toHaveBeenNthCalledWith(2, RUN_ID, expect.objectContaining({ status: 'timeout', errorCode: 'TIMEOUT' }));
    expect(repository.update).toHaveBeenNthCalledWith(3, RUN_ID, expect.objectContaining({ status: 'cancelled', completedAt: expect.any(Date) }));
  });

  it('requires ownership when updating a run and reports missing runs', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue(null);
    const service = new AgentRunsService(repository as never);

    await expect(service.cancelRun(RUN_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    repository.findOne.mockResolvedValue({ id: RUN_ID, userId: 'another-user', status: 'running' });
    await expect(service.cancelRun(RUN_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
