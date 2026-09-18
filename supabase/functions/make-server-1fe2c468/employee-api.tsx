/**
 * CENTRALIZED EMPLOYEE API
 * Single source of truth for all employee data across all applications
 * All apps MUST use this API for employee/user data
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

export interface Employee {
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
  
  // Additional metadata for different apps
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

// ============= EMPLOYEE CRUD OPERATIONS =============

// Get all employees (centralized)
app.get('/all', async (c) => {
  try {
    const employees = await kv.getByPrefix('employee_') as Employee[];
    console.log(`Fetched ${employees.length} employees from centralized store`);
    return c.json(employees || []);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return c.json({ error: 'Failed to fetch employees' }, 500);
  }
});

// Get employee by ID
app.get('/:id', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const employee = await kv.get(`employee_${employeeId}`) as Employee;
    
    if (!employee) {
      return c.json({ error: 'Employee not found' }, 404);
    }
    
    return c.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    return c.json({ error: 'Failed to fetch employee' }, 500);
  }
});

// Create employee
app.post('/create', async (c) => {
  try {
    const body = await c.req.json();
    
    // Check if email already exists
    const allEmployees = await kv.getByPrefix('employee_') as Employee[];
    const existingEmployee = allEmployees.find((emp: Employee) => emp.email === body.email);
    
    if (existingEmployee) {
      return c.json({ error: 'Employee with this email already exists' }, 409);
    }
    
    const now = new Date().toISOString();
    const newEmployee: Employee = {
      id: body.id || `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: body.email,
      name: `${body.firstName || ''} ${body.lastName || ''}`.trim() || body.name,
      department: body.department || 'General',
      position: body.position || body.jobTitle || 'Employee',
      roles: body.roles || ['employee'],
      primaryRole: body.primaryRole || body.roles?.[0] || 'employee',
      status: body.status || 'active',
      phoneNumber: body.phoneNumber || body.phone,
      location: body.location,
      manager: body.manager,
      hireDate: body.hireDate || body.startDate || now,
      salary: body.salary,
      photo: body.photo,
      metadata: body.metadata || {},
      createdAt: now,
      updatedAt: now,
    };
    
    await kv.set(`employee_${newEmployee.id}`, newEmployee);
    console.log(`Created employee: ${newEmployee.id} - ${newEmployee.name}`);
    
    return c.json(newEmployee);
  } catch (error) {
    console.error('Error creating employee:', error);
    return c.json({ error: 'Failed to create employee' }, 500);
  }
});

// Update employee
app.post('/update', async (c) => {
  try {
    const body = await c.req.json();
    const employeeId = body.id;
    
    if (!employeeId) {
      return c.json({ error: 'Employee ID is required' }, 400);
    }
    
    const existing = await kv.get(`employee_${employeeId}`) as Employee;
    if (!existing) {
      return c.json({ error: 'Employee not found' }, 404);
    }
    
    const updated: Employee = {
      ...existing,
      ...body,
      id: employeeId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...existing.metadata,
        ...body.metadata,
      },
    };
    
    await kv.set(`employee_${employeeId}`, updated);
    console.log(`Updated employee: ${employeeId} - ${updated.name}`);
    
    return c.json(updated);
  } catch (error) {
    console.error('Error updating employee:', error);
    return c.json({ error: 'Failed to update employee' }, 500);
  }
});

// Delete employee
app.delete('/:id', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const hardDelete = c.req.query('hard') === 'true';
    
    const existing = await kv.get(`employee_${employeeId}`) as Employee;
    if (!existing) {
      return c.json({ error: 'Employee not found' }, 404);
    }
    
    if (hardDelete) {
      await kv.del(`employee_${employeeId}`);
      console.log(`Hard deleted employee: ${employeeId}`);
    } else {
      const updated: Employee = {
        ...existing,
        status: 'terminated',
        updatedAt: new Date().toISOString(),
      };
      await kv.set(`employee_${employeeId}`, updated);
      console.log(`Soft deleted (terminated) employee: ${employeeId}`);
    }
    
    return c.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return c.json({ error: 'Failed to delete employee' }, 500);
  }
});

export default app;