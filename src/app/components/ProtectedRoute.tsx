import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useUser } from '../context/UserContext';
import { toast } from 'sonner';
import { MfaEnrollmentGate } from './MfaEnrollmentGate';
import { usePermissions } from '../hooks/usePermissions';
import { APP_BY_PATH, clientCanBeGrantedApp } from '../../constants/appRegistry';
import { useProjectMembership } from '../hooks/useProjectMembership';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles: string[];
  appName: string;
}

/**
 * ProtectedRoute Component
 * Wraps app routes to enforce role-based access control
 * Prevents unauthorized access even if user has bookmarked or directly navigated to the URL
 */
export function ProtectedRoute({ children, requiredRoles, appName }: ProtectedRouteProps) {
  const { currentUser, loading } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const appId = APP_BY_PATH[location.pathname]?.appId ?? null;
  const allowsProjectMember = appId === 'defect-tracker';
  const { canSeeApp, matrixLoaded } = usePermissions(
    (currentUser?.roles ?? []) as any[],
    currentUser?.permissionOverrides ?? [],
  );
  const { hasProjectMembership, membershipLoaded } = useProjectMembership(allowsProjectMember);
  const allowsMembershipOverride = allowsProjectMember && !currentUser?.roles?.includes('client');
  const checkingAccess = loading || !matrixLoaded || (allowsProjectMember && !membershipLoaded);

  useEffect(() => {
    // Wait for user data to load
    if (checkingAccess) return;

    // Check if user is logged in
    if (!currentUser) {
      toast.error('Authentication Required', {
        description: 'Please login to access this application',
      });
      navigate('/');
      return;
    }

    // SECURITY: Check if user has required roles
    const hasRequiredRole = currentUser.roles?.some(role => 
      requiredRoles.includes(role)
    ) || (
      currentUser.roles?.includes('client')
      && Boolean(appId && clientCanBeGrantedApp(appId) && canSeeApp(appId))
    );
    const hasAppPermission = appId
      ? canSeeApp(appId) || (allowsMembershipOverride && hasProjectMembership)
      : false;

    if (!hasRequiredRole || !hasAppPermission) {
      console.warn(
        `🚫 SECURITY: Blocked unauthorized access to ${appName}`,
        `\n   User: ${currentUser.name} (${currentUser.email})`,
        `\n   User roles: ${currentUser.roles?.join(', ')}`,
        `\n   Required roles: ${requiredRoles.join(', ')}`
      );

      toast.error('Access Denied', {
        description: `You don't have permission to access ${appName}. Required roles: ${requiredRoles.join(', ')}`,
        duration: 6000,
      });

      navigate('/403');
      return;
    }

    // Log successful access for audit purposes
    console.log(
      `✅ SECURITY: Granted access to ${appName}`,
      `\n   User: ${currentUser.name}`,
      `\n   User role: ${currentUser.roles?.[0]}`
    );
  }, [
    allowsMembershipOverride,
    appId,
    appName,
    canSeeApp,
    checkingAccess,
    currentUser,
    hasProjectMembership,
    navigate,
    requiredRoles,
  ]);

  // Show loading state while checking authorization
  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Only render children if user has required roles
  const hasAccess = currentUser?.roles?.some(role => 
    requiredRoles.includes(role)
  ) || (
    currentUser?.roles?.includes('client')
    && Boolean(appId && clientCanBeGrantedApp(appId) && canSeeApp(appId))
  );

  const hasVisibleAppAccess = Boolean(
    appId &&
    (canSeeApp(appId) || (allowsMembershipOverride && hasProjectMembership))
  );

  if (!hasAccess || !hasVisibleAppAccess) {
    return null; // Will redirect in useEffect
  }

  // MFA enforcement: admin has force_mfa=true but user hasn't enrolled yet
  if (currentUser?.forceMfa && !currentUser?.mfaEnrolled) {
    return <MfaEnrollmentGate userEmail={currentUser.email} />;
  }

  return <>{children}</>;
}
