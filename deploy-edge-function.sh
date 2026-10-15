#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy the Supabase edge function.
#
# IMPORTANT: Run this from the ROOT of the project (the directory that contains
# the  supabase/  folder). The script deploys whatever code is in
# supabase/functions/server/ on the machine running this script.
#
#   chmod +x deploy-edge-function.sh
#   ./deploy-edge-function.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_REF="icmexriwtsjwpswexyrb"
FUNCTION_NAME="make-server-1fe2c468"
FUNCTION_DIR="supabase/functions/server"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HR Portal — Edge Function Deployer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Pre-check: verify the local source is the SECURE version ──────────────────
echo ""
echo "Checking local source version..."

LOCAL_VERSION=$(grep -o '"version":"[^"]*"' "$FUNCTION_DIR/index.ts" 2>/dev/null || echo "unknown")
echo "  Local index.ts reports: $LOCAL_VERSION"

if echo "$LOCAL_VERSION" | grep -q "SECURE"; then
  echo "  ✓ Local source has SECURE JWT middleware"
else
  echo ""
  echo "  ⚠ WARNING: Local source does NOT contain the SECURE JWT middleware."
  echo "  You may be running from a machine that has an old copy of the code."
  echo ""
  echo "  Expected version string in supabase/functions/server/index.ts:"
  echo "    \"version\":\"2026-10-01-SECURE\""
  echo ""
  echo "  If you see a different version, STOP and sync the latest code"
  echo "  from the Figma Make cloud environment before deploying."
  echo ""
  echo "  Aborting to prevent deploying stale code."
  exit 1
fi

# ── Check if supabase CLI is installed ───────────────────────────────────────
if ! command -v supabase &> /dev/null; then
  echo ""
  echo "ERROR: Supabase CLI not found."
  echo "Install it with:"
  echo "  npm install -g supabase"
  echo "  OR: brew install supabase/tap/supabase"
  exit 1
fi

echo ""
echo "✓ Supabase CLI: $(supabase --version)"

# ── Authenticate ─────────────────────────────────────────────────────────────
echo ""
echo "Checking authentication..."

if ! supabase projects list --output json 2>/dev/null | grep -q "$PROJECT_REF"; then
  echo ""
  echo "Not logged in or session expired. Choose one of:"
  echo ""
  echo "  Option A — browser login (opens a browser window):"
  echo "    supabase login"
  echo ""
  echo "  Option B — Personal Access Token (no browser needed):"
  echo "    1. Go to: https://supabase.com/dashboard/account/tokens"
  echo "    2. Create a new token"
  echo "    3. Run: supabase login --token <your-PAT>"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

echo "✓ Authenticated"

# ── Deploy ────────────────────────────────────────────────────────────────────
echo ""
echo "Deploying $FUNCTION_NAME → project $PROJECT_REF"
echo ""

# Note: --no-verify-jwt tells the CLI NOT to turn on Supabase's gateway-level
# JWT check. We handle JWT verification ourselves in the Hono middleware, which
# gives us the ability to reject the anon key (which Supabase's own verification
# cannot do because the anon key is also a valid signed JWT).
supabase functions deploy "$FUNCTION_NAME" \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Deploy submitted. Verifying..."
echo ""

sleep 3

LIVE_VERSION=$(curl -s \
  "https://$PROJECT_REF.supabase.co/functions/v1/$FUNCTION_NAME/health" | \
  grep -o '"version":"[^"]*"' || echo '"version":"<fetch failed>"')

echo "  Health endpoint now reports: $LIVE_VERSION"
echo ""

if echo "$LIVE_VERSION" | grep -q "SECURE"; then
  echo "  ✓ SECURE version is live. Anon key requests will be rejected."
else
  echo "  ⚠ Version mismatch — the deployed function may still be the old version."
  echo "  Wait 30 seconds and run:"
  echo "  curl https://$PROJECT_REF.supabase.co/functions/v1/$FUNCTION_NAME/health"
fi

echo ""
echo "  Test anon key is blocked (expect 401):"
echo "  curl -H 'Authorization: Bearer <anon-key>' \\"
echo "    https://$PROJECT_REF.supabase.co/functions/v1/$FUNCTION_NAME/projects/all"
echo ""
echo "  Run migration 22 in Supabase SQL Editor to also lock"
echo "  down direct /rest/v1/ access."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
