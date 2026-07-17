import { ConversationsController } from '../src/conversations/conversations.controller';

const CONVERSATION_ID = '00000000-0000-4000-8000-000000000601';
const USER_MESSAGE = { content: '下一步是什么？', idempotencyKey: 'cc5d20e5-2b4c-4d1a-8a75-000000000001' };

describe('ConversationsController', () => {
  it('delegates conversation and message reads to the service', async () => {
    const service = {
      createConversation: jest.fn(async () => ({ id: CONVERSATION_ID })),
      listConversations: jest.fn(async () => ({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } })),
      listMessages: jest.fn(async () => ({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } })),
    };
    const controller = new ConversationsController(service as never);

    await expect(controller.create({ modelConfigId: CONVERSATION_ID })).resolves.toMatchObject({ data: { id: CONVERSATION_ID } });
    await expect(controller.list({})).resolves.toMatchObject({ meta: { total: 0 } });
    await expect(controller.listMessages(CONVERSATION_ID, {})).resolves.toMatchObject({ meta: { total: 0 } });
    expect(service.createConversation).toHaveBeenCalled();
    expect(service.listConversations).toHaveBeenCalled();
    expect(service.listMessages).toHaveBeenCalled();
  });

  it('writes the Agent stream as SSE and closes the response', async () => {
    const service = {
      streamMessage: async function* () {
        yield { event: 'run.started', data: { agentRunId: CONVERSATION_ID } } as const;
        yield { event: 'message.completed', data: { messageId: CONVERSATION_ID } } as const;
      },
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    const controller = new ConversationsController(service as never);

    await controller.sendMessage(CONVERSATION_ID, USER_MESSAGE, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(response.write).toHaveBeenNthCalledWith(1, expect.stringContaining('event: run.started'));
    expect(response.write).toHaveBeenNthCalledWith(2, expect.stringContaining('event: message.completed'));
    expect(response.end).toHaveBeenCalledTimes(1);
  });
});
