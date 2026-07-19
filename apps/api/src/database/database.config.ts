import type { DataSourceOptions } from 'typeorm';

import { databaseEntities } from './entities';
import { databaseMigrations } from './migrations';
import { SnakeNamingStrategy } from './snake-naming.strategy';

function envBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

export const databaseOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'destiny_compiler',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'destiny_compiler',
  schema: process.env.DB_SCHEMA ?? 'public',
  ssl: envBoolean(process.env.DB_SSL) ? { rejectUnauthorized: false } : false,
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'typeorm_migrations',
  entities: databaseEntities,
  migrations: databaseMigrations,
  namingStrategy: new SnakeNamingStrategy(),
  logging: envBoolean(process.env.DB_LOGGING),
};
