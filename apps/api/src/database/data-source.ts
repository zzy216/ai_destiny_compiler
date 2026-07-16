import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { databaseOptions } from './database.config';

export const AppDataSource = new DataSource(databaseOptions);

