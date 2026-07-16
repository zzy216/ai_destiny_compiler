import { DataSource } from 'typeorm';

import { databaseOptions } from '../src/database/database.config';
import { databaseEntities } from '../src/database/entities';
import { databaseMigrations } from '../src/database/migrations';

describe('database contract', () => {
  it('uses PostgreSQL without synchronize and registers every core entity', () => {
    expect(databaseOptions.type).toBe('postgres');
    expect(databaseOptions.synchronize).toBe(false);
    expect(databaseEntities).toHaveLength(19);

    const dataSource = new DataSource({
      ...databaseOptions,
      entities: databaseEntities,
      migrations: databaseMigrations,
    });

    expect(dataSource.options.entities).toHaveLength(19);
    expect(dataSource.options.migrations).toHaveLength(20);
  });

  it('registers the migration sequence defined by the database plan', () => {
    expect(databaseMigrations.map((migration) => migration.name)).toEqual([
      'CreateUsers001',
      'CreateUserProfiles002',
      'CreateAuthInvitations003',
      'CreateAuthSessions004',
      'CreateModelConfigs005',
      'CreateModelConfigVersions006',
      'AddModelCurrentVersionForeignKeys007',
      'CreateModelCredentials008',
      'CreateCoachConfigs009',
      'CreateKnowledgeCards010',
      'CreateGoals011',
      'CreateConversations012',
      'CreateMessages013',
      'CreateAgentRuns014',
      'AddMessageAgentRunForeignKeys015',
      'CreateActionCards016',
      'CreateExecutionRecords017',
      'CreateReviews018',
      'CreateMemories019',
      'AddPartialIndexesAndChecks020',
    ]);
  });
});
