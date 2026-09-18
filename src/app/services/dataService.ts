/**
 * Centralized Data Service
 * All applications use this service to interact with the database
 * No hardcoded data - everything comes from Supabase
 */

import { projectId, publicAnonKey } from '../utils/constants';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468`;

console.log('[DataService] Initialized with:', {
  projectId,
  SERVER_URL,
  anonKeyLength: publicAnonKey?.length
});

// ==================== HELPER FUNCTIONS ====================

async function fetchFromAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${SERVER_URL}${endpoint}`;
  console.log(`[DataService] Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log(`[DataService] Response status for ${endpoint}:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DataService] API Error for ${endpoint}:`, response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[DataService] Success for ${endpoint}:`, data);
    return data;
  } catch (error: any) {
    console.error(`[DataService] Fetch failed for ${endpoint}:`, error);
    console.error(`[DataService] Error details:`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
      url: url
    });
    throw error;
  }
}

async function postToAPI(endpoint: string, data: any) {
  return fetchFromAPI(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function deleteFromAPI(endpoint: string) {
  return fetchFromAPI(endpoint, {
    method: 'DELETE',
  });
}

// ==================== VALUE HELPS (DROPDOWNS) ====================

export async function getValueHelps() {
  return fetchFromAPI('/value-helps/all');
}

export async function getValueHelpOptions(type: string) {
  const result = await fetchFromAPI('/value-helps/all');
  const valueHelp = result.data?.find((vh: any) => vh.type === type);
  return valueHelp?.options || [];
}

export async function saveValueHelps(data: any) {
  return postToAPI('/value-helps/save', data);
}

// Master Data Management functions
export async function getMasterData(category: string) {
  // Fetch directly from the category endpoint which returns array
  return fetchFromAPI(`/master-data/${category}`);
}

export async function saveMasterData(category: string, data: any) {
  return postToAPI('/master-data/save', { key: category, value: data });
}

export async function getAllMasterData() {
  const categories = [
    'clients', 'departments', 'job-titles', 'locations',
    'performance-metrics', 'training-courses', 'salary-components',
    'benefits', 'service-categories', 'ticket-types', 'asset-types',
    'vendors', 'project-categories', 'task-types', 'priority-levels',
    'invoice-templates', 'tax-rates', 'payment-terms',
    'document-types', 'knowledge-categories', 'communication-channels',
    'workflow-templates'
  ];

  const results: Record<string, any> = {};
  
  for (const category of categories) {
    try {
      const data = await getMasterData(category);
      results[category] = data || [];
    } catch (error) {
      console.warn(`Failed to fetch master data for ${category}:`, error);
      results[category] = [];
    }
  }

  return results;
}

// ==================== RECRUITMENT ====================

export async function getRecruitmentCandidates() {
  return fetchFromAPI('/recruitment/candidates');
}

export async function createRecruitmentCandidate(candidate: any) {
  return postToAPI('/recruitment/candidates', candidate);
}

export async function updateRecruitmentCandidate(id: string, candidate: any) {
  return postToAPI('/recruitment/candidates/update', { id, ...candidate });
}

export async function deleteRecruitmentCandidate(id: string) {
  return deleteFromAPI(`/recruitment/candidates/${id}`);
}

export async function getCandidatesReadyForOnboarding() {
  return fetchFromAPI('/recruitment/candidates/ready-for-onboarding');
}

// ==================== ONBOARDING ====================

export async function getOnboardingEmployees() {
  return fetchFromAPI('/onboarding/employees');
}

export async function createOnboardingEmployee(employee: any) {
  return postToAPI('/onboarding/employees', employee);
}

export async function updateOnboardingEmployee(id: string, employee: any) {
  return postToAPI(`/onboarding/employees/${id}`, employee);
}

export async function deleteOnboardingEmployee(id: string) {
  return deleteFromAPI(`/onboarding/employees/${id}`);
}

export async function updateOnboardingTask(employeeId: string, taskId: string, completed: boolean) {
  return postToAPI('/onboarding/tasks/update', { employeeId, taskId, completed });
}

// ==================== EMPLOYEES ====================

export async function getEmployees() {
  try {
    console.log('[DataService] Fetching employees from Employee Directory (onboarding_employees table)...');
    
    // ✅ CENTRALIZED EMPLOYEE DATA: Fetch from Employee Directory (single source of truth)
    // This fetches from the onboarding_employees table in Supabase which is the central employee repository
    const response = await fetchFromAPI('/directory/employees');
    
    // Handle both array and object response formats
    const employees = Array.isArray(response) ? response : (response?.data || []);
    
    console.log(`[DataService] ✅ Fetched ${employees.length} employees from Employee Directory`);
    
    // Filter out inactive employees (optional - can be removed if you want to show all)
    const activeEmployees = employees.filter((emp: any) => emp.status !== 'Inactive');
    console.log(`[DataService] ${activeEmployees.length} active employees (${employees.length - activeEmployees.length} inactive filtered out)`);
    
    return activeEmployees;
  } catch (error) {
    console.error('[DataService] ❌ Error fetching employees from Employee Directory:', error);
    
    // Fallback: Try onboarding API as last resort
    try {
      console.log('[DataService] Attempting fallback to onboarding API...');
      const onboardingEmployees = await fetchFromAPI('/onboarding/employees');
      const employees = Array.isArray(onboardingEmployees) ? onboardingEmployees : [];
      console.log(`[DataService] Fallback successful: ${employees.length} employees`);
      return employees;
    } catch (fallbackError) {
      console.error('[DataService] All employee fetch attempts failed:', fallbackError);
      return [];
    }
  }
}

export async function getEmployee(id: string) {
  return fetchFromAPI(`/employees/${id}`);
}

export async function createEmployee(employee: any) {
  return postToAPI('/employees/create', employee);
}

export async function updateEmployee(id: string, employee: any) {
  return postToAPI('/employees/update', { id, ...employee });
}

export async function deleteEmployee(id: string) {
  return deleteFromAPI(`/employees/${id}`);
}

// ==================== PERFORMANCE ====================

export async function getPerformanceReviews() {
  return fetchFromAPI('/performance/reviews');
}

export async function createPerformanceReview(review: any) {
  return postToAPI('/performance/reviews', review);
}

export async function updatePerformanceReview(id: string, review: any) {
  return postToAPI('/performance/reviews/update', { id, ...review });
}

// ==================== TRAINING ====================

export async function getTrainingEnrollments() {
  return fetchFromAPI('/training/enrollments');
}

export async function createTrainingEnrollment(enrollment: any) {
  return postToAPI('/training/enrollments', enrollment);
}

export async function updateTrainingProgress(id: string, progress: number) {
  return postToAPI('/training/progress', { id, progress });
}

// ==================== IT SERVICES ====================

export async function getITTickets() {
  return fetchFromAPI('/it-services/tickets');
}

export async function createITTicket(ticket: any) {
  return postToAPI('/it-services/tickets', ticket);
}

export async function updateITTicket(id: string, ticket: any) {
  return postToAPI('/it-services/tickets/update', { id, ...ticket });
}

// ==================== INVOICES ====================

export async function getInvoices() {
  return fetchFromAPI('/invoices/all');
}

export async function createInvoice(invoice: any) {
  return postToAPI('/invoices/create', invoice);
}

export async function updateInvoice(id: string, invoice: any) {
  return postToAPI('/invoices/update', { id, ...invoice });
}

// ==================== PAYROLL ====================

export async function getPayrollRecords() {
  return fetchFromAPI('/payroll/records');
}

export async function createPayrollRecord(record: any) {
  return postToAPI('/payroll/records', record);
}

export async function processPayroll(month: string, year: number) {
  return postToAPI('/payroll/process', { month, year });
}

// ==================== PROJECTS ====================

export async function getProjects() {
  return fetchFromAPI('/projects/all');
}

export async function createProject(project: any) {
  return postToAPI('/projects/create', project);
}

export async function updateProject(id: string, project: any) {
  return postToAPI('/projects/update', { id, ...project });
}

export async function getProjectTasks(projectId: string) {
  return fetchFromAPI(`/projects/${projectId}/tasks`);
}

export async function createProjectTask(task: any) {
  return postToAPI('/projects/tasks/create', task);
}

// ==================== ASSETS ====================

export async function getAssets() {
  return fetchFromAPI('/assets/all');
}

export async function createAsset(asset: any) {
  return postToAPI('/assets/create', asset);
}

export async function assignAsset(assetId: string, employeeId: string, employeeName: string) {
  return postToAPI('/assets/assign', { assetId, employeeId, employeeName });
}

export async function returnAsset(assetId: string) {
  return postToAPI('/assets/return', { assetId });
}

// ==================== OKRs ====================

export async function getOKRs() {
  return fetchFromAPI('/okr/all');
}

export async function createOKR(okr: any) {
  return postToAPI('/okr/create', okr);
}

export async function updateOKRProgress(id: string, progress: number) {
  return postToAPI('/okr/progress', { id, progress });
}

// ==================== EMPLOYEE DIRECTORY ====================

export async function getDirectoryEmployees() {
  return fetchFromAPI('/directory/employees');
}

export async function searchDirectory(query: string) {
  return fetchFromAPI(`/directory/search?q=${encodeURIComponent(query)}`);
}

// ==================== KNOWLEDGE BASE ====================

export async function getKnowledgeArticles() {
  return fetchFromAPI('/knowledge/articles');
}

export async function createKnowledgeArticle(article: any) {
  return postToAPI('/knowledge/articles/create', article);
}

export async function updateKnowledgeArticle(id: string, article: any) {
  return postToAPI('/knowledge/articles/update', { id, ...article });
}

// ==================== EMPLOYEE DASHBOARD ====================

// Attendance Management
export async function checkIn(userId: string, userName: string) {
  return postToAPI('/employee-dashboard/attendance/check-in', { userId, userName });
}

export async function checkOut(userId: string) {
  return postToAPI('/employee-dashboard/attendance/check-out', { userId });
}

export async function getAttendance(userId: string) {
  return fetchFromAPI(`/employee-dashboard/attendance/${userId}`);
}

export async function getTodayAttendance(userId: string) {
  return fetchFromAPI(`/employee-dashboard/attendance/today/${userId}`);
}

// Leave Management
export async function applyLeave(leaveData: any) {
  return postToAPI('/employee-dashboard/leaves/apply', leaveData);
}

export async function approveLeave(leaveId: string, approverName: string) {
  return postToAPI('/employee-dashboard/leaves/approve', { leaveId, approverName });
}

export async function rejectLeave(leaveId: string, approverName: string) {
  return postToAPI('/employee-dashboard/leaves/reject', { leaveId, approverName });
}

export async function getLeaves(userId: string) {
  return fetchFromAPI(`/employee-dashboard/leaves/${userId}`);
}

export async function getAllPendingLeaves() {
  return fetchFromAPI('/employee-dashboard/leaves/pending');
}

export async function getLeaveBalance(userId: string) {
  return fetchFromAPI(`/employee-dashboard/leave-balance/${userId}`);
}

export async function initializeLeaveBalance(userId: string, userName: string, userEmail: string) {
  return postToAPI('/employee-dashboard/leave-balance/initialize', { userId, userName, userEmail });
}

// Task Management
export async function getEmployeeTasks(userId: string) {
  return fetchFromAPI(`/employee-dashboard/tasks/${userId}`);
}

export async function createEmployeeTask(task: any) {
  return postToAPI('/employee-dashboard/tasks/create', task);
}

export async function updateEmployeeTask(id: string, task: any) {
  return postToAPI('/employee-dashboard/tasks/update', { id, ...task });
}

export async function deleteEmployeeTask(id: string) {
  return deleteFromAPI(`/employee-dashboard/tasks/${id}`);
}

export async function toggleTaskStatus(id: string) {
  return postToAPI('/employee-dashboard/tasks/toggle-status', { id });
}

// ==================== DEMO DATA INITIALIZATION ====================

export async function initializeDemoData() {
  return postToAPI('/demo-data/initialize', {});
}

export async function clearAllData() {
  return postToAPI('/demo-data/clear', {});
}

// ==================== DATA SYNC ====================

/**
 * When an employee is created in recruitment and hired,
 * sync to other systems
 */
export async function syncEmployeeToAllSystems(employee: any) {
  const employeeData = {
    id: employee.id || `emp-${Date.now()}`,
    firstName: employee.firstName || employee.name?.split(' ')[0] || '',
    lastName: employee.lastName || employee.name?.split(' ').slice(1).join(' ') || '',
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    jobTitle: employee.jobTitle || employee.position,
    location: employee.location,
    startDate: employee.startDate || employee.hireDate,
    status: 'active',
    employeeId: employee.employeeId,
  };

  // Create in all relevant systems
  const results = await Promise.allSettled([
    // Create employee record
    createEmployee(employeeData),
    
    // Create onboarding record
    createOnboardingEmployee({
      ...employeeData,
      employeeName: `${employeeData.firstName} ${employeeData.lastName}`,
    }),
    
    // Add to directory
    postToAPI('/directory/employees', employeeData),
    
    // Initialize payroll
    createPayrollRecord({
      ...employeeData,
      employeeName: `${employeeData.firstName} ${employeeData.lastName}`,
    }),
  ]);

  return results;
}

/**
 * When master data is updated, notify all apps
 */
export async function refreshMasterDataCache() {
  // This will be called when master data is updated
  // Apps can subscribe to this event
  window.dispatchEvent(new CustomEvent('masterDataUpdated'));
}

export const DataService = {
  // Value Helps
  getValueHelps,
  getValueHelpOptions,
  saveValueHelps,
  
  // Master Data
  getMasterData,
  saveMasterData,
  getAllMasterData,
  refreshMasterDataCache,
  
  // Recruitment
  getRecruitmentCandidates,
  createRecruitmentCandidate,
  updateRecruitmentCandidate,
  deleteRecruitmentCandidate,
  getCandidatesReadyForOnboarding,
  
  // Onboarding
  getOnboardingEmployees,
  createOnboardingEmployee,
  updateOnboardingEmployee,
  deleteOnboardingEmployee,
  updateOnboardingTask,
  
  // Employees
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  
  // Performance
  getPerformanceReviews,
  createPerformanceReview,
  updatePerformanceReview,
  
  // Training
  getTrainingEnrollments,
  createTrainingEnrollment,
  updateTrainingProgress,
  
  // IT Services
  getITTickets,
  createITTicket,
  updateITTicket,
  
  // Invoices
  getInvoices,
  createInvoice,
  updateInvoice,
  
  // Payroll
  getPayrollRecords,
  createPayrollRecord,
  processPayroll,
  
  // Projects
  getProjects,
  createProject,
  updateProject,
  getProjectTasks,
  createProjectTask,
  
  // Assets
  getAssets,
  createAsset,
  assignAsset,
  returnAsset,
  
  // OKRs
  getOKRs,
  createOKR,
  updateOKRProgress,
  
  // Directory
  getDirectoryEmployees,
  searchDirectory,
  
  // Knowledge Base
  getKnowledgeArticles,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  
  // Employee Dashboard
  checkIn,
  checkOut,
  getAttendance,
  getTodayAttendance,
  applyLeave,
  approveLeave,
  rejectLeave,
  getLeaves,
  getAllPendingLeaves,
  getLeaveBalance,
  initializeLeaveBalance,
  getEmployeeTasks,
  createEmployeeTask,
  updateEmployeeTask,
  deleteEmployeeTask,
  toggleTaskStatus,
  
  // Demo Data
  initializeDemoData,
  clearAllData,
  
  // Sync
  syncEmployeeToAllSystems,
};

export default DataService;