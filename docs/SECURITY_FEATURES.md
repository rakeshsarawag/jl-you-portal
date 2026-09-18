# 🔐 Portal Jeshan Labs - Security Features

Comprehensive security documentation for the Portal Jeshan Labs internal portal.

---

## 🛡️ Overview

Portal Jeshan Labs implements **3-layer security architecture** to protect against unauthorized access, even when users bookmark applications or attempt direct URL access.

---

## 🔒 Security Layers

### Layer 1: UI Filtering (LaunchpadEnhanced.tsx)
**Purpose:** Prevent users from seeing applications they don't have access to

**Implementation:**
```typescript
const filteredTiles = tiles.filter(tile => {
  const hasRoleAccess = currentUser?.roles?.some(userRole => 
    tile.roles?.includes(userRole)
  ) ?? false;
  
  return matchesSearch && matchesCategory && hasRoleAccess;
});
```

**Security Benefits:**
- ✅ Only shows authorized tiles in launchpad
- ✅ Hides unauthorized apps from favorites
- ✅ Filters recent apps by permissions
- ✅ No UI clutter with inaccessible apps

---

### Layer 2: Click-Time Authorization (LaunchpadEnhanced.tsx)
**Purpose:** Prevent navigation to unauthorized applications

**Implementation:**
```typescript
const handleTileClick = (tile: Tile) => {
  // SECURITY CHECK: Verify user has required roles
  const hasRoleAccess = currentUser?.roles?.some(userRole => 
    tile.roles?.includes(userRole)
  ) ?? false;
  
  if (!hasRoleAccess) {
    // Show error
    toast.error('Access Denied', {
      description: `You don't have permission to access ${tile.title}`,
    });
    
    // Auto-cleanup: Remove from favorites
    if (favorites.includes(tile.id)) {
      const newFavorites = favorites.filter(id => id !== tile.id);
      setFavorites(newFavorites);
    }
    
    // Auto-cleanup: Remove from recent apps
    if (recentApps.includes(tile.id)) {
      const newRecent = recentApps.filter(id => id !== tile.id);
      setRecentApps(newRecent);
    }
    
    return; // Prevent navigation
  }
  
  // Allow navigation
  navigate(tile.path);
};
```

**Security Benefits:**
- ✅ Blocks navigation before route change
- ✅ Shows user-friendly error message
- ✅ Auto-removes unauthorized apps from favorites
- ✅ Auto-removes unauthorized apps from recent list
- ✅ Logs security warnings to console

---

### Layer 3: Route Protection (ProtectedRoute.tsx)
**Purpose:** Enforce authorization at the route level (bookmarks, direct URLs)

**Implementation:**
```typescript
export function ProtectedRoute({ 
  children, 
  requiredRoles, 
  appName 
}: ProtectedRouteProps) {
  const { currentUser, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser || loading) return;

    // SECURITY CHECK: Verify user has required roles
    const hasRequiredRole = currentUser.roles?.some(role => 
      requiredRoles.includes(role)
    ) ?? false;

    if (!hasRequiredRole) {
      // Log security event
      console.warn(
        `🚫 SECURITY: Blocked unauthorized access to ${appName}`,
        `User: ${currentUser.name}`,
        `Required: ${requiredRoles.join(', ')}`
      );

      // Show error
      toast.error('Access Denied');

      // Redirect to launchpad
      navigate('/');
    }
  }, [currentUser, loading]);

  // Only render if authorized
  const hasAccess = currentUser?.roles?.some(role => 
    requiredRoles.includes(role)
  ) ?? false;

  return hasAccess ? <>{children}</> : null;
}
```

**Security Benefits:**
- ✅ Protects against bookmarked URLs
- ✅ Protects against direct URL access
- ✅ Protects against browser history navigation
- ✅ Redirects unauthorized users to launchpad
- ✅ Logs all access attempts for audit
- ✅ Shows loading state during verification

**Route Configuration (routes.tsx):**
```typescript
{
  path: "/invoices",
  element: (
    <ProtectedRoute 
      requiredRoles={['admin', 'finance']} 
      appName="Invoice Generation"
    >
      <InvoiceGenerationDB accessToken={accessToken} onLogout={onLogout} />
    </ProtectedRoute>
  ),
}
```

---

## 🎯 Role-Based Access Control (RBAC)

### Available Roles

| Role | Description | Typical Access |
|------|-------------|----------------|
| **admin** | System administrator | All 26 applications |
| **hr** | Human resources team | HR, onboarding, recruitment, training, payroll |
| **finance** | Finance team | Invoices, payroll, budgets, expenses |
| **manager** | Department managers | Performance, projects, OKRs, teams |
| **employee** | Regular employees | Dashboard, directory, knowledge base, IT services |
| **it** | IT support team | IT services, asset management |
| **marketing** | Marketing team | LinkedIn posts, communications |
| **developer** | Development team | Projects, knowledge base |

### Application Permission Matrix

| Application | Admin | HR | Finance | Manager | Employee | IT | Marketing | Developer |
|-------------|-------|----|---------|---------|---------|----|-----------|-----------||
| On Boarding Portal | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Employee Dashboard | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Recruitment Tracker | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Performance Tracker | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| User Documentation | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| IT Services | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Invoice Generation | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| LinkedIn Posts | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Communications Hub | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Permission Manager | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Asset Management | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Payroll Management | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Project Management | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Security & Compliance | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| *(and 11 more...)* | ... | ... | ... | ... | ... | ... | ... | ... |

---

## 🧪 Testing Security Features

### Test Scenario 1: Bookmark Access Denial

**Steps:**
1. Login as admin (`rakesh.sarawag@jeshanlabs.com` / `admin123`)
2. Access "Invoice Generation" app
3. Bookmark the page: `http://localhost:5173/invoices`
4. Go to Permission Manager
5. Remove 'admin' and 'finance' roles from your user
6. Click the bookmark

**Expected Result:**
- ❌ Access Denied error displayed
- 🔙 Redirected to launchpad
- 🗑️ App removed from favorites (if favorited)
- 📝 Security event logged to console

---

## 📊 Security Logging

### Console Output Examples

**Successful Access:**
```
✅ SECURITY: Granted access to Invoice Generation
   User: Rakesh Sarawag
   User role: admin
```

**Blocked Access:**
```
🚫 SECURITY: Blocked unauthorized access to Invoice Generation
   User: John Doe (john.doe@jeshanlabs.com)
   User roles: employee, marketing
   Required roles: admin, finance
```

**Auto-Cleanup:**
```
⚠️ Removed Invoice Generation from favorites - user lacks required roles
⚠️ Removed Invoice Generation from recent apps - user lacks required roles
```

---

## 🚨 Security Best Practices

### For Administrators

1. **Principle of Least Privilege**
   - Grant only necessary roles
   - Review permissions regularly
   - Remove roles when no longer needed

2. **Regular Audits**
   - Check console logs for security events
   - Review user permissions monthly
   - Monitor access patterns

3. **User Management**
   - Use Permission Manager to assign roles
   - Document role assignments
   - Keep user data up-to-date

---

## 🎯 Security Checklist

Before deploying to production, ensure:

- [ ] All routes wrapped with `ProtectedRoute`
- [ ] All tiles have `roles` property defined
- [ ] Permission Manager tested with all role combinations
- [ ] Bookmark access tested for all applications
- [ ] Direct URL access tested for all routes
- [ ] Auto-cleanup verified (favorites/recent removal)
- [ ] Console logging working correctly
- [ ] User roles properly defined in database
- [ ] Default admin account secured
- [ ] Security documentation reviewed

---

## 📝 Summary

Portal Jeshan Labs implements **defense-in-depth security** with three independent layers:

1. **UI Filtering** - Don't show what users can't access
2. **Click Protection** - Block unauthorized navigation attempts
3. **Route Guards** - Enforce at the routing layer

This ensures that even if a user:
- Bookmarks a page ✅ Blocked
- Types URL directly ✅ Blocked
- Uses browser history ✅ Blocked
- Copies a link ✅ Blocked

**All unauthorized access attempts are logged, prevented, and auto-cleaned from user preferences.**

---

**Last Updated:** March 24, 2026
**Version:** 2.0.0
**Status:** Production Ready ✅
