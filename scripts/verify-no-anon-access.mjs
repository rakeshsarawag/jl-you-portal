#!/usr/bin/env node

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_ANON_KEY before running this security check.",
  );
  process.exit(2);
}

const functionBase =
  `${supabaseUrl.replace(/\/$/, "")}/functions/v1/make-server-1fe2c468`;

const functionPaths = [
  "/health",
  "/directory/employees",
  "/users",
  "/recruitment/candidates",
  "/onboarding/employees",
  "/employee-dashboard/holidays",
  "/performance/reviews",
  "/training/courses",
  "/it-services/tickets",
  "/payroll/records",
  "/invoices/all",
  "/projects/all",
  "/assets/all",
  "/okr/objectives",
  "/knowledge/articles",
  "/master-data/all",
  "/permissions",
  "/communications/announcements",
  "/notifications",
  "/workflow/definitions",
  "/employees/all",
  "/audit-logs",
];

const failures = [];

async function expectDenied(label, url, headers = {}) {
  const response = await fetch(url, { headers, redirect: "manual" });
  if (response.status !== 401 && response.status !== 403) {
    failures.push(`${label}: expected 401/403, received ${response.status}`);
  } else {
    console.log(`PASS ${label} (${response.status})`);
  }
}

for (const path of functionPaths) {
  await expectDenied(`no token ${path}`, `${functionBase}${path}`);
  await expectDenied(`anon token ${path}`, `${functionBase}${path}`, {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  });
}

const restUrl =
  `${supabaseUrl.replace(/\/$/, "")}/rest/v1/employees?select=id&limit=1`;
await expectDenied("anon REST employees", restUrl, {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
});

if (failures.length) {
  console.error("\nAnonymous-access security check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nAll checked application endpoints reject anonymous access.");
