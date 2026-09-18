/**
 * SectionGuard — conditionally renders children based on section permissions.
 * Uses usePermissions with the current user's roles from context.
 *
 * Usage:
 *   <SectionGuard appId="directory" sectionId="edit_profiles">
 *     <EditButton />
 *   </SectionGuard>
 *
 * Renders null (or `fallback`) when the user's role does not have the section
 * enabled in role_permissions.
 */

import { ReactNode } from 'react';
import { useUser } from '../context/UserContext';
import { usePermissions } from '../hooks/usePermissions';

interface Props {
  appId: string;
  sectionId: string;
  /** Rendered when permission denied — defaults to null */
  fallback?: ReactNode;
  children: ReactNode;
}

export function SectionGuard({ appId, sectionId, fallback = null, children }: Props) {
  const { currentUser } = useUser();
  const roles = (currentUser?.roles ?? ['employee']) as any[];
  const { canSeeSection } = usePermissions(roles, currentUser?.permissionOverrides ?? []);

  if (!canSeeSection(appId, sectionId)) return <>{fallback}</>;
  return <>{children}</>;
}

/** Inline hook version — use when you need the boolean without wrapping JSX */
export function useSectionPermission(appId: string, sectionId: string): boolean {
  const { currentUser } = useUser();
  const roles = (currentUser?.roles ?? ['employee']) as any[];
  const { canSeeSection } = usePermissions(roles, currentUser?.permissionOverrides ?? []);
  return canSeeSection(appId, sectionId);
}
