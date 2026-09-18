# Portal Jeshan Labs - Data Architecture

## 🎯 Overview

This document describes the **centralized data architecture** for Portal Jeshan Labs, ensuring all applications share data seamlessly with no duplication or hardcoding.

## 🏗️ Architecture Principles

1. **Single Source of Truth**: All employee/user data is stored in ONE centralized location
2. **No Hardcoded Data**: All data persists in the database via Supabase KV Store
3. **Cross-App Data Sharing**: All applications access the same employee/user records
4. **Metadata Pattern**: App-specific data is stored as metadata within employee records

## 📊 Centralized Employee API

### Endpoint: `/make-server-1fe2c468/employee/*`

All applications **MUST** use this centralized API for employee data.

### Key Features:
- ✅ Single employee record shared across ALL apps
- ✅ App-specific metadata storage (onboarding, performance, payroll, etc.)
- ✅ Full CRUD operations
- ✅ Search and filtering capabilities
- ✅ Department and role-based queries
- ✅ Statistics and analytics
- ✅ Activity logging

### Employee Data Model:

```typescript
interface Employee {
  id: string;
  email: string;
  name: string;
  department: string;
  position: string;
  roles: string[];
  primaryRole: string;
  status: 'active' | 'inactive' | 'on-leave' | 'terminated';
  phoneNumber?: string;
  location?: string;
  manager?: string;
  hireDate: string;
  salary?: number;
  photo?: string;
  
  // App-specific metadata
  metadata?: {
    onboarding?: {
      status: string;
      completedTasks: number;
      totalTasks: number;
    };
    performance?: {
      rating: number;
      lastReview: string;
    };
    training?: {
      completedCourses: number;
      certifications: string[];
    };
    payroll?: {
      accountNumber: string;
      taxId: string;
    };
    okr?: {
      currentGoals: number;
      completedGoals: number;
    };
  };
  
  createdAt: string;
  updatedAt: string;
}
```

## 🔄 How Apps Should Use Employee Data

### ❌ WRONG (Don't Do This):
```typescript
// Creating separate employee lists per app
const key = `payroll_employees_${userId}`;
const employees = await kv.get(key);
```

### ✅ CORRECT (Do This Instead):
```typescript
// Get employees from centralized API
const response = await fetch(`${API_BASE}/employee`);
const { data: employees } = await response.json();

// Update app-specific metadata
await fetch(`${API_BASE}/employee/${employeeId}/metadata`, {
  method: 'PATCH',
  body: JSON.stringify({
    appName: 'payroll',
    data: {
      accountNumber: '123456',
      taxId: 'TX-789'
    }
  })
});
```

## 📁 Data Organization

### Before (❌ Fragmented):
```
directory_employees_admin  → [employee list]
payroll_employees_admin    → [different employee list]
recruitment_candidates     → [separate candidates]
performance_employees      → [another employee list]
```

### After (✅ Centralized):
```
employee_emp_123456        → Single employee record
employee_emp_789012        → Single employee record
employee_emp_345678        → Single employee record

All apps read from the same records!
```

## 🛠️ Available Endpoints

### Employee Management
- `GET /employee` - Get all employees
- `GET /employee/:id` - Get specific employee
- `GET /employee/search/:query` - Search employees
- `GET /employee/department/:dept` - Filter by department
- `GET /employee/role/:role` - Filter by role
- `POST /employee` - Create employee
- `PUT /employee/:id` - Update employee
- `PATCH /employee/:id/metadata` - Update app-specific data
- `DELETE /employee/:id` - Delete employee (soft delete)

### Statistics
- `GET /employee/stats/overview` - Get employee statistics

### Demo Data
- `POST /employee/demo/populate` - Populate demo employees

## 🔗 Cross-App Data Sharing Examples

### Example 1: Onboarding → Directory
When an employee is created in Onboarding:
```typescript
// Onboarding creates employee
POST /employee
{
  name: "John Doe",
  email: "john@jeshanlabs.com",
  department: "Engineering",
  metadata: {
    onboarding: {
      status: "in-progress",
      completedTasks: 2,
      totalTasks: 10
    }
  }
}

// Employee Directory automatically sees the same employee
// No need to sync or duplicate!
```

### Example 2: Performance → Payroll
Performance ratings affect compensation:
```typescript
// Performance app updates metadata
PATCH /employee/emp_123/metadata
{
  appName: "performance",
  data: {
    rating: 4.5,
    lastReview: "2026-03-15"
  }
}

// Payroll app reads the same employee record
GET /employee/emp_123
// Response includes performance.rating in metadata

// Payroll can use this for bonus calculations
```

### Example 3: Training → OKR
Training completion contributes to OKR goals:
```typescript
// Training app updates completions
PATCH /employee/emp_456/metadata
{
  appName: "training",
  data: {
    completedCourses: 12,
    certifications: ["AWS", "Azure"]
  }
}

// OKR app tracks this as a goal
GET /employee/emp_456
// Response includes training data
// OKR app calculates goal progress automatically
```

## 🚀 Migration Path

### Step 1: Use Centralized API
All apps have been updated to use the centralized employee API at `/employee/*`.

### Step 2: Populate Initial Data
Run the demo data population:
```
POST /make-server-1fe2c468/employee/demo/populate
```

### Step 3: Verify Data Sharing
1. Create an employee in Employee Directory
2. Check if the same employee appears in Payroll Management
3. Update performance in Performance Tracker
4. Verify the update reflects in Employee Dashboard

## 📋 Data Keys Reference

### Centralized Employee Data
- `employee_*` - All employee records (SINGLE SOURCE OF TRUTH)

### App-Specific Data (NOT Employee Records)
- `onboarding_tasks_*` - Onboarding task templates
- `recruitment_candidates_*` - Job candidates (not yet employees)
- `training_courses_*` - Course catalog
- `it_tickets_*` - IT support tickets
- `project_*` - Project data
- `asset_*` - Company assets
- `okr_objectives_*` - OKR objectives
- `invoice_*` - Invoice records
- `knowledge_articles_*` - Knowledge base articles

### System Data
- `tiles` - Dashboard tiles configuration
- `announcements` - System announcements
- `comm_*` - Communications hub data
- `user_management_*` - User management system
- `permissions_*` - Permission rules
- `activity_*` - Activity logs

## ✅ Benefits

1. **No Duplicate Data**: Employee created once, available everywhere
2. **Automatic Sync**: Changes in one app immediately visible in all apps
3. **Data Consistency**: Single source of truth prevents conflicts
4. **Reduced Complexity**: Apps don't manage their own employee lists
5. **Better Analytics**: Cross-app reporting becomes trivial
6. **Easier Maintenance**: Update employee data in one place

## 🎯 Next Steps

1. ✅ Centralized Employee API created
2. ✅ Server routes mounted
3. 🔄 Update frontend apps to use new API (in progress)
4. 🔄 Add data synchronization utilities
5. 🔄 Create admin dashboard for employee management

## 📝 Important Notes

- The centralized employee API is now the **ONLY** way to manage employee/user data
- All legacy app-specific employee stores (`directory_employees_*`, `payroll_employees_*`) should be migrated
- Use the `metadata` field for app-specific information
- Always use the REST API, never directly access KV store for employee data
- Demo data is available via `POST /employee/demo/populate`

---

**Last Updated**: March 16, 2026
**Version**: 1.0
**Status**: ✅ Active
