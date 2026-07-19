#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 127
  fi
}

run_step() {
  local label="$1"
  shift
  echo
  echo "==> ${label}"
  "$@"
}

require_command pnpm
require_command flutter
require_command git

run_step "API coverage" bash -lc "cd '${ROOT_DIR}/apps/api' && pnpm test:coverage"
run_step "API typecheck" bash -lc "cd '${ROOT_DIR}/apps/api' && pnpm typecheck"
run_step "API build" bash -lc "cd '${ROOT_DIR}/apps/api' && pnpm build"
run_step "API OpenAPI generation" bash -lc "cd '${ROOT_DIR}/apps/api' && pnpm generate:openapi"

run_step "Admin coverage" bash -lc "cd '${ROOT_DIR}/apps/admin' && pnpm test:coverage"
run_step "Admin typecheck" bash -lc "cd '${ROOT_DIR}/apps/admin' && pnpm typecheck"
run_step "Admin build" bash -lc "cd '${ROOT_DIR}/apps/admin' && pnpm build"

run_step "Flutter tests" bash -lc "cd '${ROOT_DIR}/apps/client' && flutter test"
run_step "Flutter analyze" bash -lc "cd '${ROOT_DIR}/apps/client' && flutter analyze"

run_step "Whitespace check" git -C "${ROOT_DIR}" diff --check

echo
echo "Release verification completed."
