import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ActionCard, CoachConfig, Conversation, KnowledgeCard, Message } from '../src/database/entities';
import { AgentRunsService } from '../src/agent-runs/agent-runs.service';
import { ModelsService, type PublishedModelRuntime } from '../src/models/models.service';
import {
  ConversationsService,
  type CreateConversationInput,
  type SendMessageInput,
} from '../src/conversations/conversations.service';

const USER_ID = '00000000-0000-4000-8000-000000000002';
const MODEL_ID = '00000000-0000-4000-8000-000000000102';
const MODEL_VERSION_ID = '00000000-0000-4000-8000-000000000202';
const COACH_ID = '00000000-0000-4000-8000-000000000301';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000601';
const REQUEST_MESSAGE_ID = '00000000-0000-4000-8000-000000000602';
const RUN_ID = '00000000-0000-4000-8000-000000000603';

function repository<T extends object>() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn((value: Partial<T>) => value),
    save: jest.fn(async (value: T) => value),
    update: jest.fn(),
  };
}

function createService() {
  const conversations = repository<Conversation>();
  const messages = repository<Message>();
  const actionCards = repository<ActionCard>();
  const coaches = repository<CoachConfig>();
  const knowledgeCards = repository<KnowledgeCard>();
  const runtime: PublishedModelRuntime = {
    modelConfigId: MODEL_ID,
    modelConfigVersionId: MODEL_VERSION_ID,
    snapshot: {
      displayName: 'Ollama 本地模型',
      ownerType: 'system',
      modelType: 'local',
      protocol: 'ollama',
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      modelName: 'llama3.2',
      version: 1,
      supportsStream: true,
      supportsStructuredOutput: true,
    },
    complete: jest.fn(async () => ({
      content: JSON.stringify({
        diagnosis: '当前最大阻力是任务过大。',
        assumptions: ['用户希望今天开始行动'],
        nextActions: [{
          title: '写出最小交付物',
          durationMinutes: 30,
          deliverable: '一页行动草稿',
          completionCriteria: ['草稿可被他人阅读'],
          stopDoing: ['继续收集无关资料'],
        }],
        followUpQuestion: '你准备何时开始？',
      }),
      providerRequestId: 'provider-request-1',
      usage: { inputTokens: 12, outputTokens: 34 },
    })),
  };
  const models = { getPublishedModelRuntime: jest.fn(async () => runtime) } as unknown as ModelsService;
  const agentRuns = {
    findByIdempotencyKey: jest.fn(async () => null),
    startRun: jest.fn(async () => ({ id: RUN_ID, status: 'running' })),
    succeedRun: jest.fn(async (_id: string, _userId: string, value: Record<string, unknown>) => ({ id: RUN_ID, ...value, status: 'succeeded' })),
    failRun: jest.fn(),
  } as unknown as AgentRunsService;
  const service = new ConversationsService(
    conversations as never,
    messages as never,
    actionCards as never,
    coaches as never,
    knowledgeCards as never,
    models,
    agentRuns,
  );
  return { service, conversations, messages, actionCards, coaches, knowledgeCards, models, agentRuns, runtime };
}

describe('ConversationsService', () => {
  it('creates a conversation with the published model snapshot', async () => {
    const { service, conversations, models } = createService();
    conversations.save.mockImplementation(async (value: Conversation) => value);

    const input: CreateConversationInput = { modelConfigId: MODEL_ID, title: '职业选择' };
    const result = await service.createConversation(input, USER_ID);

    expect(models.getPublishedModelRuntime).toHaveBeenCalledWith(MODEL_ID, USER_ID);
    expect(conversations.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      modelConfigId: MODEL_ID,
      modelConfigVersionId: MODEL_VERSION_ID,
      modelSnapshot: expect.not.objectContaining({ apiKey: expect.anything() }),
    }));
    expect(result).toMatchObject({ modelConfigId: MODEL_ID, modelConfigVersionId: MODEL_VERSION_ID });
  });

  it('runs a message once, validates structured diagnosis, and persists an action card', async () => {
    const { service, conversations, messages, actionCards, coaches, knowledgeCards, agentRuns, models, runtime } = createService();
    conversations.findOne.mockResolvedValue({
      id: CONVERSATION_ID,
      userId: USER_ID,
      goalId: null,
      modelConfigId: MODEL_ID,
      modelConfigVersionId: MODEL_VERSION_ID,
      modelSnapshot: runtime.snapshot,
      status: 'active',
    });
    messages.findOne.mockResolvedValue(null);
    messages.find.mockResolvedValue([]);
    coaches.findOne.mockResolvedValue({
      id: COACH_ID,
      version: 1,
      status: 'published',
      systemPrompt: '先澄清事实，再给出一个行动。',
      outputSchema: { diagnosis: 'string', nextActions: 'object[]' },
    });
    knowledgeCards.find.mockResolvedValue([{ id: 'card-1', cardKey: 'mvp-02', version: 1, status: 'published', problemSignals: ['任务过大'] }]);

    const input: SendMessageInput = {
      content: '我有一个太大的项目，不知道怎么开始。',
      idempotencyKey: '6c5d20e5-2b4c-4d1a-8a75-0e7cf31f9c4c',
    };
    const result = await service.executeMessage(CONVERSATION_ID, input, USER_ID);

    expect(agentRuns.startRun).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      conversationId: CONVERSATION_ID,
      requestMessageId: expect.any(String),
      modelConfigVersionId: MODEL_VERSION_ID,
      coachConfigId: COACH_ID,
      matchedKnowledgeCards: expect.any(Array),
    }));
    expect(runtime.complete).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ role: 'system' }),
      expect.objectContaining({ role: 'user', content: input.content }),
    ]));
    expect(models.getPublishedModelRuntime).toHaveBeenCalledWith(MODEL_ID, USER_ID, MODEL_VERSION_ID);
    expect(actionCards.save).toHaveBeenCalledWith(expect.objectContaining({
      agentRunId: RUN_ID,
      userId: USER_ID,
      title: '写出最小交付物',
      status: 'pending',
    }));
    expect(agentRuns.succeedRun).toHaveBeenCalledWith(RUN_ID, USER_ID, expect.objectContaining({
      responseMessageId: expect.any(String),
      resultJson: expect.objectContaining({ diagnosis: expect.any(String) }),
    }));
    expect(result.events.map((event) => event.event)).toEqual([
      'run.started',
      'message.delta',
      'message.completed',
    ]);
    expect(result.events.at(-1)).toMatchObject({
      event: 'message.completed',
      data: { content: expect.stringContaining('当前最大阻力是任务过大') },
    });
  });

  it('reuses the existing run for a retried idempotency key', async () => {
    const { service, conversations, agentRuns } = createService();
    conversations.findOne.mockResolvedValue({ id: CONVERSATION_ID, userId: USER_ID, status: 'active', modelConfigId: MODEL_ID });
    (agentRuns.findByIdempotencyKey as jest.Mock).mockResolvedValue({ id: RUN_ID, status: 'succeeded', responseMessageId: '00000000-0000-4000-8000-000000000604' });

    const result = await service.executeMessage(CONVERSATION_ID, {
      content: '已发送',
      idempotencyKey: '6c5d20e5-2b4c-4d1a-8a75-0e7cf31f9c4c',
    }, USER_ID);

    expect(agentRuns.startRun).not.toHaveBeenCalled();
    expect(result.events[0]).toMatchObject({ event: 'run.started', data: { agentRunId: RUN_ID } });
  });

  it('fails safely when the model does not return the required diagnosis shape', async () => {
    const { service, conversations, messages, coaches, runtime, agentRuns } = createService();
    conversations.findOne.mockResolvedValue({ id: CONVERSATION_ID, userId: USER_ID, status: 'active', modelConfigId: MODEL_ID, modelConfigVersionId: MODEL_VERSION_ID, modelSnapshot: runtime.snapshot });
    messages.findOne.mockResolvedValue(null);
    messages.find.mockResolvedValue([]);
    coaches.findOne.mockResolvedValue({ id: COACH_ID, version: 1, status: 'published', systemPrompt: 'coach', outputSchema: {} });
    (runtime.complete as jest.Mock).mockResolvedValue({ content: '{"diagnosis": 1}', providerRequestId: null, usage: { inputTokens: null, outputTokens: null } });

    const result = await service.executeMessage(CONVERSATION_ID, {
      content: '请给建议',
      idempotencyKey: '7c5d20e5-2b4c-4d1a-8a75-0e7cf31f9c4c',
    }, USER_ID);

    expect(agentRuns.failRun).toHaveBeenCalledWith(RUN_ID, USER_ID, expect.objectContaining({ errorCode: 'INVALID_DIAGNOSTIC_OUTPUT' }));
    expect(result.events.at(-1)).toMatchObject({ event: 'run.failed' });
  });

  it('rejects conversations owned by another user', async () => {
    const { service, conversations } = createService();
    conversations.findOne.mockResolvedValue({ id: CONVERSATION_ID, userId: '00000000-0000-4000-8000-000000000099' });

    await expect(service.executeMessage(CONVERSATION_ID, {
      content: '越权',
      idempotencyKey: '8c5d20e5-2b4c-4d1a-8a75-0e7cf31f9c4c',
    }, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid message input before calling dependencies', async () => {
    const { service, conversations } = createService();
    await expect(service.executeMessage(CONVERSATION_ID, { content: ' ', idempotencyKey: 'bad' }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(conversations.findOne).not.toHaveBeenCalled();
  });

  it('lists conversations and messages with default and explicit pagination', async () => {
    const { service, conversations, messages } = createService();
    conversations.find.mockResolvedValue([{ id: CONVERSATION_ID }]);
    conversations.count.mockResolvedValue(1);
    messages.find.mockResolvedValue([{ id: REQUEST_MESSAGE_ID }]);
    messages.count.mockResolvedValue(1);
    conversations.findOne.mockResolvedValue({ id: CONVERSATION_ID, userId: USER_ID, status: 'active' });

    await expect(service.listConversations({}, USER_ID)).resolves.toMatchObject({ meta: { page: 1, perPage: 20, total: 1 } });
    await expect(service.listMessages(CONVERSATION_ID, { page: 2, perPage: 10 }, USER_ID)).resolves.toMatchObject({ meta: { page: 2, perPage: 10, totalPages: 1 } });
    expect(conversations.find).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
    expect(messages.find).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
  });

  it('supports custom model snapshots and rejects invalid conversation metadata', async () => {
    const { service, models, conversations } = createService();
    (models.getPublishedModelRuntime as jest.Mock).mockResolvedValueOnce({
      modelConfigId: MODEL_ID,
      modelConfigVersionId: MODEL_VERSION_ID,
      snapshot: { ownerType: 'user' },
      complete: jest.fn(),
    });
    await expect(service.createConversation({ modelConfigId: MODEL_ID })).resolves.toMatchObject({ modelSource: 'custom' });
    await expect(service.createConversation({ modelConfigId: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createConversation({ modelConfigId: MODEL_ID, title: 'x'.repeat(151) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createConversation({ modelConfigId: MODEL_ID, inheritedSummary: 'x'.repeat(4001) })).rejects.toBeInstanceOf(BadRequestException);
    expect(conversations.save).toHaveBeenCalled();
  });

  it('rejects an archived conversation and a missing published coach', async () => {
    const { service, conversations, coaches } = createService();
    conversations.findOne.mockResolvedValue({ id: CONVERSATION_ID, userId: USER_ID, status: 'archived' });
    await expect(service.executeMessage(CONVERSATION_ID, {
      content: '无法发送',
      idempotencyKey: '9c5d20e5-2b4c-4d1a-8a75-0e7cf31f9c4c',
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);

    conversations.findOne.mockResolvedValue({ id: CONVERSATION_ID, userId: USER_ID, status: 'active', modelConfigId: MODEL_ID });
    coaches.findOne.mockResolvedValue(null);
    await expect(service.executeMessage(CONVERSATION_ID, {
      content: '没有教练',
      idempotencyKey: 'ac5d20e5-2b4c-4d1a-8a75-0e7cf31f9c4c',
    }, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records safe model failures and exposes the same result through the stream generator', async () => {
    const { service, conversations, messages, coaches, runtime, agentRuns } = createService();
    conversations.findOne.mockResolvedValue({ id: CONVERSATION_ID, userId: USER_ID, status: 'active', modelConfigId: MODEL_ID, modelConfigVersionId: MODEL_VERSION_ID, modelSnapshot: runtime.snapshot });
    messages.find.mockResolvedValue([]);
    messages.findOne.mockResolvedValue(null);
    coaches.findOne.mockResolvedValue({ id: COACH_ID, version: 1, status: 'published', systemPrompt: 'coach', outputSchema: {} });
    (runtime.complete as jest.Mock).mockRejectedValue(new Error('provider secret should not leak'));

    const events = [];
    for await (const event of service.streamMessage(CONVERSATION_ID, {
      content: '模型失败',
      idempotencyKey: 'bc5d20e5-2b4c-4d1a-8a75-0e7cf31f9c4c',
    }, USER_ID)) events.push(event);
    expect(agentRuns.failRun).toHaveBeenCalledWith(RUN_ID, USER_ID, expect.objectContaining({
      errorCode: 'MODEL_EXECUTION_FAILED',
      errorMessage: 'Model execution failed',
    }));
    expect(events.at(-1)).toMatchObject({ event: 'run.failed' });
  });
});
