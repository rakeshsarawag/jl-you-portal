# Portal Jeshan Labs - Architecture & Data Flow

## 🎯 Overview

Portal Jeshan Labs is a **fully integrated enterprise portal** where all 26 applications share data through a centralized Supabase database. **NO hardcoded data** - everything is dynamic and configurable.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND APPLICATIONS                     │
│  (26 Applications - All using centralized data services)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              CENTRALIZED DATA SERVICE LAYER                  │
│  • dataService.ts - All API calls                           │
│  • useSharedData.ts - React hooks for data access           │
│  • useDatabasePersistence.ts - Auto-save/load               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  SUPABASE EDGE FUNCTIONS                     │
│  • employee-api.tsx - Employee CRUD                          │
│  • recruitment-api.tsx - Recruitment data                    │
│  • onboarding-api.tsx - Onboarding tasks                     │
│  • payroll-api.tsx - Payroll records                         │
│  • project-api.tsx - Projects & tasks                        │
│  • training-api.tsx - Training enrollments                   │
│  • asset-api.tsx - Asset management                          │
│  • it-services-api.tsx - IT tickets                          │
│  • master-data-api.tsx - Master data                         │
│  • lifecycle-api.tsx - Employee lifecycle                    │
│  ... and 14 more APIs                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  SUPABASE KV STORE                           │
│              (PostgreSQL Database Backend)                   │
│                                                              │
│  Keys Pattern:                                               │
│  • employee_{id} - Employee records                          │
│  • recruitment:candidate:{id} - Candidates                   │
│  • onboarding:employee:{id} - Onboarding data               │
│  • payroll:employee:{id} - Payroll records                  │
│  • asset:{id} - Assets                                       │
│  • training:enrollment:{id} - Training data                 │
│  • project:{id} - Projects                                   │
│  • ticket:{id} - IT tickets                                  │
│  • master-data:{category} - Master data                      │
│  • value-helps:config - Dropdown options                     │
│  • lifecycle:employee:{id} - Lifecycle tracking             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Examples

### Example 1: Employee Lifecycle

```
1. RECRUITMENT APP
   ├─ Create candidate
   ├─ Interview stages
   └─ Hire decision
          ↓
2. ONBOARDING APP (Auto-created when hired)
   ├─ Tasks checklist
   ├─ Documents to sign
   └─ Completion tracking
          ↓
3. EMPLOYEE DIRECTORY (Auto-added)
   ├─ Profile visible to all
   ├─ Department listing
   └─ Contact information
          ↓
4. ASSET MANAGEMENT (Auto-assigns)
   ├─ Laptop assignment
   ├─ Phone assignment
   └─ Equipment tracking
          ↓
5. PAYROLL SYSTEM (Auto-creates record)
   ├─ Salary details
   ├─ Bank information
   └─ Monthly processing
          ↓
6. PROJECT MANAGEMENT (Manager assigns)
   ├─ Project allocation
   ├─ Task assignments
   └─ Time tracking
```

**All steps persist to database and share the same employee ID!**

### Example 2: Master Data Propagation

```
1. MASTER DATA MANAGEMENT
   ├─ Add new department: "AI Research"
   └─ Save to database: master-data:departments
          ↓
2. DATA SERVICE refreshes cache
   └─ Triggers: window.dispatchEvent('masterDataUpdated')
          ↓
3. ALL APPS AUTO-UPDATE (using hooks)
   ├─ Recruitment: Job posting dropdown
   ├─ Onboarding: Department selection
   ├─ Employee Directory: Department filter
   ├─ Payroll: Department grouping
   └─ Projects: Resource allocation
```

**One change propagates to all 26 applications instantly!**

---

## 🔧 How to Use (For Developers)

### 1. Fetch Data in Any App

```typescript
import DataService from '../services/dataService';

// Get all employees
const employees = await DataService.getEmployees();

// Get dropdown options from master data
const departments = await DataService.getMasterData('departments');

// Create new employee
const newEmployee = await DataService.createEmployee({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  department: 'Engineering',
  jobTitle: 'Software Engineer'
});
```

### 2. Use Shared Data Hooks

```typescript
import { useValueHelps, useMasterData, useEmployeeOptions } from '../hooks/useSharedData';

function MyComponent() {
  // Get dropdown options from Value Helps Manager
  const { getOptions } = useValueHelps();
  const departmentOptions = getOptions('departments');
  
  // Get master data for a category
  const { data: clients, loading } = useMasterData('clients');
  
  // Get employees for dropdown
  const { options: employeeOptions } = useEmployeeOptions();
  
  return (
    <Select>
      {employeeOptions.map(emp => (
        <option key={emp.value} value={emp.value}>
          {emp.label}
        </option>
      ))}
    </Select>
  );
}
```

### 3. Master Data Integration

```typescript
// Components automatically re-render when master data changes
import { useMasterDataOptions } from '../hooks/useSharedData';

function DepartmentDropdown() {
  const { options, loading } = useMasterDataOptions('departments');
  
  // Options come from database, configurable in Master Data Management
  // No hardcoded values!
  
  if (loading) return <Spinner />;
  
  return (
    <Select>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </Select>
  );
}
```

---

## 📋 Data Synchronization

### When an employee is hired in Recruitment:

```typescript
// Automatically creates records in all systems
await DataService.syncEmployeeToAllSystems({
  id: 'emp-123',
  firstName: 'Sarah',
  lastName: 'Johnson',
  email: 'sarah@company.com',
  department: 'Engineering',
  jobTitle: 'Senior Developer'
});

// This creates:
// ✅ Employee record (employee_emp-123)
// ✅ Onboarding tasks (onboarding:employee:emp-123)
// ✅ Directory entry (directory:employee:emp-123)
// ✅ Payroll record (payroll:employee:emp-123)
// ✅ User account (user:emp-123)
```

---

## 🗂️ Master Data Categories

All configurable through **Master Data Management** app:

### HR & People
- **clients** - Customer information
- **departments** - Organizational units
- **job-titles** - Position titles
- **locations** - Office locations

### Performance & Training
- **performance-metrics** - Review criteria
- **training-courses** - Available courses
- **certifications** - Certification types

### Finance
- **salary-components** - Salary breakdown
- **benefits** - Employee benefits
- **invoice-templates** - Invoice formats
- **tax-rates** - Tax configurations
- **payment-terms** - Payment schedules

### Operations
- **service-categories** - IT service types
- **ticket-types** - Support ticket categories
- **asset-types** - Equipment categories
- **vendors** - Supplier information

### Projects
- **project-categories** - Project types
- **task-types** - Task classifications
- **priority-levels** - Priority settings

### Content & Communication
- **document-types** - Document categories
- **knowledge-categories** - Wiki sections
- **communication-channels** - Channels list
- **workflow-templates** - Process templates

---

## 🎨 Value Helps (Dropdowns)

Managed through **Value Helps Manager**:

1. **Status Values** - Active, Inactive, Pending, Completed
2. **Priority Levels** - Low, Medium, High, Critical
3. **Departments** - All organizational departments
4. **Job Titles** - All position titles
5. **Locations** - All office locations
6. **Project Status** - Planning, Active, On Hold, Completed
7. **Task Status** - To Do, In Progress, Done
8. **Training Status** - Not Started, In Progress, Completed
9. **Ticket Status** - Open, In Progress, Resolved, Closed
10. **Asset Status** - Available, Assigned, Under Repair, Retired
11. **Performance Ratings** - Exceeds, Meets, Needs Improvement
12. **Document Types** - Policy, Procedure, Guide, Template

**All dropdowns are configurable - no hardcoding!**

---

## 🔄 Real-Time Updates

Components listen for data changes:

```typescript
// Master Data Context automatically updates all components
useEffect(() => {
  const handleUpdate = () => {
    // Refetch data when master data changes
    loadData();
  };
  
  window.addEventListener('masterDataUpdated', handleUpdate);
  return () => window.removeEventListener('masterDataUpdated', handleUpdate);
}, []);
```

---

## 🚀 Employee Lifecycle Demo

The **Employee Lifecycle Demo** showcases the complete integration:

1. **Recruitment** → Create candidate
2. **Hiring** → Convert to employee
3. **Onboarding** → Setup tasks
4. **Login** → Account creation
5. **Directory** → Profile visible
6. **Assets** → Equipment assigned
7. **IT Services** → Support tickets
8. **Training** → Course enrollments
9. **Projects** → Task assignments
10. **Payroll** → Salary setup
11. **Exit** → Offboarding process

**Every step saves to database and connects to other apps!**

---

## 📊 Database Keys Structure

```
employee_{id}                          → Employee master record
recruitment:candidate:{id}             → Candidate in recruitment
onboarding:employee:{id}               → Onboarding progress
payroll:employee:{id}                  → Payroll configuration
asset:{id}                             → Asset details
training:enrollment:{id}               → Training enrollment
project:{id}                           → Project details
project:assignment:{employeeId}        → Project assignments
ticket:{id}                            → IT support tickets
directory:employee:{id}                → Directory entry
okr:{id}                               → OKR/Goals
knowledge:article:{id}                 → Knowledge articles
master-data:{category}                 → Master data arrays
value-helps:config                     → Dropdown configurations
lifecycle:employee:{id}                → Lifecycle tracking
```

---

## ✅ Zero Hardcoded Data

**Every piece of data comes from the database:**

- ✅ Employee lists → Database
- ✅ Departments → Master Data Management
- ✅ Job titles → Master Data Management
- ✅ Locations → Master Data Management
- ✅ Dropdown options → Value Helps Manager
- ✅ Project data → Projects API
- ✅ Asset data → Assets API
- ✅ Training data → Training API
- ✅ Payroll data → Payroll API

**Configure once, use everywhere!**

---

## 🎯 Benefits

1. **Single Source of Truth** - All apps use same data
2. **Real-Time Sync** - Changes reflect immediately
3. **Configurable** - Admin can modify master data
4. **Scalable** - Easy to add new data types
5. **Consistent** - Same dropdowns across all apps
6. **Traceable** - Complete audit trail
7. **Connected** - Data flows between apps
8. **Persistent** - Survives page refreshes

---

## 🛠️ Adding a New Application

1. Create API endpoint in `/supabase/functions/server/`
2. Add methods to `dataService.ts`
3. Create custom hook in `useSharedData.ts` (if needed)
4. Use `useMasterData` for dropdowns
5. Call `DataService.refreshMasterDataCache()` on updates
6. Listen for `masterDataUpdated` event

**That's it! Your app is now integrated!**

---

## 📞 Support

For questions about the data architecture:
- Check `/src/app/services/dataService.ts` for all available API calls
- Check `/src/app/hooks/useSharedData.ts` for React hooks
- Check `/supabase/functions/server/` for backend APIs
- Use the **Master Data Management** app to configure data
- Use the **Value Helps Manager** to configure dropdowns

---

**Portal Jeshan Labs** - Fully integrated, zero hardcoded data, enterprise-ready! 🚀
