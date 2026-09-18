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

# ── 1. Write config.toml ──────────────────────────────────────────────────────
echo ""
echo "→ Writing supabase/config.toml..."
cat > supabase/config.toml << EOF
[project]
id = "${PROJECT_REF}"

[functions.${FUNCTION_NAME}]
verify_jwt = false
EOF
echo "  Done."

# ── 2. Build the function bundle folder ───────────────────────────────────────
echo ""
echo "→ Building function bundle at ${DEST}..."
rm -rf "${DEST}"
mkdir -p "${DEST}"

# Copy every file from server/ into the bundle (skip index.tsx — we write index.ts below)
for f in "${SRC}"/*.tsx; do
  name="$(basename "$f")"
  [[ "$name" == "index.tsx" ]] && continue
  cp "$f" "${DEST}/$name"
done
cp "${SRC}"/*.ts "${DEST}/" 2>/dev/null || true

echo "  Files bundled:"
ls "${DEST}"
echo "  Done."

# ── 3. Patch index.ts — remove kv_store import, wire all API routes ───────────
echo ""
echo "→ Patching index.ts with all API routes..."
cat > "${DEST}/index.ts" << 'INDEXEOF'
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

import directoryApi from "./directory-api.tsx";
import usersApi from "./users.ts";
import recruitmentApi from "./recruitment-api.tsx";
import onboardingApi from "./onboarding-api.tsx";
import employeeDashboardApi from "./employee-dashboard-api.tsx";
import performanceApi from "./performance-api.tsx";
import trainingApi from "./training-api.tsx";
import itServicesApi from "./it-services-api.tsx";
import payrollApi from "./payroll-api.tsx";
import invoiceApi from "./invoice-api.tsx";
import projectManagementApi from "./project-management-api.tsx";
import assetApi from "./asset-api.tsx";
import okrApi from "./okr-api.tsx";
import knowledgeApi from "./knowledge-api.tsx";
import masterDataApi from "./master-data-api.tsx";
import permissionsApi from "./permissions.ts";
import communicationsApi from "./communications-api.tsx";
import { linkedinApp } from "./linkedin-api.tsx";
import notificationsApi from "./notifications-api.tsx";
import pushApi from "./push-api.tsx";
import workflowApi from "./workflow-api.tsx";
import employeeApi from "./employee-api.tsx";
import lifecycleApi from "./lifecycle-api.tsx";
import demoDataApi from "./demo-data-api.tsx";

const app = new Hono();
const base = "/make-server-1fe2c468";

app.use("*", logger(console.log));

app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "apikey", "x-user-email"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

app.get(`${base}/health`, (c) =>
  c.json({ status: "ok", version: "2026-08-26-AUDIT-COLUMNS" })
);

app.route(`${base}/directory`, directoryApi);
app.route(`${base}/users`, usersApi);
app.route(`${base}/recruitment`, recruitmentApi);
app.route(`${base}/onboarding`, onboardingApi);
app.route(`${base}/employee-dashboard`, employeeDashboardApi);
app.route(`${base}/performance`, performanceApi);
app.route(`${base}/training`, trainingApi);
app.route(`${base}/it-services`, itServicesApi);
app.route(`${base}/payroll`, payrollApi);
app.route(`${base}/invoices`, invoiceApi);
app.route(`${base}/projects`, projectManagementApi);
app.route(`${base}/assets`, assetApi);
app.route(`${base}/okr`, okrApi);
app.route(`${base}/knowledge`, knowledgeApi);
app.route(`${base}/master-data`, masterDataApi);
app.route(`${base}/permissions`, permissionsApi);
app.route(`${base}/communications`, communicationsApi);
app.route(`${base}/linkedin`, linkedinApp);
app.route(`${base}/notifications`, notificationsApi);
app.route(`${base}/push`, pushApi);
app.route(`${base}/workflow`, workflowApi);
app.route(`${base}/employees`, employeeApi);
app.route(`${base}/demo`, demoDataApi);
app.route("/", lifecycleApi);

Deno.serve(app.fetch);
INDEXEOF
echo "  Done."

# ── 4. Deploy edge function ───────────────────────────────────────────────────
echo ""
echo "→ Deploying edge function '${FUNCTION_NAME}'..."
${SUPABASE_CMD} functions deploy "${FUNCTION_NAME}" --project-ref "${PROJECT_REF}" --no-verify-jwt
echo "  Deployed!"

# ── 5. Verify health endpoint ─────────────────────────────────────────────────
echo ""
echo "→ Verifying health endpoint..."
HEALTH_URL="https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}/health"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}")
if [ "${HTTP_STATUS}" = "200" ]; then
  echo "  ✓ Health check passed (HTTP ${HTTP_STATUS})"
  echo "  URL: ${HEALTH_URL}"
else
  echo "  ✗ Health check returned HTTP ${HTTP_STATUS}"
  echo "  URL: ${HEALTH_URL}"
  echo "  Check logs: ${SUPABASE_CMD} functions logs ${FUNCTION_NAME} --project-ref ${PROJECT_REF}"
  exit 1
fi

echo ""
echo "=========================================="
echo " Deploy complete!"
echo "=========================================="
