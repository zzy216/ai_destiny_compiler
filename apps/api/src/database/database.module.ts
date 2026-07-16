import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { databaseOptions } from './database.config';

@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    if (process.env.NODE_ENV === 'test' || process.env.DATABASE_ENABLED === 'false') {
      return { module: DatabaseModule };
    }

    return {
      module: DatabaseModule,
      imports: [TypeOrmModule.forRoot(databaseOptions)],
      exports: [TypeOrmModule],
    };
  }
}
