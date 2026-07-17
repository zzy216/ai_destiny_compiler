import { createHash } from 'node:crypto';

import * as argon2 from 'argon2';
import type { DataSource, EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

import {
  CoachConfig,
  KnowledgeCard,
  ModelConfig,
  ModelConfigVersion,
  ModelCredential,
  User,
  UserProfile,
} from './entities';
import { AppDataSource } from './data-source';
import { validateEnvironment } from '../config/environment';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const TEST_USER_ID = '00000000-0000-4000-8000-000000000002';
const OPENAI_MODEL_ID = '00000000-0000-4000-8000-000000000101';
const OLLAMA_MODEL_ID = '00000000-0000-4000-8000-000000000102';
const OPENAI_VERSION_ID = '00000000-0000-4000-8000-000000000201';
const OLLAMA_VERSION_ID = '00000000-0000-4000-8000-000000000202';
const COACH_ID = '00000000-0000-4000-8000-000000000301';

export class SeedEnvironmentError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid seed environment: ${errors.join('; ')}`);
    this.name = 'SeedEnvironmentError';
  }
}

export interface SeedEnvironment {
  nodeEnv: 'development' | 'test';
  adminPassword: string;
  testUserPassword: string;
}

type ModelSeedDefinition = {
  id: string;
  versionId: string;
  slug: string;
  displayName: string;
  modelType: string;
  protocol: string;
  status: string;
  isDefault: boolean;
  isSelectable: boolean;
  provider: string;
  baseUrl: string;
  modelName: string;
  versionStatus: string;
  supportsStream: boolean;
  supportsStructuredOutput: boolean;
  capabilities: Record<string, unknown>;
  requestOptions: Record<string, unknown>;
};

type KnowledgeCardSeedDefinition = {
  id: string;
  cardKey: string;
  version: number;
  name: string;
  category: string;
  tags: string[];
  problemSignals: string[];
  variables: Record<string, unknown>;
  diagnosticQuestions: string[];
  candidateActions: string[];
  stopDoing: string[];
  reviewQuestions: string[];
};

const models: ModelSeedDefinition[] = [
  {
    id: OPENAI_MODEL_ID,
    versionId: OPENAI_VERSION_ID,
    slug: 'openai-compatible-placeholder',
    displayName: 'OpenAI Compatible（占位）',
    modelType: 'api',
    protocol: 'openai_compatible',
    status: 'draft',
    isDefault: false,
    isSelectable: false,
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini',
    versionStatus: 'draft',
    supportsStream: true,
    supportsStructuredOutput: true,
    capabilities: { chat: true, structuredOutput: true },
    requestOptions: { temperature: 0.2 },
  },
  {
    id: OLLAMA_MODEL_ID,
    versionId: OLLAMA_VERSION_ID,
    slug: 'ollama-local',
    displayName: 'Ollama 本地模型',
    modelType: 'local',
    protocol: 'ollama',
    status: 'published',
    isDefault: true,
    isSelectable: true,
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    modelName: 'llama3.2',
    versionStatus: 'published',
    supportsStream: true,
    supportsStructuredOutput: true,
    capabilities: { chat: true, structuredOutput: true, local: true },
    requestOptions: { temperature: 0.2 },
  },
];

const knowledgeCards: KnowledgeCardSeedDefinition[] = [
  ['目标模糊', '目标澄清', ['目标', '优先级'], ['我想达成的具体结果是什么？', '如果只能完成一件事，哪件事最重要？'], ['写出一个可观察的结果和截止时间'], ['同时推进过多目标'], ['本周是否仍然只围绕一个主结果行动？']],
  ['任务过大', '任务拆解', ['拆解', '行动'], ['这个任务最小可交付成果是什么？', '下一步是否能在 30 分钟内开始？'], ['把目标拆成一个 30 分钟内可开始的动作'], ['只写宏大目标不写动作'], ['动作是否足够小，能否马上开始？']],
  ['优先级冲突', '优先级', ['优先级', '取舍'], ['哪些事情直接影响当前目标？', '不做什么可以释放时间？'], ['保留一个主任务并明确停止项'], ['用“都重要”回避取舍'], ['今天的主任务是否被真正完成？']],
  ['拖延启动', '启动阻力', ['拖延', '启动'], ['开始前最担心什么？', '第一步需要准备什么最少材料？'], ['设置一个五分钟启动动作'], ['等待完整准备后再开始'], ['启动动作是否在当天完成？']],
  ['时间不足', '时间预算', ['时间', '计划'], ['真实可用时间有多少？', '哪些会议或活动可以调整？'], ['按可用时间重排动作并预留缓冲'], ['用理想时间制定计划'], ['计划是否符合真实时间预算？']],
  ['注意力分散', '专注环境', ['专注', '环境'], ['什么因素最容易打断当前任务？', '怎样让下一小时更少受打扰？'], ['移除一个干扰源并设置专注时段'], ['同时打开多个任务上下文'], ['专注时段内是否只保留一个任务？']],
  ['完美主义', '交付标准', ['完美主义', '交付'], ['当前阶段的合格标准是什么？', '哪些改进可以留到下一版？'], ['先完成可用版本，再安排复盘改进'], ['把非关键优化当成完成条件'], ['是否按约定标准交付而非无限打磨？']],
  ['决策犹豫', '决策推进', ['决策', '不确定'], ['当前决策最重要的约束是什么？', '什么信息足以支持下一步？'], ['设定决策截止时间和最小信息集'], ['无止境收集信息'], ['是否在截止时间前做出可逆决策？']],
  ['情绪消耗', '情绪调节', ['情绪', '能量'], ['当前情绪需要被看见还是需要解决？', '什么行动能先恢复基本能量？'], ['先完成一个低阻力恢复动作'], ['在低能量时强行制定复杂计划'], ['能量恢复后是否重新评估计划？']],
  ['沟通不清', '沟通确认', ['沟通', '边界'], ['对方需要知道的最小信息是什么？', '怎样确认双方对结果理解一致？'], ['发送一条包含背景、请求和截止时间的消息'], ['用模糊表达代替明确请求'], ['是否获得了明确回应或下一步？']],
  ['习惯中断', '习惯恢复', ['习惯', '恢复'], ['中断发生在流程的哪一步？', '怎样把恢复成本降到最低？'], ['从最小版本恢复习惯，不追补历史欠账'], ['因为一次中断放弃整个习惯'], ['习惯是否连续完成三个最小版本？']],
  ['复盘缺失', '复盘反馈', ['复盘', '反馈'], ['本次行动实际发生了什么？', '下一次只改一个什么变量？'], ['记录事实、原因和一个下一步调整'], ['只评价意志力，不分析系统'], ['下一轮是否验证了这一个调整？']],
].map(([name, category, tags, diagnosticQuestions, candidateActions, stopDoing, reviewQuestions], index) => ({
  id: `00000000-0000-4000-8000-${String(401 + index).padStart(12, '0')}`,
  cardKey: `mvp-${String(index + 1).padStart(2, '0')}`,
  version: 1,
  name: name as string,
  category: category as string,
  tags: tags as string[],
  problemSignals: [name as string],
  variables: { source: 'mvp-seed', confidence: '待确认' },
  diagnosticQuestions: diagnosticQuestions as string[],
  candidateActions: candidateActions as string[],
  stopDoing: stopDoing as string[],
  reviewQuestions: reviewQuestions as string[],
}));

export const SEED_DEFINITIONS = {
  entities: { User, UserProfile, ModelConfig, ModelConfigVersion, ModelCredential, CoachConfig, KnowledgeCard },
  users: [
    { id: ADMIN_ID, username: 'admin', email: 'admin@destiny.local', role: 'admin', displayName: '系统管理员' },
    { id: TEST_USER_ID, username: 'destiny_test', email: 'destiny-test@destiny.local', role: 'user', displayName: '固定测试用户' },
  ] as const,
  models,
  coach: {
    id: COACH_ID,
    version: 1,
    name: '命运编译器默认教练',
    roleDefinition: '你是一个温和、具体、面向行动的个人成长教练。',
    productGoal: '帮助用户把模糊困扰转化为可执行、可复盘的下一步行动。',
    systemPrompt: '先澄清事实和目标，再给出一个最小可执行动作；避免空泛鼓励和未经请求的诊断。',
    conversationRules: { askBeforeAssuming: true, maxDiagnosticQuestions: 3 },
    actionRules: { requireDeliverable: true, maxActions: 3 },
    prohibitedContent: { medicalDiagnosis: true, legalAdvice: true, guaranteedOutcome: true },
    safetyRules: { encourageProfessionalHelpWhenNeeded: true, crisisEscalation: true },
    outputSchema: { diagnosis: 'string', assumptions: 'string[]', nextActions: 'object[]', followUpQuestion: 'string' },
  },
  knowledgeCards,
};

export function validateSeedEnvironment(env: NodeJS.ProcessEnv = process.env): SeedEnvironment {
  const errors: string[] = [];
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') errors.push('NODE_ENV=production is not allowed for automatic seeding');
  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
    errors.push('NODE_ENV must be development, test, or production');
  }
  if (env.DATABASE_ENABLED === 'false' || env.DATABASE_ENABLED === '0') {
    errors.push('DATABASE_ENABLED must be true for seeding');
  }

  const adminPassword = env.SEED_ADMIN_PASSWORD ?? '';
  const testUserPassword = env.SEED_TEST_USER_PASSWORD ?? '';
  if (adminPassword.length < 12 || adminPassword.length > 128) {
    errors.push('SEED_ADMIN_PASSWORD must contain 12 to 128 characters');
  }
  if (testUserPassword.length < 12 || testUserPassword.length > 128) {
    errors.push('SEED_TEST_USER_PASSWORD must contain 12 to 128 characters');
  }
  if (errors.length > 0) throw new SeedEnvironmentError(errors);

  return {
    nodeEnv: nodeEnv as 'development' | 'test',
    adminPassword,
    testUserPassword,
  };
}

function checksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function ensureRecord(
  manager: EntityManager,
  entity: EntityTarget<unknown>,
  where: Record<string, unknown>,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const repository = manager.getRepository(entity as EntityTarget<ObjectLiteral>) as unknown as {
    findOne: (options: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
    insert: (record: Record<string, unknown>) => Promise<unknown>;
  };
  const existing = await repository.findOne({ where });
  if (existing) return existing;
  await repository.insert(values);
  return values;
}

async function ensureUser(
  manager: EntityManager,
  definition: (typeof SEED_DEFINITIONS.users)[number],
  password: string,
  createdBy: string | null,
): Promise<void> {
  const repository = manager.getRepository(User) as unknown as {
    findOne: (options: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
    insert: (record: Record<string, unknown>) => Promise<unknown>;
  };
  const existing = await repository.findOne({ where: { id: definition.id } });
  if (existing) return;
  await repository.insert({
    ...definition,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    passwordChangedAt: new Date(),
    failedLoginCount: 0,
    lastFailedLoginAt: null,
    lockedUntil: null,
    lastLoginAt: null,
    createdBy,
  });
}

async function ensureProfile(manager: EntityManager, userId: string, displayName: string): Promise<void> {
  await ensureRecord(manager, UserProfile, { userId }, {
    userId,
    displayName,
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN',
    onboardingCompleted: false,
    preferences: {},
  });
}

async function ensureModel(manager: EntityManager, model: ModelSeedDefinition): Promise<void> {
  await ensureRecord(manager, ModelConfig, { slug: model.slug }, {
    id: model.id,
    ownerType: 'system',
    ownerUserId: null,
    slug: model.slug,
    displayName: model.displayName,
    modelType: model.modelType,
    protocol: model.protocol,
    status: model.status,
    isDefault: model.isDefault,
    isSelectable: model.isSelectable,
    currentDraftVersionId: null,
    publishedVersionId: null,
    createdBy: ADMIN_ID,
    updatedBy: ADMIN_ID,
    deletedAt: null,
  });
  await ensureRecord(manager, ModelConfigVersion, { modelConfigId: model.id, version: 1 }, {
    id: model.versionId,
    modelConfigId: model.id,
    version: 1,
    versionStatus: model.versionStatus,
    provider: model.provider,
    baseUrl: model.baseUrl,
    modelName: model.modelName,
    timeoutMs: 60000,
    maxOutputTokens: 4096,
    supportsStream: model.supportsStream,
    supportsStructuredOutput: model.supportsStructuredOutput,
    capabilities: model.capabilities,
    requestOptions: model.requestOptions,
    configChecksum: checksum(model),
    createdBy: ADMIN_ID,
    publishedAt: model.versionStatus === 'published' ? new Date() : null,
  });
  const repository = manager.getRepository(ModelConfig) as unknown as {
    update: (criteria: Record<string, unknown>, changes: Record<string, unknown>) => Promise<unknown>;
  };
  await repository.update({ id: model.id }, {
    currentDraftVersionId: model.versionStatus === 'draft' ? model.versionId : null,
    publishedVersionId: model.versionStatus === 'published' ? model.versionId : null,
  });
}

async function ensureCoach(manager: EntityManager): Promise<void> {
  const definition = SEED_DEFINITIONS.coach;
  await ensureRecord(manager, CoachConfig, { version: definition.version }, {
    id: definition.id,
    version: definition.version,
    name: definition.name,
    roleDefinition: definition.roleDefinition,
    productGoal: definition.productGoal,
    systemPrompt: definition.systemPrompt,
    conversationRules: definition.conversationRules,
    actionRules: definition.actionRules,
    prohibitedContent: definition.prohibitedContent,
    safetyRules: definition.safetyRules,
    outputSchema: definition.outputSchema,
    defaultModelConfigId: OLLAMA_MODEL_ID,
    status: 'published',
    createdBy: ADMIN_ID,
    publishedAt: new Date(),
  });
}

async function ensureKnowledgeCards(manager: EntityManager): Promise<void> {
  for (const card of SEED_DEFINITIONS.knowledgeCards) {
    await ensureRecord(manager, KnowledgeCard, { cardKey: card.cardKey, version: card.version }, {
      ...card,
      status: 'published',
      createdBy: ADMIN_ID,
      publishedAt: new Date(),
    });
  }
}

export async function seedDatabase(
  dataSource: DataSource,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const seedEnvironment = validateSeedEnvironment(env);
  await dataSource.runMigrations();
  await dataSource.transaction(async (manager) => {
    await ensureUser(manager, SEED_DEFINITIONS.users[0], seedEnvironment.adminPassword, null);
    await ensureUser(manager, SEED_DEFINITIONS.users[1], seedEnvironment.testUserPassword, ADMIN_ID);
    await ensureProfile(manager, ADMIN_ID, SEED_DEFINITIONS.users[0].displayName);
    await ensureProfile(manager, TEST_USER_ID, SEED_DEFINITIONS.users[1].displayName);
    for (const model of SEED_DEFINITIONS.models) await ensureModel(manager, model);
    await ensureCoach(manager);
    await ensureKnowledgeCards(manager);
  });
}

async function main(): Promise<void> {
  validateEnvironment();
  validateSeedEnvironment();
  await AppDataSource.initialize();
  try {
    await seedDatabase(AppDataSource);
    console.log(JSON.stringify({ event: 'seed_completed', knowledgeCards: SEED_DEFINITIONS.knowledgeCards.length }));
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
