import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

type JsonObject = Record<string, unknown>;

const nowColumn = { type: 'timestamptz' as const, default: () => 'CURRENT_TIMESTAMP' };

@Entity('users')
@Check('users_identity_check', 'email IS NOT NULL OR username IS NOT NULL')
@Check('users_role_check', "role IN ('user', 'admin')")
@Check('users_status_check', "status IN ('active', 'disabled', 'locked')")
@Check('users_failed_login_count_check', 'failed_login_count >= 0')
export class User {
  @PrimaryColumn('uuid') declare id: string;
  @Column({ type: 'varchar', length: 254, nullable: true }) declare email: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) declare username: string | null;
  @Column({ type: 'varchar', length: 255 }) declare passwordHash: string;
  @Column({ type: 'varchar', length: 20, default: 'user' }) declare role: string;
  @Column({ type: 'varchar', length: 20, default: 'active' }) declare status: string;
  @Column(nowColumn) declare passwordChangedAt: Date;
  @Column({ type: 'integer', default: 0 }) declare failedLoginCount: number;
  @Column({ type: 'timestamptz', nullable: true }) declare lastFailedLoginAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) declare lockedUntil: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) declare lastLoginAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) declare createdBy: string | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn('uuid') declare userId: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) declare displayName: string | null;
  @Column({ type: 'varchar', length: 64, default: 'Asia/Shanghai' }) declare timezone: string;
  @Column({ type: 'varchar', length: 16, default: 'zh-CN' }) declare locale: string;
  @Column({ type: 'boolean', default: false }) declare onboardingCompleted: boolean;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare preferences: JsonObject;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('auth_invitations')
@Check('auth_invitations_role_check', "target_role IN ('user', 'admin')")
export class AuthInvitation {
  @PrimaryColumn('uuid') declare id: string;
  @Index({ unique: true })
  @Column({ type: 'char', length: 64 }) declare codeHash: string;
  @Column({ type: 'varchar', length: 20, default: 'user' }) declare targetRole: string;
  @Column({ type: 'uuid' }) declare createdBy: string;
  @Column({ type: 'timestamptz' }) declare expiresAt: Date;
  @Column({ type: 'uuid', nullable: true }) declare usedBy: string | null;
  @Column({ type: 'timestamptz', nullable: true }) declare usedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) declare revokedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
}

@Entity('auth_sessions')
@Check('auth_sessions_revoke_reason_check', "revoke_reason IS NULL OR revoke_reason IN ('rotated', 'logout', 'password_changed', 'admin_disabled', 'reuse_detected')")
export class AuthSession {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare userId: string;
  @Index() @Column({ type: 'uuid' }) declare tokenFamilyId: string;
  @Index({ unique: true }) @Column({ type: 'char', length: 64 }) declare refreshTokenHash: string;
  @Column({ type: 'uuid', nullable: true }) declare replacedBySessionId: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) declare deviceName: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) declare userAgent: string | null;
  @Column({ type: 'inet', nullable: true }) declare ipAddress: string | null;
  @Column({ type: 'timestamptz' }) declare expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) declare lastUsedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) declare revokedAt: Date | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) declare revokeReason: string | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
}

@Entity('model_configs')
@Check('model_configs_owner_check', "(owner_type = 'system' AND owner_user_id IS NULL) OR (owner_type = 'user' AND owner_user_id IS NOT NULL)")
@Check('model_configs_user_model_type_check', "owner_type = 'system' OR model_type = 'api'")
@Check('model_configs_default_check', "is_default = false OR owner_type = 'system'")
@Check('model_configs_status_check', "status IN ('draft', 'published', 'disabled', 'deleted')")
@Check('model_configs_owner_type_check', "owner_type IN ('system', 'user')")
@Check('model_configs_model_type_check', "model_type IN ('api', 'local')")
export class ModelConfig {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'varchar', length: 20 }) declare ownerType: string;
  @Index() @Column({ type: 'uuid', nullable: true }) declare ownerUserId: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) declare slug: string | null;
  @Column({ type: 'varchar', length: 100 }) declare displayName: string;
  @Column({ type: 'varchar', length: 20 }) declare modelType: string;
  @Column({ type: 'varchar', length: 30 }) declare protocol: string;
  @Column({ type: 'varchar', length: 20, default: 'draft' }) declare status: string;
  @Column({ type: 'boolean', default: false }) declare isDefault: boolean;
  @Column({ type: 'boolean', default: true }) declare isSelectable: boolean;
  @Column({ type: 'uuid', nullable: true }) declare currentDraftVersionId: string | null;
  @Column({ type: 'uuid', nullable: true }) declare publishedVersionId: string | null;
  @Column({ type: 'uuid' }) declare createdBy: string;
  @Column({ type: 'uuid' }) declare updatedBy: string;
  @Column({ type: 'timestamptz', nullable: true }) declare deletedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('model_config_versions')
@Check('model_config_versions_status_check', "version_status IN ('draft', 'published', 'superseded')")
@Check('model_config_versions_version_check', 'version > 0')
@Check('model_config_versions_timeout_check', 'timeout_ms BETWEEN 1000 AND 300000')
@Check('model_config_versions_output_tokens_check', 'max_output_tokens BETWEEN 1 AND 100000')
export class ModelConfigVersion {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare modelConfigId: string;
  @Column({ type: 'integer' }) declare version: number;
  @Column({ type: 'varchar', length: 20, default: 'draft' }) declare versionStatus: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) declare provider: string | null;
  @Column({ type: 'varchar', length: 500 }) declare baseUrl: string;
  @Column({ type: 'varchar', length: 120 }) declare modelName: string;
  @Column({ type: 'integer', default: 60000 }) declare timeoutMs: number;
  @Column({ type: 'integer', default: 4096 }) declare maxOutputTokens: number;
  @Column({ type: 'boolean', default: true }) declare supportsStream: boolean;
  @Column({ type: 'boolean', default: true }) declare supportsStructuredOutput: boolean;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare capabilities: JsonObject;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare requestOptions: JsonObject;
  @Column({ type: 'char', length: 64 }) declare configChecksum: string;
  @Column({ type: 'uuid' }) declare createdBy: string;
  @Column({ type: 'timestamptz', nullable: true }) declare publishedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
}

@Entity('model_credentials')
export class ModelCredential {
  @PrimaryColumn('uuid') declare modelConfigId: string;
  @Column({ type: 'bytea' }) declare ciphertext: Buffer;
  @Column({ type: 'bytea' }) declare iv: Buffer;
  @Column({ type: 'bytea' }) declare authTag: Buffer;
  @Column({ type: 'smallint' }) declare keyVersion: number;
  @Column({ type: 'varchar', length: 20, nullable: true }) declare secretHint: string | null;
  @Column({ type: 'uuid' }) declare updatedBy: string;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('coach_configs')
@Check('coach_configs_status_check', "status IN ('draft', 'published', 'disabled')")
export class CoachConfig {
  @PrimaryColumn('uuid') declare id: string;
  @Index({ unique: true }) @Column({ type: 'integer' }) declare version: number;
  @Column({ type: 'varchar', length: 100 }) declare name: string;
  @Column({ type: 'text' }) declare roleDefinition: string;
  @Column({ type: 'text' }) declare productGoal: string;
  @Column({ type: 'text' }) declare systemPrompt: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare conversationRules: JsonObject;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare actionRules: JsonObject;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare prohibitedContent: JsonObject;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare safetyRules: JsonObject;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare outputSchema: JsonObject;
  @Column({ type: 'uuid', nullable: true }) declare defaultModelConfigId: string | null;
  @Column({ type: 'varchar', length: 20, default: 'draft' }) declare status: string;
  @Column({ type: 'uuid' }) declare createdBy: string;
  @Column({ type: 'timestamptz', nullable: true }) declare publishedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('knowledge_cards')
@Check('knowledge_cards_status_check', "status IN ('draft', 'published', 'disabled')")
export class KnowledgeCard {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'varchar', length: 80 }) declare cardKey: string;
  @Column({ type: 'integer' }) declare version: number;
  @Column({ type: 'varchar', length: 100 }) declare name: string;
  @Index() @Column({ type: 'varchar', length: 50 }) declare category: string;
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" }) declare tags: string[];
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" }) declare problemSignals: string[];
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare variables: JsonObject;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) declare diagnosticQuestions: unknown[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) declare candidateActions: unknown[];
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" }) declare stopDoing: string[];
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" }) declare reviewQuestions: string[];
  @Column({ type: 'varchar', length: 20, default: 'draft' }) declare status: string;
  @Column({ type: 'uuid' }) declare createdBy: string;
  @Column({ type: 'timestamptz', nullable: true }) declare publishedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('goals')
@Check('goals_status_check', "status IN ('active', 'paused', 'completed', 'abandoned')")
export class Goal {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare userId: string;
  @Column({ type: 'varchar', length: 150 }) declare title: string;
  @Column({ type: 'text', nullable: true }) declare description: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) declare currentStage: string | null;
  @Column({ type: 'varchar', length: 20, default: 'active' }) declare status: string;
  @Column({ type: 'smallint', default: 0 }) declare priority: number;
  @Column({ type: 'date', nullable: true }) declare targetDate: string | null;
  @Column({ type: 'timestamptz', nullable: true }) declare completedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('conversations')
@Check('conversations_status_check', "status IN ('active', 'archived', 'model_unavailable')")
@Check('conversations_model_source_check', "model_source IN ('managed', 'custom')")
export class Conversation {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare userId: string;
  @Column({ type: 'uuid', nullable: true }) declare goalId: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) declare title: string | null;
  @Column({ type: 'varchar', length: 30, default: 'active' }) declare status: string;
  @Column({ type: 'varchar', length: 20 }) declare modelSource: string;
  @Column({ type: 'uuid' }) declare modelConfigId: string;
  @Column({ type: 'uuid' }) declare modelConfigVersionId: string;
  @Column({ type: 'jsonb' }) declare modelSnapshot: JsonObject;
  @Column({ type: 'text', nullable: true }) declare summary: string | null;
  @Column({ type: 'timestamptz', nullable: true }) declare lastMessageAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('messages')
@Check('messages_role_check', "role IN ('user', 'assistant', 'system')")
@Check('messages_status_check', "status IN ('streaming', 'completed', 'failed')")
@Check('messages_sequence_check', 'sequence > 0')
export class Message {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare conversationId: string;
  @Index() @Column({ type: 'uuid' }) declare userId: string;
  @Column({ type: 'integer' }) declare sequence: number;
  @Column({ type: 'varchar', length: 20 }) declare role: string;
  @Column({ type: 'text' }) declare content: string;
  @Column({ type: 'jsonb', nullable: true }) declare contentJson: JsonObject | null;
  @Column({ type: 'varchar', length: 20, default: 'streaming' }) declare status: string;
  @Column({ type: 'uuid', nullable: true }) declare agentRunId: string | null;
  @Column({ type: 'timestamptz', nullable: true }) declare completedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('agent_runs')
@Check('agent_runs_status_check', "status IN ('running', 'succeeded', 'failed', 'timeout', 'cancelled')")
@Check('agent_runs_non_negative_check', 'input_tokens IS NULL OR input_tokens >= 0')
@Check('agent_runs_output_tokens_check', 'output_tokens IS NULL OR output_tokens >= 0')
@Check('agent_runs_duration_check', 'duration_ms IS NULL OR duration_ms >= 0')
@Check('agent_runs_cost_check', 'estimated_cost IS NULL OR estimated_cost >= 0')
export class AgentRun {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare userId: string;
  @Index() @Column({ type: 'uuid' }) declare conversationId: string;
  @Column({ type: 'uuid' }) declare requestMessageId: string;
  @Column({ type: 'uuid', nullable: true }) declare responseMessageId: string | null;
  @Index() @Column({ type: 'varchar', length: 100 }) declare idempotencyKey: string;
  @Column({ type: 'varchar', length: 20, default: 'running' }) declare status: string;
  @Column({ type: 'uuid' }) declare modelConfigId: string;
  @Index() @Column({ type: 'uuid' }) declare modelConfigVersionId: string;
  @Column({ type: 'jsonb' }) declare modelSnapshot: JsonObject;
  @Column({ type: 'uuid' }) declare coachConfigId: string;
  @Column({ type: 'jsonb' }) declare coachConfigSnapshot: JsonObject;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) declare matchedKnowledgeCards: unknown[];
  @Column({ type: 'varchar', length: 50 }) declare promptVersion: string;
  @Column({ type: 'integer', nullable: true }) declare inputTokens: number | null;
  @Column({ type: 'integer', nullable: true }) declare outputTokens: number | null;
  @Column({ type: 'numeric', precision: 14, scale: 6, nullable: true }) declare estimatedCost: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) declare providerRequestId: string | null;
  @Column({ type: 'integer', nullable: true }) declare durationMs: number | null;
  @Column({ type: 'jsonb', nullable: true }) declare resultJson: JsonObject | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) declare errorCode: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) declare errorMessage: string | null;
  @Column(nowColumn) declare startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) declare completedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
}

@Entity('action_cards')
@Check('action_cards_status_check', "status IN ('pending', 'in_progress', 'completed', 'partially_completed', 'not_completed', 'abandoned')")
@Check('action_cards_duration_check', 'duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440')
export class ActionCard {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare userId: string;
  @Column({ type: 'uuid' }) declare conversationId: string;
  @Column({ type: 'uuid' }) declare agentRunId: string;
  @Column({ type: 'uuid', nullable: true }) declare goalId: string | null;
  @Column({ type: 'boolean', default: true }) declare isPrimary: boolean;
  @Column({ type: 'varchar', length: 150 }) declare title: string;
  @Column({ type: 'integer', nullable: true }) declare durationMinutes: number | null;
  @Column({ type: 'text' }) declare deliverable: string;
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" }) declare completionCriteria: string[];
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" }) declare stopDoing: string[];
  @Column({ type: 'varchar', length: 30, default: 'pending' }) declare status: string;
  @Column({ type: 'timestamptz', nullable: true }) declare dueAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) declare completedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('execution_records')
@Check('execution_records_result_check', "result IN ('completed', 'partially_completed', 'not_completed')")
export class ExecutionRecord {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare userId: string;
  @Index() @Column({ type: 'uuid' }) declare actionCardId: string;
  @Column({ type: 'varchar', length: 30 }) declare result: string;
  @Column({ type: 'text', nullable: true }) declare note: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) declare obstacleType: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare evidence: JsonObject;
  @Column(nowColumn) declare submittedAt: Date;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
}

@Entity('reviews')
@Check('reviews_type_check', "review_type IN ('action', 'daily', 'stage')")
export class Review {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare userId: string;
  @Column({ type: 'varchar', length: 20 }) declare reviewType: string;
  @Column({ type: 'uuid', nullable: true }) declare actionCardId: string | null;
  @Column({ type: 'uuid', nullable: true }) declare generatedByRunId: string | null;
  @Column({ type: 'date', nullable: true }) declare periodStart: string | null;
  @Column({ type: 'date', nullable: true }) declare periodEnd: string | null;
  @Column({ type: 'text' }) declare summary: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) declare progress: JsonObject;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) declare frictions: unknown[];
  @Column({ type: 'text', nullable: true }) declare nextFocus: string | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

@Entity('memories')
@Check('memories_category_check', "category IN ('goal', 'preference', 'constraint', 'pattern', 'context')")
@Check('memories_confidence_check', 'confidence IS NULL OR confidence BETWEEN 0 AND 1')
export class Memory {
  @PrimaryColumn('uuid') declare id: string;
  @Index() @Column({ type: 'uuid' }) declare userId: string;
  @Column({ type: 'uuid', nullable: true }) declare sourceConversationId: string | null;
  @Column({ type: 'uuid', nullable: true }) declare sourceMessageId: string | null;
  @Column({ type: 'varchar', length: 40 }) declare category: string;
  @Column({ type: 'text' }) declare content: string;
  @Column({ type: 'numeric', precision: 4, scale: 3, nullable: true }) declare confidence: string | null;
  @Column({ type: 'boolean', default: false }) declare confirmedByUser: boolean;
  @Column({ type: 'timestamptz', nullable: true }) declare lastUsedAt: Date | null;
  @CreateDateColumn(nowColumn) declare createdAt: Date;
  @UpdateDateColumn(nowColumn) declare updatedAt: Date;
}

export const databaseEntities = [
  User,
  UserProfile,
  AuthInvitation,
  AuthSession,
  ModelConfig,
  ModelConfigVersion,
  ModelCredential,
  CoachConfig,
  KnowledgeCard,
  Goal,
  Conversation,
  Message,
  AgentRun,
  ActionCard,
  ExecutionRecord,
  Review,
  Memory,
];
