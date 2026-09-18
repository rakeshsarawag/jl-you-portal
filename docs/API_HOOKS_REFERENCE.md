# 🔧 Portal Jeshan Labs - API Hooks Reference

**Quick Reference Guide for Using React Hooks**

---

## 📖 **HOW TO USE**

### **Basic Pattern**

```typescript
import { useSomeData } from '../hooks/useSomeData';

function MyComponent() {
  const {
    data,
    loading,
    error,
    fetchData,
    createData,
    updateData,
    deleteData,
  } = useSomeData();

  useEffect(() => {
    // Data is fetched automatically on mount
  }, []);

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {data.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  );
}
```

---

## 🎯 **ALL AVAILABLE HOOKS**

### **1. useRecruitmentData**
```typescript
import { useRecruitmentData } from '../hooks/useRecruitmentData';

const {
  candidates,
  jobPostings,
  stats,
  loading,
  fetchCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  updateCandidateStage,
  addInterview,
  updateInterview,
  addFeedback,
  fetchJobPostings,
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
} = useRecruitmentData();
```

**Example: Create Candidate**
```typescript
await createCandidate({
  name: 'John Doe',
  email: 'john@email.com',
  phone: '+1234567890',
  position: 'Software Engineer',
  department: 'Engineering',
  source: 'LinkedIn',
  stage: 'Applied',
  skills: ['React', 'Node.js'],
});
```

---

### **2. usePerformanceData**
```typescript
import { usePerformanceData } from '../hooks/usePerformanceData';

const {
  reviews,
  feedback360,
  pips,
  goals,
  stats,
  loading,
  createReview,
  updateReview,
  deleteReview,
  createFeedback360,
  createPIP,
  updatePIP,
  createGoal,
  updateGoal,
} = usePerformanceData();
```

**Example: Create Performance Review**
```typescript
await createReview({
  employeeId: 'emp123',
  employeeName: 'Jane Smith',
  reviewPeriod: 'Q1 2026',
  reviewer: 'Manager Name',
  overallRating: 4.5,
  competencies: [
    { name: 'Leadership', rating: 5, comments: 'Excellent' },
    { name: 'Technical Skills', rating: 4, comments: 'Very good' },
  ],
  strengths: ['Communication', 'Problem solving'],
  areasOfImprovement: ['Time management'],
  goals: ['Lead 2 projects', 'Mentor junior devs'],
});
```

---

### **3. useTrainingData**
```typescript
import { useTrainingData } from '../hooks/useTrainingData';

const {
  courses,
  certificates,
  loading,
  createCourse,
  updateCourse,
  createCertificate,
} = useTrainingData();
```

**Example: Enroll in Course**
```typescript
await updateCourse('course_123', {
  enrolled: true,
  progress: 0,
});
```

**Example: Award Certificate**
```typescript
await createCertificate({
  courseId: 'course_123',
  courseName: 'Advanced React',
  completedDate: '2026-03-15',
  score: 95,
  certificateUrl: 'https://...',
});
```

---

### **4. useITServicesData**
```typescript
import { useITServicesData } from '../hooks/useITServicesData';

const {
  tickets,
  loading,
  createTicket,
  updateTicket,
  addComment,
} = useITServicesData();
```

**Example: Create Ticket**
```typescript
await createTicket({
  title: 'Laptop not working',
  description: 'Screen is blank',
  category: 'Hardware',
  priority: 'High',
});
```

**Example: Add Comment**
```typescript
await addComment('ticket_123', {
  text: 'Looking into this issue now',
  author: 'IT Support',
});
```

---

### **5. useInvoiceData**
```typescript
import { useInvoiceData } from '../hooks/useInvoiceData';

const {
  invoices,
  clients,
  loading,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  createClient,
} = useInvoiceData();
```

**Example: Create Invoice**
```typescript
await createInvoice({
  clientId: 'client_123',
  clientName: 'Acme Corp',
  clientEmail: 'billing@acme.com',
  date: '2026-03-15',
  dueDate: '2026-04-15',
  items: [
    {
      id: '1',
      description: 'Consulting Services',
      quantity: 10,
      rate: 150,
      amount: 1500,
    },
  ],
  subtotal: 1500,
  tax: 270,
  total: 1770,
  status: 'Draft',
});
```

---

### **6. usePayrollData**
```typescript
import { usePayrollData } from '../hooks/usePayrollData';

const {
  payrolls,
  loading,
  createPayroll,
  updatePayroll,
} = usePayrollData();
```

**Example: Process Payroll**
```typescript
await createPayroll({
  employeeId: 'emp_123',
  employeeName: 'John Doe',
  month: 'March',
  year: 2026,
  baseSalary: 5000,
  allowances: [
    { id: '1', name: 'Housing', amount: 1000 },
    { id: '2', name: 'Transport', amount: 500 },
  ],
  deductions: [
    { id: '1', name: 'Tax', amount: 800 },
    { id: '2', name: 'Insurance', amount: 200 },
  ],
  status: 'Draft',
});
```

---

### **7. useProjectData**
```typescript
import { useProjectData } from '../hooks/useProjectData';

const {
  projects,
  loading,
  createProject,
  updateProject,
  deleteProject,
  addTask,
} = useProjectData();
```

**Example: Create Project**
```typescript
await createProject({
  name: 'Website Redesign',
  description: 'Redesign company website',
  status: 'Planning',
  priority: 'High',
  startDate: '2026-04-01',
  endDate: '2026-06-30',
  team: [
    { id: '1', name: 'John Doe', role: 'Project Lead' },
    { id: '2', name: 'Jane Smith', role: 'Designer' },
  ],
});
```

**Example: Add Task**
```typescript
await addTask('project_123', {
  title: 'Design mockups',
  description: 'Create initial design mockups',
  status: 'To Do',
  priority: 'High',
  assignee: 'Jane Smith',
  dueDate: '2026-04-15',
});
```

---

### **8. useAssetData**
```typescript
import { useAssetData } from '../hooks/useAssetData';

const {
  assets,
  loading,
  createAsset,
  updateAsset,
  addMaintenance,
} = useAssetData();
```

**Example: Register Asset**
```typescript
await createAsset({
  name: 'MacBook Pro',
  category: 'Hardware',
  serialNumber: 'MBP-2023-001',
  purchaseDate: '2023-01-15',
  purchasePrice: 2500,
  currentValue: 1800,
  status: 'Available',
  location: 'Warehouse',
});
```

**Example: Schedule Maintenance**
```typescript
await addMaintenance('asset_123', {
  date: '2026-04-01',
  type: 'Scheduled',
  description: 'Annual inspection',
  cost: 100,
  status: 'Pending',
});
```

---

### **9. useOKRData**
```typescript
import { useOKRData } from '../hooks/useOKRData';

const {
  okrs,
  loading,
  createOKR,
  updateOKR,
  addProgressUpdate,
} = useOKRData();
```

**Example: Create OKR**
```typescript
await createOKR({
  title: 'Increase Revenue',
  description: 'Grow company revenue by 50%',
  owner: 'CEO',
  type: 'Company',
  quarter: 'Q2',
  year: 2026,
  status: 'Active',
  keyResults: [
    {
      id: 'kr1',
      title: 'Acquire 100 new customers',
      description: 'Focus on enterprise clients',
      target: 100,
      current: 25,
      unit: 'customers',
      progress: 25,
      status: 'On Track',
      updates: [],
    },
  ],
});
```

**Example: Update Progress**
```typescript
await addProgressUpdate('okr_123', 'kr1', {
  value: 35,
  notes: 'Added 10 new customers this week',
});
```

---

### **10. useDirectoryData**
```typescript
import { useDirectoryData } from '../hooks/useDirectoryData';

const {
  employees,
  departments,
  loading,
  createEmployee,
  updateEmployee,
} = useDirectoryData();
```

**Example: Add Employee**
```typescript
await createEmployee({
  name: 'John Doe',
  email: 'john.doe@company.com',
  phone: '+1234567890',
  department: 'Engineering',
  designation: 'Senior Developer',
  location: 'New York',
  joinDate: '2026-03-15',
  skills: ['React', 'Node.js', 'TypeScript'],
  status: 'Active',
});
```

---

### **11. useKnowledgeBaseData**
```typescript
import { useKnowledgeBaseData } from '../hooks/useKnowledgeBaseData';

const {
  articles,
  categories,
  loading,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  likeArticle,
  searchArticles,
} = useKnowledgeBaseData();
```

**Example: Create Article**
```typescript
await createArticle({
  title: 'How to Use the Portal',
  content: '## Getting Started\n\n...',
  category: 'Tutorials',
  tags: ['onboarding', 'guide'],
  author: 'Admin',
  status: 'Published',
});
```

**Example: Search Articles**
```typescript
const results = await searchArticles('react hooks');
```

**Example: Like Article**
```typescript
await likeArticle('article_123');
```

---

## 🎨 **COMMON PATTERNS**

### **Loading State**
```typescript
if (loading) {
  return <div>Loading...</div>;
}
```

### **Error Handling**
```typescript
if (error) {
  return <div>Error: {error}</div>;
}
```

### **Create with Toast**
```typescript
import { toast } from 'sonner';

const handleCreate = async () => {
  try {
    await createItem(newData);
    toast.success('Created successfully!');
  } catch (err) {
    toast.error('Failed to create');
  }
};
```

### **Update with Optimistic UI**
```typescript
const handleUpdate = async (id: string, updates: Partial<Item>) => {
  // Optimistically update UI
  setItems(prev => prev.map(item => 
    item.id === id ? { ...item, ...updates } : item
  ));
  
  try {
    await updateItem(id, updates);
  } catch (err) {
    // Revert on error
    fetchItems();
    toast.error('Update failed');
  }
};
```

### **Delete with Confirmation**
```typescript
const handleDelete = async (id: string) => {
  if (confirm('Are you sure?')) {
    try {
      await deleteItem(id);
      toast.success('Deleted successfully');
    } catch (err) {
      toast.error('Delete failed');
    }
  }
};
```

---

## 🔍 **DEBUGGING TIPS**

### **Check Network Tab**
- Open Browser DevTools → Network
- Filter by "make-server"
- Check request/response

### **Console Logging**
```typescript
const { data, loading } = useSomeData();

useEffect(() => {
  console.log('Data:', data);
  console.log('Loading:', loading);
}, [data, loading]);
```

### **Error Logging**
All hooks log errors to console:
```
Error fetching items: [error details]
```

---

## ⚡ **PERFORMANCE TIPS**

### **1. Memoize Callbacks**
```typescript
const handleUpdate = useCallback(async (id, updates) => {
  await updateItem(id, updates);
}, [updateItem]);
```

### **2. Avoid Re-fetching**
```typescript
// ❌ Bad: Fetches on every render
useEffect(() => {
  fetchData();
});

// ✅ Good: Fetches once on mount
useEffect(() => {
  fetchData();
}, [fetchData]);
```

### **3. Use Local State for UI**
```typescript
const [localData, setLocalData] = useState(data);

// Update local state immediately
const handleChange = (id, value) => {
  setLocalData(prev => ...);
  // Then sync to server
  updateItem(id, value);
};
```

---

## 📚 **TYPE DEFINITIONS**

All hooks export their types:

```typescript
import type { 
  Candidate, 
  Interview, 
  Feedback 
} from '../hooks/useRecruitmentData';

import type { 
  PerformanceReview, 
  PIP, 
  Goal 
} from '../hooks/usePerformanceData';

// Use in your components
const review: PerformanceReview = {...};
```

---

## 🛠️ **TROUBLESHOOTING**

### **Data not loading?**
1. Check network requests in DevTools
2. Verify API endpoint is correct
3. Check authentication headers
4. Look for console errors

### **Updates not persisting?**
1. Check response from API
2. Verify data format matches interface
3. Check for errors in console
4. Ensure hook is calling correct endpoint

### **Hook not updating UI?**
1. Verify state is being set
2. Check if component is re-rendering
3. Ensure dependencies are correct in useEffect
4. Check if data is actually changing

---

## 📝 **BEST PRACTICES**

1. **Always handle errors**
   ```typescript
   try {
     await createItem(data);
   } catch (err) {
     // Handle error
   }
   ```

2. **Show loading states**
   ```typescript
   {loading && <Spinner />}
   ```

3. **Provide user feedback**
   ```typescript
   toast.success('Saved!');
   ```

4. **Validate before submitting**
   ```typescript
   if (!data.name) {
     toast.error('Name is required');
     return;
   }
   ```

5. **Use TypeScript types**
   ```typescript
   const data: Candidate = {...};
   ```

---

**Last Updated:** March 15, 2026  
**Version:** 1.0

For more information, see `/docs/progress/COMPLETION_SUMMARY.md`
