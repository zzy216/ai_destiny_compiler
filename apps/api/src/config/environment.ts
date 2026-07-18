export type NodeEnvironment = 'development' | 'test' | 'production';

export interface ValidatedEnvironment {
  nodeEnv: NodeEnvironment;
  port: number;
  databaseEnabled: boolean;
  database: {
    host: string;
    port: number;
    username: string;
    password: string | undefined;
    name: string;
    schema: string;
    ssl: boolean;
    logging: boolean;
  };
  modelCredentialKeyVersion: number;
  auth: {
    accessTokenTtlSeconds: number;
    refreshTokenTtlDays: number;
  };
}

export class EnvironmentValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid environment configuration: ${errors.join('; ')}`);
    this.name = 'EnvironmentValidationError';
  }
}

function parsePort(value: string | undefined, name: string, errors: string[], fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    errors.push(`${name} must be an integer between 1 and 65535`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined, name: string, errors: string[], fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0') {
    errors.push(`${name} must be true, false, 1, or 0`);
  }
  return value === 'true' || value === '1';
}

function required(value: string | undefined, name: string, errors: string[]): string {
  if (!value?.trim()) {
    errors.push(`${name} is required`);
    return '';
  }
  return value;
}

function validateBase64Key(value: string | undefined, name: string, errors: string[]): void {
  if (!value) {
    errors.push(`${name} is required`);
    return;
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== value) {
    errors.push(`${name} must be a canonical base64-encoded 32-byte key`);
  }
}

function validatePositiveInteger(
  value: string | undefined,
  name: string,
  errors: string[],
  fallback: number,
): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    errors.push(`${name} must be a positive integer`);
  }
  return parsed;
}

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): ValidatedEnvironment {
  const errors: string[] = [];
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
    errors.push('NODE_ENV must be development, test, or production');
  }

  const normalizedNodeEnv = (nodeEnv === 'test' || nodeEnv === 'production' ? nodeEnv : 'development') as NodeEnvironment;
  const port = parsePort(env.PORT, 'PORT', errors, 3000);
  const databaseEnabled = parseBoolean(
    env.DATABASE_ENABLED,
    'DATABASE_ENABLED',
    errors,
    normalizedNodeEnv !== 'test',
  );

  const databasePort = parsePort(env.DB_PORT, 'DB_PORT', errors, 5432);
  const database = {
    host: env.DB_HOST?.trim() || '127.0.0.1',
    port: databasePort,
    username: env.DB_USERNAME?.trim() || 'destiny_compiler',
    password: env.DB_PASSWORD,
    name: env.DB_NAME?.trim() || 'destiny_compiler',
    schema: env.DB_SCHEMA?.trim() || 'public',
    ssl: parseBoolean(env.DB_SSL, 'DB_SSL', errors, false),
    logging: parseBoolean(env.DB_LOGGING, 'DB_LOGGING', errors, false),
  };
  const modelCredentialKeyVersion = Number(env.MODEL_CREDENTIAL_KEY_VERSION ?? 1);
  if (!Number.isInteger(modelCredentialKeyVersion) || modelCredentialKeyVersion < 1 || modelCredentialKeyVersion > 32767) {
    errors.push('MODEL_CREDENTIAL_KEY_VERSION must be an integer between 1 and 32767');
  }
  const accessTokenTtlSeconds = validatePositiveInteger(
    env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    'AUTH_ACCESS_TOKEN_TTL_SECONDS',
    errors,
    900,
  );
  const refreshTokenTtlDays = validatePositiveInteger(
    env.AUTH_REFRESH_TOKEN_TTL_DAYS,
    'AUTH_REFRESH_TOKEN_TTL_DAYS',
    errors,
    30,
  );

  if (databaseEnabled) {
    required(database.host, 'DB_HOST', errors);
    required(database.username, 'DB_USERNAME', errors);
    required(database.name, 'DB_NAME', errors);
    if (!database.password?.trim() || database.password === 'replace-me') {
      errors.push('DB_PASSWORD must be set to a non-placeholder value');
    }
    validateBase64Key(env.MODEL_CREDENTIAL_MASTER_KEY, 'MODEL_CREDENTIAL_MASTER_KEY', errors);
    validateBase64Key(env.AUTH_ACCESS_TOKEN_SECRET, 'AUTH_ACCESS_TOKEN_SECRET', errors);
    validateBase64Key(env.TOKEN_HASH_KEY, 'TOKEN_HASH_KEY', errors);
    if (
      env.MODEL_CREDENTIAL_MASTER_KEY &&
      (env.MODEL_CREDENTIAL_MASTER_KEY === env.AUTH_ACCESS_TOKEN_SECRET ||
        env.MODEL_CREDENTIAL_MASTER_KEY === env.TOKEN_HASH_KEY ||
        env.AUTH_ACCESS_TOKEN_SECRET === env.TOKEN_HASH_KEY)
    ) {
      errors.push('MODEL_CREDENTIAL_MASTER_KEY, AUTH_ACCESS_TOKEN_SECRET, and TOKEN_HASH_KEY must be different');
    }
  }

  if (errors.length > 0) {
    throw new EnvironmentValidationError(errors);
  }

  return {
    nodeEnv: normalizedNodeEnv,
    port,
    databaseEnabled,
    database,
    modelCredentialKeyVersion,
    auth: { accessTokenTtlSeconds, refreshTokenTtlDays },
  };
}
