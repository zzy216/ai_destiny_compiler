import { DataSource } from 'typeorm';

import { databaseOptions } from '../src/database/database.config';
import { databaseEntities } from '../src/database/entities';
import { databaseMigrations } from '../src/database/migrations';

describe('database contract', () => {
  it('uses PostgreSQL without synchronize and registers every core entity', () => {
    expect(databaseOptions.type).toBe('postgres');
    expect(databaseOptions.synchronize).toBe(false);
    expect(databaseEntities).toHaveLength(17);

    const dataSource = new DataSource({
      ...databaseOptions,
      entities: databaseEntities,
      migrations: databaseMigrations,
    });

    expect(dataSource.options.entities).toHaveLength(17);
    expect(dataSource.options.migrations).toHaveLength(20);
  });

  it('registers the migration sequence defined by the database plan', () => {
    expect(databaseMigrations.map((migration) => migration.name)).toEqual([
      'CreateUsers1784200000001',
      'CreateUserProfiles1784200000002',
      'CreateAuthInvitations1784200000003',
      'CreateAuthSessions1784200000004',
      'CreateModelConfigs1784200000005',
      'CreateModelConfigVersions1784200000006',
      'AddModelCurrentVersionForeignKeys1784200000007',
      'CreateModelCredentials1784200000008',
      'CreateCoachConfigs1784200000009',
      'CreateKnowledgeCards1784200000010',
      'CreateGoals1784200000011',
      'CreateConversations1784200000012',
      'CreateMessages1784200000013',
      'CreateAgentRuns1784200000014',
      'AddMessageAgentRunForeignKeys1784200000015',
      'CreateActionCards1784200000016',
      'CreateExecutionRecords1784200000017',
      'CreateReviews1784200000018',
      'CreateMemories1784200000019',
      'AddPartialIndexesAndChecks1784200000020',
    ]);
  });
});
