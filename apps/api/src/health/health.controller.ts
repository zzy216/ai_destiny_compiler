import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
  ) {}

  @Get()
  async check(): Promise<{
    data: { status: 'ok' | 'degraded'; timestamp: string; database: 'up' | 'down' | 'disabled' };
  }> {
    const timestamp = new Date().toISOString();
    if (!this.dataSource) {
      return { data: { status: 'ok', timestamp, database: 'disabled' } };
    }

    try {
      await this.dataSource.query('SELECT 1');
      return { data: { status: 'ok', timestamp, database: 'up' } };
    } catch {
      return { data: { status: 'degraded', timestamp, database: 'down' } };
    }
  }
}
