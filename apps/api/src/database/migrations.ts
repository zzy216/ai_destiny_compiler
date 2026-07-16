import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1784200000001 implements MigrationInterface {
  name = 'CreateUsers1784200000001';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "users" ("id" uuid PRIMARY KEY, "email" varchar(254), "username" varchar(50), "password_hash" varchar(255) NOT NULL, "role" varchar(20) NOT NULL DEFAULT 'user', "status" varchar(20) NOT NULL DEFAULT 'active', "password_changed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "failed_login_count" integer NOT NULL DEFAULT 0, "last_failed_login_at" timestamptz, "locked_until" timestamptz, "last_login_at" timestamptz, "created_by" uuid, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "users_identity_check" CHECK (email IS NOT NULL OR username IS NOT NULL), CONSTRAINT "users_role_check" CHECK (role IN ('user', 'admin')), CONSTRAINT "users_status_check" CHECK (status IN ('active', 'disabled', 'locked')), CONSTRAINT "users_failed_login_count_check" CHECK (failed_login_count >= 0), CONSTRAINT "users_created_by_fk" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL)`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "users"'); }
}

export class CreateUserProfiles1784200000002 implements MigrationInterface {
  name = 'CreateUserProfiles1784200000002';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "user_profiles" ("user_id" uuid PRIMARY KEY, "display_name" varchar(80), "timezone" varchar(64) NOT NULL DEFAULT 'Asia/Shanghai', "locale" varchar(16) NOT NULL DEFAULT 'zh-CN', "onboarding_completed" boolean NOT NULL DEFAULT false, "preferences" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "user_profiles_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "user_profiles"'); }
}

export class CreateAuthInvitations1784200000003 implements MigrationInterface {
  name = 'CreateAuthInvitations1784200000003';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "auth_invitations" ("id" uuid PRIMARY KEY, "code_hash" char(64) NOT NULL, "target_role" varchar(20) NOT NULL DEFAULT 'user', "created_by" uuid NOT NULL, "expires_at" timestamptz NOT NULL, "used_by" uuid, "used_at" timestamptz, "revoked_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "auth_invitations_role_check" CHECK (target_role IN ('user', 'admin')), CONSTRAINT "auth_invitations_code_unique" UNIQUE (code_hash), CONSTRAINT "auth_invitations_created_by_fk" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT "auth_invitations_used_by_fk" FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL)`);
    await q.query('CREATE INDEX "idx_auth_invitations_expires_at" ON "auth_invitations" ("expires_at")');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "auth_invitations"'); }
}

export class CreateAuthSessions1784200000004 implements MigrationInterface {
  name = 'CreateAuthSessions1784200000004';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "auth_sessions" ("id" uuid PRIMARY KEY, "user_id" uuid NOT NULL, "token_family_id" uuid NOT NULL, "refresh_token_hash" char(64) NOT NULL, "replaced_by_session_id" uuid, "device_name" varchar(100), "user_agent" varchar(500), "ip_address" inet, "expires_at" timestamptz NOT NULL, "last_used_at" timestamptz, "revoked_at" timestamptz, "revoke_reason" varchar(50), "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "auth_sessions_revoke_reason_check" CHECK (revoke_reason IS NULL OR revoke_reason IN ('rotated', 'logout', 'password_changed', 'admin_disabled', 'reuse_detected')), CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE (refresh_token_hash), CONSTRAINT "auth_sessions_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT "auth_sessions_replaced_by_fk" FOREIGN KEY (replaced_by_session_id) REFERENCES auth_sessions(id) ON DELETE SET NULL)`);
    await q.query('CREATE INDEX "idx_auth_sessions_user_active" ON "auth_sessions" ("user_id", "expires_at") WHERE "revoked_at" IS NULL');
    await q.query('CREATE INDEX "idx_auth_sessions_family" ON "auth_sessions" ("token_family_id")');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "auth_sessions"'); }
}

export class CreateModelConfigs1784200000005 implements MigrationInterface {
  name = 'CreateModelConfigs1784200000005';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "model_configs" ("id" uuid PRIMARY KEY, "owner_type" varchar(20) NOT NULL, "owner_user_id" uuid, "slug" varchar(80), "display_name" varchar(100) NOT NULL, "model_type" varchar(20) NOT NULL, "protocol" varchar(30) NOT NULL, "status" varchar(20) NOT NULL DEFAULT 'draft', "is_default" boolean NOT NULL DEFAULT false, "is_selectable" boolean NOT NULL DEFAULT true, "current_draft_version_id" uuid, "published_version_id" uuid, "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "model_configs_owner_type_check" CHECK (owner_type IN ('system', 'user')), CONSTRAINT "model_configs_owner_check" CHECK ((owner_type = 'system' AND owner_user_id IS NULL) OR (owner_type = 'user' AND owner_user_id IS NOT NULL)), CONSTRAINT "model_configs_user_model_type_check" CHECK (owner_type = 'system' OR model_type = 'api'), CONSTRAINT "model_configs_default_check" CHECK (is_default = false OR owner_type = 'system'), CONSTRAINT "model_configs_status_check" CHECK (status IN ('draft', 'published', 'disabled', 'deleted')), CONSTRAINT "model_configs_model_type_check" CHECK (model_type IN ('api', 'local')), CONSTRAINT "model_configs_model_protocol_check" CHECK (protocol IN ('openai_compatible', 'ollama', 'provider_specific')), CONSTRAINT "model_configs_created_by_fk" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT "model_configs_updated_by_fk" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT "model_configs_owner_user_fk" FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT)`);
    await q.query('CREATE UNIQUE INDEX "ux_model_configs_system_slug" ON "model_configs" ("slug") WHERE "owner_type" = \'system\' AND "slug" IS NOT NULL');
    await q.query('CREATE INDEX "idx_model_configs_user" ON "model_configs" ("owner_user_id", "status", "updated_at" DESC)');
    await q.query('CREATE INDEX "idx_model_configs_selectable" ON "model_configs" ("status", "is_selectable", "display_name")');
    await q.query('CREATE UNIQUE INDEX "ux_model_configs_system_default" ON "model_configs" ("is_default") WHERE "owner_type" = \'system\' AND "is_default" = true AND "status" = \'published\'');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "model_configs"'); }
}

export class CreateModelConfigVersions1784200000006 implements MigrationInterface {
  name = 'CreateModelConfigVersions1784200000006';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "model_config_versions" ("id" uuid PRIMARY KEY, "model_config_id" uuid NOT NULL, "version" integer NOT NULL, "version_status" varchar(20) NOT NULL DEFAULT 'draft', "provider" varchar(50), "base_url" varchar(500) NOT NULL, "model_name" varchar(120) NOT NULL, "timeout_ms" integer NOT NULL DEFAULT 60000, "max_output_tokens" integer NOT NULL DEFAULT 4096, "supports_stream" boolean NOT NULL DEFAULT true, "supports_structured_output" boolean NOT NULL DEFAULT true, "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb, "request_options" jsonb NOT NULL DEFAULT '{}'::jsonb, "config_checksum" char(64) NOT NULL, "created_by" uuid NOT NULL, "published_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "model_config_versions_model_version_unique" UNIQUE (model_config_id, version), CONSTRAINT "model_config_versions_model_id_unique" UNIQUE (model_config_id, id), CONSTRAINT "model_config_versions_status_check" CHECK (version_status IN ('draft', 'published', 'superseded')), CONSTRAINT "model_config_versions_version_check" CHECK (version > 0), CONSTRAINT "model_config_versions_timeout_check" CHECK (timeout_ms BETWEEN 1000 AND 300000), CONSTRAINT "model_config_versions_output_tokens_check" CHECK (max_output_tokens BETWEEN 1 AND 100000), CONSTRAINT "model_config_versions_model_fk" FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE CASCADE, CONSTRAINT "model_config_versions_created_by_fk" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT)`);
    await q.query('CREATE INDEX "idx_model_config_versions_status" ON "model_config_versions" ("model_config_id", "version_status", "version" DESC)');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "model_config_versions"'); }
}

export class AddModelCurrentVersionForeignKeys1784200000007 implements MigrationInterface {
  name = 'AddModelCurrentVersionForeignKeys1784200000007';
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "model_configs" ADD CONSTRAINT "model_configs_current_draft_fk" FOREIGN KEY ("id", "current_draft_version_id") REFERENCES "model_config_versions" ("model_config_id", "id") DEFERRABLE INITIALLY DEFERRED');
    await q.query('ALTER TABLE "model_configs" ADD CONSTRAINT "model_configs_published_version_fk" FOREIGN KEY ("id", "published_version_id") REFERENCES "model_config_versions" ("model_config_id", "id") DEFERRABLE INITIALLY DEFERRED');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "model_configs" DROP CONSTRAINT "model_configs_published_version_fk"');
    await q.query('ALTER TABLE "model_configs" DROP CONSTRAINT "model_configs_current_draft_fk"');
  }
}

export class CreateModelCredentials1784200000008 implements MigrationInterface {
  name = 'CreateModelCredentials1784200000008';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "model_credentials" ("model_config_id" uuid PRIMARY KEY, "ciphertext" bytea NOT NULL, "iv" bytea NOT NULL, "auth_tag" bytea NOT NULL, "key_version" smallint NOT NULL, "secret_hint" varchar(20), "updated_by" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "model_credentials_model_fk" FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE CASCADE, CONSTRAINT "model_credentials_updated_by_fk" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT)`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "model_credentials"'); }
}

export class CreateCoachConfigs1784200000009 implements MigrationInterface {
  name = 'CreateCoachConfigs1784200000009';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "coach_configs" ("id" uuid PRIMARY KEY, "version" integer NOT NULL, "name" varchar(100) NOT NULL, "role_definition" text NOT NULL, "product_goal" text NOT NULL, "system_prompt" text NOT NULL, "conversation_rules" jsonb NOT NULL DEFAULT '{}'::jsonb, "action_rules" jsonb NOT NULL DEFAULT '{}'::jsonb, "prohibited_content" jsonb NOT NULL DEFAULT '{}'::jsonb, "safety_rules" jsonb NOT NULL DEFAULT '{}'::jsonb, "output_schema" jsonb NOT NULL DEFAULT '{}'::jsonb, "default_model_config_id" uuid, "status" varchar(20) NOT NULL DEFAULT 'draft', "created_by" uuid NOT NULL, "published_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "coach_configs_version_unique" UNIQUE (version), CONSTRAINT "coach_configs_version_check" CHECK (version > 0), CONSTRAINT "coach_configs_status_check" CHECK (status IN ('draft', 'published', 'disabled')), CONSTRAINT "coach_configs_created_by_fk" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT "coach_configs_default_model_fk" FOREIGN KEY (default_model_config_id) REFERENCES model_configs(id) ON DELETE SET NULL)`);
    await q.query('CREATE UNIQUE INDEX "ux_coach_configs_published" ON "coach_configs" ("status") WHERE "status" = \'published\'');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "coach_configs"'); }
}

export class CreateKnowledgeCards1784200000010 implements MigrationInterface {
  name = 'CreateKnowledgeCards1784200000010';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "knowledge_cards" ("id" uuid PRIMARY KEY, "card_key" varchar(80) NOT NULL, "version" integer NOT NULL, "name" varchar(100) NOT NULL, "category" varchar(50) NOT NULL, "tags" text[] NOT NULL DEFAULT ARRAY[]::text[], "problem_signals" text[] NOT NULL DEFAULT ARRAY[]::text[], "variables" jsonb NOT NULL DEFAULT '{}'::jsonb, "diagnostic_questions" jsonb NOT NULL DEFAULT '[]'::jsonb, "candidate_actions" jsonb NOT NULL DEFAULT '[]'::jsonb, "stop_doing" text[] NOT NULL DEFAULT ARRAY[]::text[], "review_questions" text[] NOT NULL DEFAULT ARRAY[]::text[], "status" varchar(20) NOT NULL DEFAULT 'draft', "created_by" uuid NOT NULL, "published_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "knowledge_cards_key_version_unique" UNIQUE (card_key, version), CONSTRAINT "knowledge_cards_version_check" CHECK (version > 0), CONSTRAINT "knowledge_cards_status_check" CHECK (status IN ('draft', 'published', 'disabled')), CONSTRAINT "knowledge_cards_created_by_fk" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT)`);
    await q.query('CREATE INDEX "idx_knowledge_cards_status_category" ON "knowledge_cards" ("status", "category")');
    await q.query('CREATE INDEX "idx_knowledge_cards_tags" ON "knowledge_cards" USING GIN ("tags")');
    await q.query('CREATE INDEX "idx_knowledge_cards_problem_signals" ON "knowledge_cards" USING GIN ("problem_signals")');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "knowledge_cards"'); }
}

export class CreateGoals1784200000011 implements MigrationInterface {
  name = 'CreateGoals1784200000011';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "goals" ("id" uuid PRIMARY KEY, "user_id" uuid NOT NULL, "title" varchar(150) NOT NULL, "description" text, "current_stage" varchar(100), "status" varchar(20) NOT NULL DEFAULT 'active', "priority" smallint NOT NULL DEFAULT 0, "target_date" date, "completed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "goals_status_check" CHECK (status IN ('active', 'paused', 'completed', 'abandoned')), CONSTRAINT "goals_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    await q.query('CREATE INDEX "idx_goals_user_status" ON "goals" ("user_id", "status", "updated_at" DESC)');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "goals"'); }
}

export class CreateConversations1784200000012 implements MigrationInterface {
  name = 'CreateConversations1784200000012';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "conversations" ("id" uuid PRIMARY KEY, "user_id" uuid NOT NULL, "goal_id" uuid, "title" varchar(150), "status" varchar(30) NOT NULL DEFAULT 'active', "model_source" varchar(20) NOT NULL, "model_config_id" uuid NOT NULL, "model_config_version_id" uuid NOT NULL, "model_snapshot" jsonb NOT NULL, "summary" text, "last_message_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "conversations_status_check" CHECK (status IN ('active', 'archived', 'model_unavailable')), CONSTRAINT "conversations_model_source_check" CHECK (model_source IN ('managed', 'custom')), CONSTRAINT "conversations_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT "conversations_goal_fk" FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL, CONSTRAINT "conversations_model_fk" FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE RESTRICT, CONSTRAINT "conversations_model_version_fk" FOREIGN KEY (model_config_id, model_config_version_id) REFERENCES model_config_versions(model_config_id, id) ON DELETE RESTRICT)`);
    await q.query('CREATE INDEX "idx_conversations_user_recent" ON "conversations" ("user_id", "last_message_at" DESC, "created_at" DESC)');
    await q.query('CREATE INDEX "idx_conversations_goal" ON "conversations" ("user_id", "goal_id")');
    await q.query('CREATE INDEX "idx_conversations_model_version" ON "conversations" ("model_config_version_id")');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "conversations"'); }
}

export class CreateMessages1784200000013 implements MigrationInterface {
  name = 'CreateMessages1784200000013';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "messages" ("id" uuid PRIMARY KEY, "conversation_id" uuid NOT NULL, "user_id" uuid NOT NULL, "sequence" integer NOT NULL, "role" varchar(20) NOT NULL, "content" text NOT NULL, "content_json" jsonb, "status" varchar(20) NOT NULL DEFAULT 'streaming', "agent_run_id" uuid, "completed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "messages_conversation_sequence_unique" UNIQUE (conversation_id, sequence), CONSTRAINT "messages_sequence_check" CHECK (sequence > 0), CONSTRAINT "messages_role_check" CHECK (role IN ('user', 'assistant', 'system')), CONSTRAINT "messages_status_check" CHECK (status IN ('streaming', 'completed', 'failed')), CONSTRAINT "messages_conversation_fk" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE, CONSTRAINT "messages_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT)`);
    await q.query('CREATE INDEX "idx_messages_conversation_sequence" ON "messages" ("conversation_id", "sequence")');
    await q.query('CREATE INDEX "idx_messages_user_created" ON "messages" ("user_id", "created_at" DESC)');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "messages"'); }
}

export class CreateAgentRuns1784200000014 implements MigrationInterface {
  name = 'CreateAgentRuns1784200000014';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "agent_runs" ("id" uuid PRIMARY KEY, "user_id" uuid NOT NULL, "conversation_id" uuid NOT NULL, "request_message_id" uuid NOT NULL, "response_message_id" uuid, "idempotency_key" varchar(100) NOT NULL, "status" varchar(20) NOT NULL DEFAULT 'running', "model_config_id" uuid NOT NULL, "model_config_version_id" uuid NOT NULL, "model_snapshot" jsonb NOT NULL, "coach_config_id" uuid NOT NULL, "coach_config_snapshot" jsonb NOT NULL, "matched_knowledge_cards" jsonb NOT NULL DEFAULT '[]'::jsonb, "prompt_version" varchar(50) NOT NULL, "input_tokens" integer, "output_tokens" integer, "estimated_cost" numeric(14,6), "provider_request_id" varchar(150), "duration_ms" integer, "result_json" jsonb, "error_code" varchar(80), "error_message" varchar(500), "started_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "completed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "agent_runs_user_idempotency_unique" UNIQUE (user_id, idempotency_key), CONSTRAINT "agent_runs_status_check" CHECK (status IN ('running', 'succeeded', 'failed', 'timeout', 'cancelled')), CONSTRAINT "agent_runs_input_tokens_check" CHECK (input_tokens IS NULL OR input_tokens >= 0), CONSTRAINT "agent_runs_output_tokens_check" CHECK (output_tokens IS NULL OR output_tokens >= 0), CONSTRAINT "agent_runs_duration_check" CHECK (duration_ms IS NULL OR duration_ms >= 0), CONSTRAINT "agent_runs_cost_check" CHECK (estimated_cost IS NULL OR estimated_cost >= 0), CONSTRAINT "agent_runs_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT "agent_runs_conversation_fk" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE, CONSTRAINT "agent_runs_model_fk" FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE RESTRICT, CONSTRAINT "agent_runs_model_version_fk" FOREIGN KEY (model_config_id, model_config_version_id) REFERENCES model_config_versions(model_config_id, id) ON DELETE RESTRICT, CONSTRAINT "agent_runs_coach_fk" FOREIGN KEY (coach_config_id) REFERENCES coach_configs(id) ON DELETE RESTRICT)`);
    await q.query('CREATE INDEX "idx_agent_runs_conversation" ON "agent_runs" ("conversation_id", "created_at" DESC)');
    await q.query('CREATE INDEX "idx_agent_runs_user_recent" ON "agent_runs" ("user_id", "created_at" DESC)');
    await q.query('CREATE INDEX "idx_agent_runs_status" ON "agent_runs" ("status", "created_at" DESC)');
    await q.query('CREATE INDEX "idx_agent_runs_model_version" ON "agent_runs" ("model_config_version_id", "created_at" DESC)');
    await q.query('CREATE INDEX "idx_agent_runs_coach_config" ON "agent_runs" ("coach_config_id", "created_at" DESC)');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "agent_runs"'); }
}

export class AddMessageAgentRunForeignKeys1784200000015 implements MigrationInterface {
  name = 'AddMessageAgentRunForeignKeys1784200000015';
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_run_fk" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED');
    await q.query('ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_request_message_fk" FOREIGN KEY ("request_message_id") REFERENCES "messages" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED');
    await q.query('ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_response_message_fk" FOREIGN KEY ("response_message_id") REFERENCES "messages" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_response_message_fk"');
    await q.query('ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_request_message_fk"');
    await q.query('ALTER TABLE "messages" DROP CONSTRAINT "messages_agent_run_fk"');
  }
}

export class CreateActionCards1784200000016 implements MigrationInterface {
  name = 'CreateActionCards1784200000016';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "action_cards" ("id" uuid PRIMARY KEY, "user_id" uuid NOT NULL, "conversation_id" uuid NOT NULL, "agent_run_id" uuid NOT NULL, "goal_id" uuid, "is_primary" boolean NOT NULL DEFAULT true, "title" varchar(150) NOT NULL, "duration_minutes" integer, "deliverable" text NOT NULL, "completion_criteria" text[] NOT NULL DEFAULT ARRAY[]::text[], "stop_doing" text[] NOT NULL DEFAULT ARRAY[]::text[], "status" varchar(30) NOT NULL DEFAULT 'pending', "due_at" timestamptz, "completed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "action_cards_status_check" CHECK (status IN ('pending', 'in_progress', 'completed', 'partially_completed', 'not_completed', 'abandoned')), CONSTRAINT "action_cards_duration_check" CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440), CONSTRAINT "action_cards_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT "action_cards_conversation_fk" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE, CONSTRAINT "action_cards_agent_run_fk" FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE, CONSTRAINT "action_cards_goal_fk" FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL)`);
    await q.query('CREATE INDEX "idx_action_cards_user_status" ON "action_cards" ("user_id", "status", "due_at")');
    await q.query('CREATE INDEX "idx_action_cards_goal" ON "action_cards" ("goal_id", "created_at" DESC)');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "action_cards"'); }
}

export class CreateExecutionRecords1784200000017 implements MigrationInterface {
  name = 'CreateExecutionRecords1784200000017';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "execution_records" ("id" uuid PRIMARY KEY, "user_id" uuid NOT NULL, "action_card_id" uuid NOT NULL, "result" varchar(30) NOT NULL, "note" text, "obstacle_type" varchar(40), "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb, "submitted_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "execution_records_result_check" CHECK (result IN ('completed', 'partially_completed', 'not_completed')), CONSTRAINT "execution_records_action_fk" FOREIGN KEY (action_card_id) REFERENCES action_cards(id) ON DELETE CASCADE, CONSTRAINT "execution_records_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT)`);
    await q.query('CREATE INDEX "idx_execution_records_action" ON "execution_records" ("action_card_id", "submitted_at" DESC)');
    await q.query('CREATE INDEX "idx_execution_records_user" ON "execution_records" ("user_id", "submitted_at" DESC)');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "execution_records"'); }
}

export class CreateReviews1784200000018 implements MigrationInterface {
  name = 'CreateReviews1784200000018';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "reviews" ("id" uuid PRIMARY KEY, "user_id" uuid NOT NULL, "review_type" varchar(20) NOT NULL, "action_card_id" uuid, "generated_by_run_id" uuid, "period_start" date, "period_end" date, "summary" text NOT NULL, "progress" jsonb NOT NULL DEFAULT '{}'::jsonb, "frictions" jsonb NOT NULL DEFAULT '[]'::jsonb, "next_focus" text, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "reviews_type_check" CHECK (review_type IN ('action', 'daily', 'stage')), CONSTRAINT "reviews_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT "reviews_action_fk" FOREIGN KEY (action_card_id) REFERENCES action_cards(id) ON DELETE SET NULL, CONSTRAINT "reviews_run_fk" FOREIGN KEY (generated_by_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL)`);
    await q.query('CREATE INDEX "idx_reviews_user_type" ON "reviews" ("user_id", "review_type", "created_at" DESC)');
    await q.query('CREATE INDEX "idx_reviews_period" ON "reviews" ("user_id", "period_start", "period_end")');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "reviews"'); }
}

export class CreateMemories1784200000019 implements MigrationInterface {
  name = 'CreateMemories1784200000019';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "memories" ("id" uuid PRIMARY KEY, "user_id" uuid NOT NULL, "source_conversation_id" uuid, "source_message_id" uuid, "category" varchar(40) NOT NULL, "content" text NOT NULL, "confidence" numeric(4,3), "confirmed_by_user" boolean NOT NULL DEFAULT false, "last_used_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "memories_category_check" CHECK (category IN ('goal', 'preference', 'constraint', 'pattern', 'context')), CONSTRAINT "memories_confidence_check" CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1), CONSTRAINT "memories_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT "memories_conversation_fk" FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL, CONSTRAINT "memories_message_fk" FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL)`);
    await q.query('CREATE INDEX "idx_memories_user_category" ON "memories" ("user_id", "category", "updated_at" DESC)');
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "memories"'); }
}

export class AddPartialIndexesAndChecks1784200000020 implements MigrationInterface {
  name = 'AddPartialIndexesAndChecks1784200000020';
  async up(q: QueryRunner): Promise<void> {
    await q.query('CREATE UNIQUE INDEX "ux_knowledge_cards_published_key" ON "knowledge_cards" ("card_key") WHERE "status" = \'published\'');
    await q.query('CREATE UNIQUE INDEX "ux_action_cards_primary_run" ON "action_cards" ("agent_run_id") WHERE "is_primary" = true');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX "ux_action_cards_primary_run"');
    await q.query('DROP INDEX "ux_knowledge_cards_published_key"');
  }
}

export const databaseMigrations = [
  CreateUsers1784200000001,
  CreateUserProfiles1784200000002,
  CreateAuthInvitations1784200000003,
  CreateAuthSessions1784200000004,
  CreateModelConfigs1784200000005,
  CreateModelConfigVersions1784200000006,
  AddModelCurrentVersionForeignKeys1784200000007,
  CreateModelCredentials1784200000008,
  CreateCoachConfigs1784200000009,
  CreateKnowledgeCards1784200000010,
  CreateGoals1784200000011,
  CreateConversations1784200000012,
  CreateMessages1784200000013,
  CreateAgentRuns1784200000014,
  AddMessageAgentRunForeignKeys1784200000015,
  CreateActionCards1784200000016,
  CreateExecutionRecords1784200000017,
  CreateReviews1784200000018,
  CreateMemories1784200000019,
  AddPartialIndexesAndChecks1784200000020,
];
