import { DataSource } from 'typeorm';

import {
  SEED_DEFINITIONS,
  SeedEnvironmentError,
  seedDatabase,
  validateSeedEnvironment,
} from '../src/database/seed';

class InMemoryRepository {
  readonly records: Record<string, unknown>[] = [];

  async findOne(options: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
    return (
      this.records.find((record) =>
        Object.entries(options.where).every(([key, value]) => record[key] === value),
      ) ?? null
    );
  }

  async insert(record: Record<string, unknown>): Promise<void> {
    this.records.push({ ...record });
  }

  async update(
    criteria: Record<string, unknown>,
    changes: Record<string, unknown>,
  ): Promise<void> {
    const record = this.records.find((candidate) =>
      Object.entries(criteria).every(([key, value]) => candidate[key] === value),
    );
    if (record) Object.assign(record, changes);
  }
}

function createInMemoryDataSource(): {
  dataSource: DataSource;
  repositories: Map<Function, InMemoryRepository>;
} {
  const repositories = new Map<Function, InMemoryRepository>();
  const manager = {
    getRepository(entity: Function): InMemoryRepository {
      const repository = repositories.get(entity) ?? new InMemoryRepository();
      repositories.set(entity, repository);
      return repository;
    },
  };
  const dataSource = {
    runMigrations: jest.fn().mockResolvedValue([]),
    transaction: jest.fn(async (callback: (transactionManager: typeof manager) => Promise<void>) =>
      callback(manager),
    ),
  } as unknown as DataSource;
  return { dataSource, repositories };
}

describe('seed data', () => {
  const developmentEnvironment = {
    NODE_ENV: 'development',
    DATABASE_ENABLED: 'true',
    SEED_ADMIN_PASSWORD: 'admin-seed-password-123',
    SEED_TEST_USER_PASSWORD: 'test-seed-password-123',
  };

  it('rejects production and incomplete seed credentials', () => {
    expect(() => validateSeedEnvironment({ ...developmentEnvironment, NODE_ENV: 'production' }))
      .toThrow(SeedEnvironmentError);
    expect(() => validateSeedEnvironment({ ...developmentEnvironment, SEED_ADMIN_PASSWORD: '' }))
      .toThrow(SeedEnvironmentError);
    expect(() => validateSeedEnvironment({ ...developmentEnvironment, SEED_TEST_USER_PASSWORD: 'short' }))
      .toThrow(SeedEnvironmentError);
  });

  it('defines the required repeatable seed set without plaintext credentials', () => {
    expect(SEED_DEFINITIONS.users).toHaveLength(2);
    expect(SEED_DEFINITIONS.models).toHaveLength(2);
    expect(SEED_DEFINITIONS.coach.version).toBe(1);
    expect(SEED_DEFINITIONS.knowledgeCards).toHaveLength(12);
    expect(new Set(SEED_DEFINITIONS.knowledgeCards.map((card) => card.cardKey)).size).toBe(12);
    expect(JSON.stringify(SEED_DEFINITIONS)).not.toContain('password');
    expect(JSON.stringify(SEED_DEFINITIONS)).not.toContain('apiKey');
  });

  it('seeds the same records on repeated runs and stores password hashes', async () => {
    const { dataSource, repositories } = createInMemoryDataSource();

    await seedDatabase(dataSource, developmentEnvironment);
    await seedDatabase(dataSource, developmentEnvironment);

    expect(dataSource.runMigrations).toHaveBeenCalledTimes(2);
    expect(repositories.get(SEED_DEFINITIONS.entities.User)?.records).toHaveLength(2);
    expect(repositories.get(SEED_DEFINITIONS.entities.UserProfile)?.records).toHaveLength(2);
    expect(repositories.get(SEED_DEFINITIONS.entities.ModelConfig)?.records).toHaveLength(2);
    expect(repositories.get(SEED_DEFINITIONS.entities.ModelConfigVersion)?.records).toHaveLength(2);
    expect(repositories.get(SEED_DEFINITIONS.entities.CoachConfig)?.records).toHaveLength(1);
    expect(repositories.get(SEED_DEFINITIONS.entities.KnowledgeCard)?.records).toHaveLength(12);
    expect(repositories.get(SEED_DEFINITIONS.entities.ModelCredential)?.records ?? []).toHaveLength(0);

    const users = repositories.get(SEED_DEFINITIONS.entities.User)?.records ?? [];
    expect(users.every((user) => typeof user.passwordHash === 'string' && user.passwordHash.startsWith('$argon2id$')))
      .toBe(true);
    expect(JSON.stringify(users)).not.toContain(developmentEnvironment.SEED_ADMIN_PASSWORD);
    expect(JSON.stringify(users)).not.toContain(developmentEnvironment.SEED_TEST_USER_PASSWORD);
  });
});
