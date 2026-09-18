import { Hono } from "npm:hono@4";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// ==================== EMPLOYEE LIFECYCLE ====================

// Create demo employee
app.post("/make-server-1fe2c468/lifecycle/employee", async (c) => {
  try {
    const employee = await c.req.json();
    console.log("Creating lifecycle demo employee:", employee.id);
    
    await kv.set(`lifecycle:employee:${employee.id}`, {
      ...employee,
      lifecycleSteps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    return c.json({ success: true, employee });
  } catch (error) {
    console.error("Error creating lifecycle employee:", error);
    return c.json({ error: "Failed to create employee" }, 500);
  }
});

// Get employee lifecycle data
app.get("/make-server-1fe2c468/lifecycle/employee/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const employee = await kv.get(`lifecycle:employee:${id}`);
    
    if (!employee) {
      return c.json({ error: "Employee not found" }, 404);
    }
    
    return c.json(employee);
  } catch (error) {
    console.error("Error fetching lifecycle employee:", error);
    return c.json({ error: "Failed to fetch employee" }, 500);
  }
});

// Mark lifecycle step as complete
app.post("/make-server-1fe2c468/lifecycle/step-complete", async (c) => {
  try {
    const { employeeId, stepId, completedAt } = await c.req.json();
    console.log(`Completing step ${stepId} for employee ${employeeId}`);
    
    const employee = await kv.get(`lifecycle:employee:${employeeId}`);
    
    if (!employee) {
      return c.json({ error: "Employee not found" }, 404);
    }
    
    // Add step completion
    const lifecycleSteps = employee.lifecycleSteps || [];
    lifecycleSteps.push({
      stepId,
      completedAt,
      status: 'completed'
    });
    
    // Update employee status based on step
    let status = employee.status;
    let stage = employee.stage;
    
    switch (stepId) {
      case 'recruitment':
        status = 'hired';
        stage = 'onboarding';
        break;
      case 'onboarding':
        status = 'onboarding';
        stage = 'active-setup';
        break;
      case 'login':
        status = 'active';
        stage = 'active';
        break;
      case 'exit':
        status = 'exited';
        stage = 'completed';
        break;
    }
    
    await kv.set(`lifecycle:employee:${employeeId}`, {
      ...employee,
      lifecycleSteps,
      status,
      stage,
      updatedAt: new Date().toISOString()
    });
    
    // Create records in relevant systems based on step
    await createStepData(employeeId, stepId, employee);
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error completing lifecycle step:", error);
    return c.json({ error: "Failed to complete step" }, 500);
  }
});

// Helper function to create data in various systems
async function createStepData(employeeId: string, stepId: string, employee: any) {
  try {
    switch (stepId) {
      case 'recruitment':
        // Create candidate in recruitment system
        await kv.set(`recruitment:candidate:${employeeId}`, {
          id: employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          position: employee.jobTitle,
          department: employee.department,
          status: 'Hired',
          stage: 'Offer Accepted',
          hireDate: employee.startDate,
          createdAt: new Date().toISOString()
        });
        break;
        
      case 'onboarding':
        // Create onboarding tasks
        await kv.set(`onboarding:employee:${employeeId}`, {
          id: employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          department: employee.department,
          startDate: employee.startDate,
          status: 'In Progress',
          tasksCompleted: 0,
          totalTasks: 12,
          documents: ['Employee Handbook', 'NDA', 'Tax Forms'],
          createdAt: new Date().toISOString()
        });
        break;
        
      case 'login':
        // Create user account
        await kv.set(`user:${employeeId}`, {
          id: employeeId,
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`,
          role: 'employee',
          department: employee.department,
          jobTitle: employee.jobTitle,
          status: 'active',
          createdAt: new Date().toISOString()
        });
        break;
        
      case 'directory':
        // Add to employee directory
        await kv.set(`directory:employee:${employeeId}`, {
          id: employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone,
          department: employee.department,
          jobTitle: employee.jobTitle,
          location: employee.location,
          startDate: employee.startDate,
          status: 'active',
          createdAt: new Date().toISOString()
        });
        break;
        
      case 'assets':
        // Assign assets
        const assets = [
          {
            id: `asset-${Date.now()}-1`,
            employeeId,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            assetName: 'MacBook Pro 16"',
            assetType: 'Laptop',
            serialNumber: 'MBP-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            assignedDate: new Date().toISOString().split('T')[0],
            status: 'Assigned',
            condition: 'New'
          },
          {
            id: `asset-${Date.now()}-2`,
            employeeId,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            assetName: 'iPhone 15 Pro',
            assetType: 'Mobile Phone',
            serialNumber: 'IPH-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            assignedDate: new Date().toISOString().split('T')[0],
            status: 'Assigned',
            condition: 'New'
          }
        ];
        
        for (const asset of assets) {
          await kv.set(`asset:${asset.id}`, asset);
        }
        break;
        
      case 'it-services':
        // Create welcome IT ticket
        await kv.set(`ticket:welcome-${employeeId}`, {
          id: `ticket:welcome-${employeeId}`,
          title: 'New Employee Setup Complete',
          description: 'All systems configured and ready',
          category: 'Onboarding',
          priority: 'Medium',
          status: 'Resolved',
          assignedTo: 'IT Support Team',
          requester: `${employee.firstName} ${employee.lastName}`,
          createdAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString()
        });
        break;
        
      case 'training':
        // Enroll in required training
        const trainings = [
          {
            id: `training-${Date.now()}-1`,
            employeeId,
            courseName: 'Company Orientation',
            status: 'Enrolled',
            progress: 0,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            mandatory: true
          },
          {
            id: `training-${Date.now()}-2`,
            employeeId,
            courseName: 'Security Awareness',
            status: 'Enrolled',
            progress: 0,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            mandatory: true
          }
        ];
        
        for (const training of trainings) {
          await kv.set(`training:enrollment:${training.id}`, training);
        }
        break;
        
      case 'projects':
        // Assign to project
        await kv.set(`project:assignment:${employeeId}`, {
          id: `project-assignment-${Date.now()}`,
          employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          projectName: 'Portal Enhancement Initiative',
          role: 'Team Member',
          allocation: 100,
          startDate: new Date().toISOString().split('T')[0],
          status: 'Active',
          createdAt: new Date().toISOString()
        });
        break;
        
      case 'payroll':
        // Create payroll record
        await kv.set(`payroll:employee:${employeeId}`, {
          id: employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeId: employee.employeeId,
          department: employee.department,
          baseSalary: 120000,
          currency: 'USD',
          paymentFrequency: 'Monthly',
          bankAccount: '****1234',
          taxId: 'XXX-XX-' + Math.floor(Math.random() * 10000),
          status: 'Active',
          createdAt: new Date().toISOString()
        });
        break;
        
      case 'exit':
        // Create exit record
        await kv.set(`exit:employee:${employeeId}`, {
          id: employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          department: employee.department,
          lastWorkingDay: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          exitReason: 'New Opportunity',
          exitType: 'Voluntary',
          assetsReturned: false,
          exitInterviewCompleted: false,
          clearanceStatus: 'Pending',
          createdAt: new Date().toISOString()
        });
        break;
    }
  } catch (error) {
    console.error(`Error creating step data for ${stepId}:`, error);
  }
}

// Get all lifecycle employees
app.get("/make-server-1fe2c468/lifecycle/employees", async (c) => {
  try {
    const employees = await kv.getByPrefix("lifecycle:employee:");
    return c.json(employees || []);
  } catch (error) {
    console.error("Error fetching lifecycle employees:", error);
    return c.json({ error: "Failed to fetch employees" }, 500);
  }
});

// Get lifecycle analytics
app.get("/make-server-1fe2c468/lifecycle/analytics", async (c) => {
  try {
    const employees = await kv.getByPrefix("lifecycle:employee:");
    
    const analytics = {
      totalEmployees: employees?.length || 0,
      byStatus: {} as Record<string, number>,
      byStage: {} as Record<string, number>,
      averageStepsCompleted: 0
    };
    
    if (employees && employees.length > 0) {
      let totalSteps = 0;
      
      employees.forEach((emp: any) => {
        // Count by status
        analytics.byStatus[emp.status] = (analytics.byStatus[emp.status] || 0) + 1;
        
        // Count by stage
        analytics.byStage[emp.stage] = (analytics.byStage[emp.stage] || 0) + 1;
        
        // Sum steps
        totalSteps += emp.lifecycleSteps?.length || 0;
      });
      
      analytics.averageStepsCompleted = totalSteps / employees.length;
    }
    
    return c.json(analytics);
  } catch (error) {
    console.error("Error fetching lifecycle analytics:", error);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
});

export default app;
