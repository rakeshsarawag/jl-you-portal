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
import projectBacklogApi from "./project-backlog-api.tsx";
import projectDefectsApi from "./project-defects-api.tsx";
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
import adminApi from "./admin-api.tsx";
import defectTrackerApi from "./defect-tracker-api.tsx";

const app = new Hono();
const base = "/make-server-1fe2c468";

app.use("*", logger(console.log));

app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "apikey", "x-user-email"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
app.route(`${base}/projects`, projectBacklogApi);
app.route(`${base}/projects`, projectDefectsApi);
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
app.route(`${base}/admin`, adminApi);
app.route(`${base}/defect-tracker`, defectTrackerApi);
app.route("/", lifecycleApi);

Deno.serve(app.fetch);
