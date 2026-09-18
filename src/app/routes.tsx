import React from "react";
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { APP_BY_PATH } from "../constants/appRegistry";
import { UserRole } from "../types/rbac";

// Heavy page components — loaded lazily so the initial bundle stays small
const Launchpad = React.lazy(() => import("./components/LaunchpadEnhanced").then(m => ({ default: m.Launchpad })));
const OnboardingPortalDB = React.lazy(() => import("./components/apps/OnboardingPortalEnhancedV2").then(m => ({ default: m.OnboardingPortalDB })));
const EmployeeDashboard = React.lazy(() => import("./components/apps/EmployeeDashboardEnhancedV2").then(m => ({ default: m.EmployeeDashboard })));
const RecruitmentTracker = React.lazy(() => import("./components/apps/RecruitmentTrackerEnhancedV3").then(m => ({ default: m.RecruitmentTracker })));
const PerformanceTrackerEnhancedV2 = React.lazy(() => import("./components/apps/PerformanceTrackerEnhancedV2").then(m => ({ default: m.PerformanceTrackerEnhancedV2 })));
const ITServicesDB = React.lazy(() => import("./components/apps/ITServicesEnhancedV2").then(m => ({ default: m.ITServicesDB })));
const InvoiceGenerationSystem = React.lazy(() => import("./components/apps/InvoiceGenerationSystem").then(m => ({ default: m.InvoiceGenerationSystem })));
const LinkedInPostManager = React.lazy(() => import("./components/apps/LinkedInPostManagerEnhanced").then(m => ({ default: m.LinkedInPostManager })));
const UserManagement = React.lazy(() => import("./components/apps/UserManagement").then(m => ({ default: m.UserManagement })));
const PermissionManager = React.lazy(() => import("./components/apps/PermissionManagerSuperEnhanced").then(m => ({ default: m.PermissionManager })));
const CommunicationsHubDB = React.lazy(() => import("./components/apps/InternalCommunicationsHubEnhanced").then(m => ({ default: m.CommunicationsHubDB })));
const UnifiedAnalyticsDashboard = React.lazy(() => import("./components/analytics/UnifiedAnalyticsDashboard").then(m => ({ default: m.UnifiedAnalyticsDashboard })));
const WorkflowDashboard = React.lazy(() => import("./components/workflows/WorkflowDashboard").then(m => ({ default: m.WorkflowDashboard })));
const SecurityComplianceDashboard = React.lazy(() => import("./components/security/SecurityComplianceDashboard"));
const AdvancedFeaturesDashboard = React.lazy(() => import("./components/advanced/AdvancedFeaturesDashboard").then(m => ({ default: m.AdvancedFeaturesDashboard })));
const UserDocumentationEnhanced = React.lazy(() => import("./components/apps/UserDocumentationEnhanced").then(m => ({ default: m.UserDocumentationEnhanced })));
const TrainingTrackerEnhanced = React.lazy(() => import("./components/apps/TrainingTrackerEnhanced").then(m => ({ default: m.TrainingTrackerEnhanced })));
const PayrollManagementEnhanced = React.lazy(() => import("./components/apps/PayrollManagementEnhanced").then(m => ({ default: m.PayrollManagementEnhanced })));
const ProjectManagementJira = React.lazy(() => import("./components/apps/ProjectManagementJira").then(m => ({ default: m.ProjectManagementJira })));
const AssetManagementEnhanced = React.lazy(() => import("./components/apps/AssetManagementEnhanced").then(m => ({ default: m.AssetManagementEnhanced })));
const OKRManagementEnhanced = React.lazy(() => import("./components/apps/OKRManagementEnhanced").then(m => ({ default: m.OKRManagementEnhanced })));
const EmployeeDirectoryEnhanced = React.lazy(() => import("./components/apps/EmployeeDirectoryEnhanced").then(m => ({ default: m.EmployeeDirectoryEnhanced })));
const MasterDataManagementExpanded = React.lazy(() => import("./components/apps/MasterDataManagementExpanded").then(m => ({ default: m.MasterDataManagementExpanded })));
const DefectTrackerApp = React.lazy(() => import("./components/apps/DefectTrackerApp").then(m => ({ default: m.DefectTrackerApp })));
const ValidationReferencePage = React.lazy(() => import("./components/apps/ValidationReferencePage"));
const PreboardingPortal = React.lazy(() => import("./components/apps/PreboardingPortal"));
const NotificationHistoryPage = React.lazy(() => import("./components/NotificationHistoryPage"));
const NotificationPreferencesPage = React.lazy(() => import("./components/NotificationPreferencesPage"));

const PageSpinner = (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
);

function Suspense({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={PageSpinner}>{children}</React.Suspense>;
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <span className="text-3xl">🔒</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
      <p className="text-gray-600 mb-6">{"You don't have permission to view this page."}</p>
      <a href="/dashboard" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm">Back to Dashboard</a>
    </div>
  );
}

interface RouteParams {
  accessToken: string;
  onLogout: () => void;
}

/** Pull required roles from the single APP_REGISTRY source of truth */
function roles(path: string): UserRole[] {
  return (APP_BY_PATH[path]?.requiredRoles ?? []) as UserRole[];
}

export const createAppRouter = ({ accessToken, onLogout }: RouteParams) => {
  return createBrowserRouter([
    // Public routes — no auth required
    {
      path: "/403",
      element: <AccessDenied />,
    },
    {
      path: "/preboarding",
      element: <Suspense><PreboardingPortal /></Suspense>,
    },
    {
      path: "/notifications",
      element: <Suspense><NotificationHistoryPage /></Suspense>,
    },
    {
      path: "/notifications/preferences",
      element: <Suspense><NotificationPreferencesPage /></Suspense>,
    },
    {
      element: <RootLayout accessToken={accessToken} onLogout={onLogout} />,
      errorElement: <ErrorBoundary />,
      children: [
        {
          path: "/",
          element: <Suspense><Launchpad accessToken={accessToken} onLogout={onLogout} /></Suspense>,
        },
        {
          path: "/onboarding",
          element: (
            <ProtectedRoute requiredRoles={roles("/onboarding")} appName="Onboarding Portal">
              <Suspense><OnboardingPortalDB accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/dashboard",
          element: (
            <ProtectedRoute requiredRoles={roles("/dashboard")} appName="Employee Dashboard">
              <Suspense><EmployeeDashboard accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/recruitment",
          element: (
            <ProtectedRoute requiredRoles={roles("/recruitment")} appName="Recruitment Tracker">
              <Suspense><RecruitmentTracker accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/performance",
          element: (
            <ProtectedRoute requiredRoles={roles("/performance")} appName="Performance Tracker">
              <Suspense><PerformanceTrackerEnhancedV2 accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/documentation",
          element: (
            <ProtectedRoute requiredRoles={roles("/documentation")} appName="Documentation">
              <Suspense><UserDocumentationEnhanced accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/it-services",
          element: (
            <ProtectedRoute requiredRoles={roles("/it-services")} appName="IT Services">
              <Suspense><ITServicesDB accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/invoices",
          element: (
            <ProtectedRoute requiredRoles={roles("/invoices")} appName="Invoice Management">
              <Suspense><InvoiceGenerationSystem accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/linkedin",
          element: (
            <ProtectedRoute requiredRoles={roles("/linkedin")} appName="LinkedIn Post Manager">
              <Suspense><LinkedInPostManager accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/communications",
          element: (
            <ProtectedRoute requiredRoles={roles("/communications")} appName="Communications Hub">
              <Suspense><CommunicationsHubDB accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/user-management",
          element: (
            <ProtectedRoute requiredRoles={roles("/user-management")} appName="User Management">
              <Suspense><UserManagement accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/permissions",
          element: (
            <ProtectedRoute requiredRoles={roles("/permissions")} appName="Permission Manager">
              <Suspense><PermissionManager accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/executive-dashboard",
          element: (
            <ProtectedRoute requiredRoles={roles("/executive-dashboard")} appName="Analytics Dashboard">
              <Suspense><UnifiedAnalyticsDashboard accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/workflow-dashboard",
          element: (
            <ProtectedRoute requiredRoles={roles("/workflow-dashboard")} appName="Workflow Dashboard">
              <Suspense><WorkflowDashboard accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/advanced-analytics",
          element: (
            <ProtectedRoute requiredRoles={roles("/advanced-analytics")} appName="Analytics Dashboard">
              <Suspense><UnifiedAnalyticsDashboard accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/security-compliance",
          element: (
            <ProtectedRoute requiredRoles={roles("/security-compliance")} appName="Security & Compliance">
              <Suspense><SecurityComplianceDashboard accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/advanced-features",
          element: (
            <ProtectedRoute requiredRoles={roles("/advanced-features")} appName="Advanced Features">
              <Suspense><AdvancedFeaturesDashboard accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/training",
          element: (
            <ProtectedRoute requiredRoles={roles("/training")} appName="Training & Learning">
              <Suspense><TrainingTrackerEnhanced accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/payroll",
          element: (
            <ProtectedRoute requiredRoles={roles("/payroll")} appName="Payroll Management">
              <Suspense><PayrollManagementEnhanced accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/projects",
          element: (
            <ProtectedRoute requiredRoles={roles("/projects")} appName="Project Management">
              <Suspense><ProjectManagementJira accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/defect-tracker",
          element: (
            <ProtectedRoute requiredRoles={roles("/defect-tracker")} appName="Defect Tracker">
              <Suspense><DefectTrackerApp accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/assets",
          element: (
            <ProtectedRoute requiredRoles={roles("/assets")} appName="Asset Management">
              <Suspense><AssetManagementEnhanced accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/okr",
          element: (
            <ProtectedRoute requiredRoles={roles("/okr")} appName="OKR Management">
              <Suspense><OKRManagementEnhanced accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/directory",
          element: (
            <ProtectedRoute requiredRoles={roles("/directory")} appName="Employee Directory">
              <Suspense><EmployeeDirectoryEnhanced accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/master-data",
          element: (
            <ProtectedRoute requiredRoles={roles("/master-data")} appName="Master Data">
              <Suspense><MasterDataManagementExpanded accessToken={accessToken} onLogout={onLogout} /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: "/validation-patterns",
          element: <Suspense><ValidationReferencePage /></Suspense>,
        },
        {
          path: "*",
          element: <ErrorBoundary />,
        },
      ],
    },
  ]);
};
