#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="icmexriwtsjwpswexyrb"
FUNCTION_NAME="make-server-1fe2c468"
SRC="supabase/functions/server"
DEST="supabase/functions/${FUNCTION_NAME}"

# ── Load credentials from .env.local if present ───────────────────────────────
if [ -f ".env.local" ]; then
  # Export only SUPABASE_* vars from .env.local
  set -a
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    [[ "$key" =~ ^SUPABASE_ ]] && export "$key=$value"
  done < <(grep -v '^#' .env.local | grep -v '^$')
  set +a
  echo "  Loaded credentials from .env.local"
fi

# Ensure supabase CLI is available (fallback to npx)
if ! command -v supabase &>/dev/null; then
  SUPABASE_CMD="npx --yes supabase"
else
  SUPABASE_CMD="supabase"
fi

echo "=========================================="
echo " Supabase Deploy Script"
echo " Project: ${PROJECT_REF}"
echo " Function: ${FUNCTION_NAME}"
echo "=========================================="

# ── 1. Build the function bundle folder ───────────────────────────────────────
echo ""
echo "→ Building function bundle at ${DEST}..."
rm -rf "${DEST}"
mkdir -p "${DEST}"

# Copy the canonical server implementation. index.tsx is an obsolete Make stub;
# index.ts is the authenticated production entry point.
for f in "${SRC}"/*.tsx; do
  name="$(basename "$f")"
  [[ "$name" == "index.tsx" ]] && continue
  cp "$f" "${DEST}/$name"
done
cp "${SRC}"/*.ts "${DEST}/" 2>/dev/null || true

echo "  Files bundled:"
ls "${DEST}"
echo "  Done."

# ── 2. Deploy edge function with gateway JWT verification enabled ─────────────
echo ""
echo "→ Deploying edge function '${FUNCTION_NAME}'..."
${SUPABASE_CMD} functions deploy "${FUNCTION_NAME}" --project-ref "${PROJECT_REF}"
echo "  Deployed!"

# ── 3. Verify unauthenticated requests are denied ──────────────────────────────
echo ""
echo "→ Verifying anonymous access is blocked..."
HEALTH_URL="https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}/health"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}")
if [ "${HTTP_STATUS}" = "401" ] || [ "${HTTP_STATUS}" = "403" ]; then
  echo "  Anonymous request correctly denied (HTTP ${HTTP_STATUS})"
  echo "  URL: ${HEALTH_URL}"
else
  echo "  SECURITY FAILURE: anonymous request returned HTTP ${HTTP_STATUS}" >&2
  echo "  URL: ${HEALTH_URL}"
  echo "  Check logs: ${SUPABASE_CMD} functions logs ${FUNCTION_NAME} --project-ref ${PROJECT_REF}"
  exit 1
fi

echo ""
echo "=========================================="
echo " Deploy complete!"
echo "=========================================="
