import type { Repository } from 'typeorm';

import { AgentRun, CoachConfig, KnowledgeCard } from '../src/database/entities';
import { AdminManagementService } from '../src/admin/admin-management.service';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';

function repository<T>(overrides: Record<string, jest.Mock> = {}): Repository<T> {
  return {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    update: jest.fn(),
    ...overrides,
  } as unknown as Repository<T>;
}

function createService(overrides: {
  coaches?: Record<string, jest.Mock>;
  cards?: Record<string, jest.Mock>;
  runs?: Record<string, jest.Mock>;
} = {}) {
  return new AdminManagementService(
    repository<CoachConfig>(overrides.coaches),
    repository<KnowledgeCard>(overrides.cards),
    repository<AgentRun>(overrides.runs),
  );
}

describe('AdminManagementService', () => {
  it('lists coach configs with pagination metadata', async () => {
    const findAndCount = jest.fn().mockResolvedValue([
      [{ id: 'coach-1', version: 2, name: '默认教练', status: 'draft' }],
      21,
    ]);
    const service = createService({ coaches: { findAndCount } });

    const result = await service.listCoachConfigs({ page: 2, perPage: 10 });

    expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    expect(result.meta).toEqual({ page: 2, perPage: 10, total: 21, totalPages: 3 });
    expect(result.data[0]).toMatchObject({ name: '默认教练', status: 'draft' });
  });

  it('publishes one coach config and disables the previous published version', async () => {
    const update = jest.fn();
    const findOne = jest.fn().mockResolvedValue({ id: 'coach-2', version: 2, status: 'draft' });
    const service = createService({ coaches: { update, findOne } });

    await service.publishCoachConfig('coach-2', ADMIN_ID);

    expect(update).toHaveBeenNthCalledWith(1, { status: 'published' }, { status: 'disabled' });
    expect(update).toHaveBeenNthCalledWith(2, 'coach-2', expect.objectContaining({ status: 'published', publishedAt: expect.any(Date) }));
  });

  it('maps knowledge cards and agent runs to safe admin summaries', async () => {
    const service = createService({
      cards: {
        findAndCount: jest.fn().mockResolvedValue([[{ id: 'card-1', name: '目标澄清', category: '目标', status: 'published', tags: ['目标'] }], 1]),
      },
      runs: {
        findAndCount: jest.fn().mockResolvedValue([[
          {
            id: 'run-1', status: 'succeeded', modelSnapshot: { modelName: 'llama3.2', apiKey: 'secret' },
            inputTokens: 10, outputTokens: 20, durationMs: 1000, startedAt: new Date('2026-07-18T08:00:00.000Z'),
            resultJson: { diagnosis: 'private' },
          },
        ], 1]),
      },
    });

    const cards = await service.listKnowledgeCards({ page: 1, perPage: 20 });
    const runs = await service.listAgentRuns({ page: 1, perPage: 20 });

    expect(cards.data[0]).toMatchObject({ name: '目标澄清', category: '目标' });
    expect(runs.data[0]).toMatchObject({ modelName: 'llama3.2', inputTokens: 10 });
    expect(JSON.stringify(runs.data[0])).not.toContain('private');
    expect(JSON.stringify(runs.data[0])).not.toContain('secret');
  });
});
