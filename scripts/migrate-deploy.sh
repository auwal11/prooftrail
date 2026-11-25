#!/bin/sh
set -eu

# The first production rollout of this migration used a malformed SQL file and
# left Prisma's migration ledger in a failed state. Resolve only that known
# failed migration; on fresh databases or already-repaired databases Prisma
# safely reports that there is nothing to resolve.
FAILED_MIGRATION="20261125090000_extraction_state"
npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION" >/tmp/prooftrail-migrate-resolve.log 2>&1 || true
cat /tmp/prooftrail-migrate-resolve.log

exec npx prisma migrate deploy
