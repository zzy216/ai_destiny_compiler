import { BadRequestException, NotFoundException, NotImplementedException } from '@nestjs/common';
import type { ObjectLiteral, Repository } from 'typeorm';

import { ActionsService } from '../src/actions/actions.service';
import {
  ActionCardStatus,
  ExecutionResult,
  MemoryCategory,
  ReviewType,
} from '../src/actions/actions.dto';
import {
  ActionCard,
  ExecutionRecord,
  Memory,
  Review,
} from '../src/database/entities';

const USER_ID = '00000000-0000-4000-8000-000000000002';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000099';
const ACTION_CARD_ID = '00000000-0000-4000-8000-000000000701';
const REVIEW_ID = '00000000-0000-4000-8000-000000000801';
const MEMORY_ID = '00000000-0000-4000-8000-000000000901';

function repository<T extends ObjectLiteral>(overrides: Record<string, jest.Mock> = {}): Repository<T> {
  return {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    update: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as Repository<T>;
}

function createService(overrides: {
  actionCards?: Record<string, jest.Mock>;
  executionRecords?: Record<string, jest.Mock>;
  reviews?: Record<string, jest.Mock>;
  memories?: Record<string, jest.Mock>;
} = {}) {
  const actionCards = repository<ActionCard>(overrides.actionCards);
  const executionRecords = repository<ExecutionRecord>(overrides.executionRecords);
  const reviews = repository<Review>(overrides.reviews);
  const memories = repository<Memory>(overrides.memories);
  const service = new ActionsService(actionCards, executionRecords, reviews, memories);
  return { service, actionCards, executionRecords, reviews, memories };
}

describe('ActionsService', () => {
  it('lists action cards for the current user with status pagination', async () => {
    const action = { id: ACTION_CARD_ID, userId: USER_ID, status: ActionCardStatus.Pending };
    const { service, actionCards } = createService({
      actionCards: { findAndCount: jest.fn().mockResolvedValue([[action], 21]) },
    });

    const result = await service.listActionCards({ status: ActionCardStatus.Pending, page: 2, perPage: 10 }, USER_ID);

    expect(actionCards.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER_ID, status: ActionCardStatus.Pending },
      skip: 10,
      take: 10,
    }));
    expect(result).toMatchObject({ data: [action], meta: { page: 2, perPage: 10, total: 21, totalPages: 3 } });
  });

  it('lists action cards with default filters and the development user fallback', async () => {
    const action = { id: ACTION_CARD_ID, userId: USER_ID, status: ActionCardStatus.Pending };
    const { service, actionCards } = createService({
      actionCards: { findAndCount: jest.fn().mockResolvedValue([[action], 1]) },
    });

    await expect(service.listActionCards()).resolves.toMatchObject({
      data: [action],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    expect(actionCards.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER_ID },
      skip: 0,
      take: 20,
    }));
  });

  it('submits execution feedback and marks a completed action card', async () => {
    const { service, actionCards, executionRecords } = createService({
      actionCards: {
        findOne: jest.fn().mockResolvedValue({
          id: ACTION_CARD_ID,
          userId: USER_ID,
          status: ActionCardStatus.Pending,
        }),
      },
    });

    const result = await service.submitExecutionRecord(ACTION_CARD_ID, {
      result: ExecutionResult.Completed,
      note: '已经交付一页草稿',
      evidence: { url: 'https://example.test/draft' },
    }, USER_ID);

    expect(executionRecords.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      actionCardId: ACTION_CARD_ID,
      result: ExecutionResult.Completed,
      note: '已经交付一页草稿',
      evidence: { url: 'https://example.test/draft' },
    }));
    expect(actionCards.update).toHaveBeenCalledWith(ACTION_CARD_ID, expect.objectContaining({
      status: ActionCardStatus.Completed,
      completedAt: expect.any(Date),
    }));
    expect(result.actionCardStatus).toBe(ActionCardStatus.Completed);
  });

  it('lists execution records after confirming action card ownership', async () => {
    const execution = { id: 'record-1', actionCardId: ACTION_CARD_ID, userId: USER_ID };
    const { service, actionCards, executionRecords } = createService({
      actionCards: {
        findOne: jest.fn().mockResolvedValue({
          id: ACTION_CARD_ID,
          userId: USER_ID,
          status: ActionCardStatus.PartiallyCompleted,
        }),
      },
      executionRecords: {
        findAndCount: jest.fn().mockResolvedValue([[execution], 1]),
      },
    });

    const result = await service.listExecutionRecords(ACTION_CARD_ID, {}, USER_ID);

    expect(actionCards.findOne).toHaveBeenCalledWith({ where: { id: ACTION_CARD_ID, userId: USER_ID } });
    expect(executionRecords.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { actionCardId: ACTION_CARD_ID, userId: USER_ID },
      skip: 0,
      take: 20,
    }));
    expect(result).toMatchObject({ data: [execution], meta: { page: 1, perPage: 20, total: 1, totalPages: 1 } });
  });

  it('maps non-completed feedback results without a completed timestamp', async () => {
    const { service, actionCards } = createService({
      actionCards: {
        findOne: jest.fn().mockResolvedValue({
          id: ACTION_CARD_ID,
          userId: USER_ID,
          status: ActionCardStatus.InProgress,
        }),
      },
    });

    const partial = await service.submitExecutionRecord(ACTION_CARD_ID, {
      result: ExecutionResult.PartiallyCompleted,
    }, USER_ID);
    const notCompleted = await service.submitExecutionRecord(ACTION_CARD_ID, {
      result: ExecutionResult.NotCompleted,
      obstacleType: 'execution' as never,
    }, USER_ID);

    expect(partial.actionCardStatus).toBe(ActionCardStatus.PartiallyCompleted);
    expect(notCompleted.actionCardStatus).toBe(ActionCardStatus.NotCompleted);
    expect(actionCards.update).toHaveBeenLastCalledWith(ACTION_CARD_ID, expect.objectContaining({
      status: ActionCardStatus.NotCompleted,
      completedAt: null,
    }));
  });

  it('rejects unsupported execution result values defensively', async () => {
    const { service, actionCards, executionRecords } = createService({
      actionCards: {
        findOne: jest.fn().mockResolvedValue({
          id: ACTION_CARD_ID,
          userId: USER_ID,
          status: ActionCardStatus.Pending,
        }),
      },
    });

    await expect(service.submitExecutionRecord(ACTION_CARD_ID, {
      result: 'skipped' as ExecutionResult,
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);

    expect(executionRecords.save).not.toHaveBeenCalled();
  });

  it('rejects feedback for another user action card and abandoned action cards', async () => {
    const { service, actionCards } = createService();

    (actionCards.findOne as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.submitExecutionRecord(ACTION_CARD_ID, { result: ExecutionResult.Completed }, USER_ID))
      .rejects.toBeInstanceOf(NotFoundException);

    (actionCards.findOne as jest.Mock).mockResolvedValueOnce({
      id: ACTION_CARD_ID,
      userId: USER_ID,
      status: ActionCardStatus.Abandoned,
    });
    await expect(service.submitExecutionRecord(ACTION_CARD_ID, { result: ExecutionResult.Completed }, USER_ID))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an action review only for the current user action card', async () => {
    const { service, actionCards, reviews } = createService({
      actionCards: {
        findOne: jest.fn().mockResolvedValue({
          id: ACTION_CARD_ID,
          userId: USER_ID,
          status: ActionCardStatus.Completed,
        }),
      },
    });

    await service.createReview({
      reviewType: ReviewType.Action,
      actionCardId: ACTION_CARD_ID,
      summary: '完成了最小草稿，但评审反馈还没收集。',
      progress: { completedActions: 1 },
      frictions: ['评审人时间不确定'],
      nextFocus: '约定评审时间',
    }, USER_ID);

    expect(actionCards.findOne).toHaveBeenCalledWith({ where: { id: ACTION_CARD_ID, userId: USER_ID } });
    expect(reviews.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      reviewType: ReviewType.Action,
      actionCardId: ACTION_CARD_ID,
      generatedByRunId: null,
    }));
  });

  it('lists reviews with and without a review type filter', async () => {
    const review = { id: REVIEW_ID, userId: USER_ID, reviewType: ReviewType.Daily };
    const { service, reviews } = createService({
      reviews: { findAndCount: jest.fn().mockResolvedValue([[review], 1]) },
    });

    await expect(service.listReviews({}, USER_ID)).resolves.toMatchObject({
      data: [review],
      meta: { page: 1, perPage: 20, total: 1 },
    });
    await service.listReviews({ reviewType: ReviewType.Daily, page: 3, perPage: 5 }, USER_ID);

    expect(reviews.findAndCount).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { userId: USER_ID },
      skip: 0,
      take: 20,
    }));
    expect(reviews.findAndCount).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { userId: USER_ID, reviewType: ReviewType.Daily },
      skip: 10,
      take: 5,
    }));
  });

  it('creates a daily review with default optional fields', async () => {
    const { service, reviews, actionCards } = createService();

    await service.createReview({
      reviewType: ReviewType.Daily,
      summary: '今天完成了一次最小行动。',
    }, USER_ID);

    expect(actionCards.findOne).not.toHaveBeenCalled();
    expect(reviews.save).toHaveBeenCalledWith(expect.objectContaining({
      actionCardId: null,
      periodStart: null,
      periodEnd: null,
      progress: {},
      frictions: [],
      nextFocus: null,
    }));
  });

  it('rejects invalid action review references', async () => {
    const { service, actionCards } = createService({
      actionCards: { findOne: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.createReview({
      reviewType: ReviewType.Action,
      actionCardId: ACTION_CARD_ID,
      summary: '越权复盘',
    }, OTHER_USER_ID)).rejects.toBeInstanceOf(NotFoundException);

    await expect(service.createReview({
      reviewType: ReviewType.Action,
      summary: '缺少行动卡',
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates, lists, and deletes memories for the current user', async () => {
    const memory = { id: MEMORY_ID, userId: USER_ID, category: MemoryCategory.Preference, content: '偏好早上处理深度工作' };
    const { service, memories } = createService({
      memories: {
        findAndCount: jest.fn().mockResolvedValue([[memory], 1]),
        findOne: jest.fn().mockResolvedValue(memory),
      },
    });

    await service.createMemory({
      category: MemoryCategory.Preference,
      content: '偏好早上处理深度工作',
      confidence: 0.8,
      confirmedByUser: true,
    }, USER_ID);
    const list = await service.listMemories({ category: MemoryCategory.Preference }, USER_ID);
    await service.deleteMemory(MEMORY_ID, USER_ID);

    expect(memories.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      category: MemoryCategory.Preference,
      confidence: '0.800',
      confirmedByUser: true,
    }));
    expect(list.data).toEqual([memory]);
    expect(memories.delete).toHaveBeenCalledWith({ id: MEMORY_ID, userId: USER_ID });
  });

  it('lists all memories and creates an unconfirmed memory with default fields', async () => {
    const memory = { id: MEMORY_ID, userId: USER_ID, category: MemoryCategory.Context, content: '最近在准备内测' };
    const { service, memories } = createService({
      memories: { findAndCount: jest.fn().mockResolvedValue([[memory], 1]) },
    });

    await service.createMemory({
      category: MemoryCategory.Context,
      content: '最近在准备内测',
    }, USER_ID);
    await service.listMemories({}, USER_ID);

    expect(memories.save).toHaveBeenCalledWith(expect.objectContaining({
      sourceConversationId: null,
      sourceMessageId: null,
      confidence: null,
      confirmedByUser: false,
    }));
    expect(memories.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER_ID },
      skip: 0,
      take: 20,
    }));
  });

  it('rejects deleting another user memory', async () => {
    const { service, memories } = createService({
      memories: { findOne: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.deleteMemory(MEMORY_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates UUID values and memory confidence in service entry points', async () => {
    const { service } = createService();

    await expect(service.getActionCard('bad-id', USER_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createMemory({
      category: MemoryCategory.Pattern,
      content: '晚上容易拖延',
      confidence: 1.2,
    }, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails clearly when persistence repositories are not configured', async () => {
    const service = new ActionsService();

    await expect(service.listActionCards()).rejects.toBeInstanceOf(NotImplementedException);
    await expect(service.createReview({
      reviewType: ReviewType.Daily,
      summary: '无仓库时失败',
    }, USER_ID)).rejects.toBeInstanceOf(NotImplementedException);
    await expect(service.createMemory({
      category: MemoryCategory.Context,
      content: '无仓库时失败',
    }, USER_ID)).rejects.toBeInstanceOf(NotImplementedException);
  });
});
