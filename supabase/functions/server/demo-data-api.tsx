import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Create test users in Supabase Auth
app.post('/create-test-users', async (c) => {
  try {
    console.log('=== CREATE TEST USERS ENDPOINT CALLED ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Supabase URL:', supabaseUrl);
    console.log('Service Role Key present:', !!supabaseServiceRoleKey);
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase configuration');
      return c.json({
        success: false,
        error: 'Server configuration error: Missing Supabase credentials'
      }, 500);
    }
    
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    const testUsers = [
      {
        email: 'rakesh.sarawag@jeshanlabs.com',
        password: 'admin123',
        user_metadata: {
          name: 'Rakesh Sarawag',
          roles: ['admin', 'hr', 'finance', 'manager', 'employee', 'it', 'marketing', 'developer'],
          primaryRole: 'admin',
          department: 'Management',
          position: 'CEO',
          avatar: 'RS'
        }
      },
      {
        email: 'employee@jeshanlabs.com',
        password: 'employee123',
        user_metadata: {
          name: 'Employee User',
          role: 'employee',
          roles: ['employee']
        }
      }
    ];

    const results = [];

    for (const user of testUsers) {
      console.log(`Processing user: ${user.email}`);
      
      // Check if user already exists
      try {
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
          console.error('Error listing users:', listError);
        }
        
        const existingUser = existingUsers?.users?.find(u => u.email === user.email);

        if (existingUser) {
          console.log(`User ${user.email} already exists, updating roles...`);
          
          // Update existing user's metadata with all roles
          const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            {
              user_metadata: user.user_metadata
            }
          );
          
          if (updateError) {
            console.error(`Error updating user ${user.email}:`, updateError);
            results.push({ email: user.email, status: 'update_error', error: updateError.message });
          } else {
            console.log(`User ${user.email} updated successfully with all roles`);
            results.push({ email: user.email, status: 'updated', id: existingUser.id });
            
            // Update BOTH KV stores with new roles
            // Legacy user:id format
            await kv.set(`user:${existingUser.id}`, {
              id: existingUser.id,
              email: user.email,
              name: user.user_metadata.name,
              roles: user.user_metadata.roles,
              primaryRole: user.user_metadata.primaryRole || user.user_metadata.roles[0],
              department: user.user_metadata.department || 'General',
              position: user.user_metadata.position || 'Employee',
              status: 'active'
            });
            console.log(`Updated legacy user metadata in KV for ${user.email} with roles:`, user.user_metadata.roles);
            
            // New user_management_user_ format
            await kv.set(`user_management_user_${existingUser.id}`, {
              id: existingUser.id,
              email: user.email,
              name: user.user_metadata.name,
              roles: user.user_metadata.roles,
              primaryRole: user.user_metadata.primaryRole || user.user_metadata.roles[0],
              department: user.user_metadata.department || 'General',
              position: user.user_metadata.position || 'Employee',
              status: 'active',
              createdAt: existingUser.created_at,
              updatedAt: new Date().toISOString()
            });
            console.log(`Updated user_management metadata in KV for ${user.email} with ALL roles:`, user.user_metadata.roles);
          }
          continue;
        }

        // Create user with auto-confirmed email
        console.log(`Creating user ${user.email}...`);
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          user_metadata: user.user_metadata,
          email_confirm: true // Auto-confirm email since we don't have email server
        });

        if (error) {
          console.error(`Error creating user ${user.email}:`, error);
          results.push({ email: user.email, status: 'error', error: error.message });
        } else {
          console.log(`User ${user.email} created successfully with ID: ${data.user?.id}`);
          results.push({ email: user.email, status: 'created', id: data.user?.id });
          
          // Store user metadata in KV store
          if (data.user) {
            await kv.set(`user:${data.user.id}`, {
              id: data.user.id,
              email: user.email,
              name: user.user_metadata.name,
              roles: user.user_metadata.roles
            });
            console.log(`Stored user metadata in KV for ${user.email}`);
          }
        }
      } catch (userError) {
        console.error(`Exception while processing user ${user.email}:`, userError);
        results.push({ email: user.email, status: 'error', error: userError.message });
      }
    }

    console.log('Test users creation completed:', results);
    
    return c.json({
      success: true,
      message: 'Test users creation completed',
      results
    });
  } catch (error) {
    console.error('Error creating test users:', error);
    return c.json({
      success: false,
      error: 'Failed to create test users',
      details: error.message
    }, 500);
  }
});

// Populate demo data
app.post('/populate', async (c) => {
  try {
    const userId = c.req.header('X-User-Id') || 'admin';
    let count = 0;

    // Demo Employees for Directory
    const demoEmployees = [
      {
        id: 'emp_1',
        name: 'Sarah Johnson',
        title: 'Engineering Manager',
        department: 'Engineering',
        email: 'sarah.johnson@jeshanlabs.com',
        phone: '+1-555-0101',
        location: 'New York, NY',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'emp_2',
        name: 'Michael Chen',
        title: 'Senior Developer',
        department: 'Engineering',
        email: 'michael.chen@jeshanlabs.com',
        phone: '+1-555-0102',
        location: 'San Francisco, CA',
        status: 'remote',
        createdAt: new Date().toISOString()
      },
      {
        id: 'emp_3',
        name: 'Emily Rodriguez',
        title: 'HR Manager',
        department: 'Human Resources',
        email: 'emily.rodriguez@jeshanlabs.com',
        phone: '+1-555-0103',
        location: 'Austin, TX',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'emp_4',
        name: 'David Kim',
        title: 'Product Manager',
        department: 'Product',
        email: 'david.kim@jeshanlabs.com',
        phone: '+1-555-0104',
        location: 'Seattle, WA',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'emp_5',
        name: 'Lisa Anderson',
        title: 'Finance Director',
        department: 'Finance',
        email: 'lisa.anderson@jeshanlabs.com',
        phone: '+1-555-0105',
        location: 'Chicago, IL',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];
    await kv.set(`directory_employees_${userId}`, demoEmployees);
    count += demoEmployees.length;

    // Demo Projects
    const demoProjects = [
      {
        id: 'proj_1',
        name: 'Portal Redesign',
        description: 'Complete redesign of the employee portal interface',
        status: 'active',
        priority: 'high',
        progress: 65,
        startDate: '2026-01-15',
        endDate: '2026-06-30',
        budget: 150000,
        spent: 85000,
        teamMembers: ['Sarah Johnson', 'Michael Chen'],
        tasks: 25,
        completedTasks: 16,
        createdAt: new Date().toISOString()
      },
      {
        id: 'proj_2',
        name: 'Mobile App Development',
        description: 'Native mobile app for iOS and Android',
        status: 'active',
        priority: 'critical',
        progress: 45,
        startDate: '2026-02-01',
        endDate: '2026-08-31',
        budget: 250000,
        spent: 95000,
        teamMembers: ['Michael Chen', 'David Kim'],
        tasks: 40,
        completedTasks: 18,
        createdAt: new Date().toISOString()
      },
      {
        id: 'proj_3',
        name: 'Analytics Dashboard',
        description: 'Real-time analytics and reporting dashboard',
        status: 'planning',
        priority: 'medium',
        progress: 15,
        startDate: '2026-03-01',
        endDate: '2026-09-30',
        budget: 100000,
        spent: 12000,
        teamMembers: ['Sarah Johnson'],
        tasks: 15,
        completedTasks: 2,
        createdAt: new Date().toISOString()
      }
    ];
    await kv.set(`projects_projects_${userId}`, demoProjects);
    count += demoProjects.length;

    // Demo Assets
    const demoAssets = [
      {
        id: 'asset_1',
        name: 'MacBook Pro 16"',
        category: 'Laptop',
        assignedTo: 'Sarah Johnson',
        status: 'assigned',
        purchaseDate: '2025-06-15',
        value: 2999,
        createdAt: new Date().toISOString()
      },
      {
        id: 'asset_2',
        name: 'Dell Monitor 27"',
        category: 'Monitor',
        assignedTo: 'Michael Chen',
        status: 'assigned',
        purchaseDate: '2025-07-20',
        value: 450,
        createdAt: new Date().toISOString()
      },
      {
        id: 'asset_3',
        name: 'iPhone 15 Pro',
        category: 'Phone',
        assignedTo: 'Not Assigned',
        status: 'available',
        purchaseDate: '2025-09-10',
        value: 1199,
        createdAt: new Date().toISOString()
      },
      {
        id: 'asset_4',
        name: 'iPad Pro',
        category: 'Tablet',
        assignedTo: 'David Kim',
        status: 'assigned',
        purchaseDate: '2025-08-05',
        value: 899,
        createdAt: new Date().toISOString()
      }
    ];
    await kv.set(`assets_assets_${userId}`, demoAssets);
    count += demoAssets.length;

    // Demo OKRs
    const demoOKRs = [
      {
        id: 'okr_1',
        objective: 'Increase customer satisfaction and retention',
        keyResults: [
          { title: 'Achieve NPS score of 50+', progress: 75 },
          { title: 'Reduce churn rate to below 5%', progress: 60 },
          { title: 'Increase customer lifetime value by 20%', progress: 45 }
        ],
        owner: 'David Kim',
        quarter: 'Q1 2026',
        status: 'on-track',
        progress: 60,
        createdAt: new Date().toISOString()
      },
      {
        id: 'okr_2',
        objective: 'Scale engineering team and improve velocity',
        keyResults: [
          { title: 'Hire 5 senior engineers', progress: 80 },
          { title: 'Increase deployment frequency by 50%', progress: 90 },
          { title: 'Reduce bug backlog by 30%', progress: 70 }
        ],
        owner: 'Sarah Johnson',
        quarter: 'Q1 2026',
        status: 'on-track',
        progress: 80,
        createdAt: new Date().toISOString()
      },
      {
        id: 'okr_3',
        objective: 'Expand market presence and revenue',
        keyResults: [
          { title: 'Launch in 3 new markets', progress: 33 },
          { title: 'Achieve $5M ARR', progress: 40 },
          { title: 'Sign 10 enterprise clients', progress: 50 }
        ],
        owner: 'Lisa Anderson',
        quarter: 'Q1 2026',
        status: 'at-risk',
        progress: 41,
        createdAt: new Date().toISOString()
      }
    ];
    await kv.set(`okr_okrs_${userId}`, demoOKRs);
    count += demoOKRs.length;

    // Demo Training Courses
    const demoCourses = [
      {
        id: 'course_1',
        title: 'Advanced React & TypeScript',
        description: 'Master modern React patterns and TypeScript best practices',
        category: 'technical',
        level: 'Advanced',
        duration: '6 weeks',
        instructor: 'Sarah Johnson',
        thumbnail: '',
        enrolled: false,
        progress: 0,
        skills: ['React', 'TypeScript', 'Hooks'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'course_2',
        title: 'Leadership Essentials',
        description: 'Develop core leadership and management skills',
        category: 'leadership',
        level: 'Intermediate',
        duration: '4 weeks',
        instructor: 'Emily Rodriguez',
        thumbnail: '',
        enrolled: false,
        progress: 0,
        skills: ['Leadership', 'Communication', 'Team Management'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'course_3',
        title: 'Data Privacy & Compliance',
        description: 'Understanding GDPR, CCPA and data protection',
        category: 'compliance',
        level: 'Beginner',
        duration: '2 weeks',
        instructor: 'Legal Team',
        thumbnail: '',
        enrolled: true,
        progress: 45,
        skills: ['Compliance', 'Legal', 'Privacy'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    await kv.set(`training_courses_${userId}`, demoCourses);
    count += demoCourses.length;

    // Demo Knowledge Base Articles
    const demoArticles = [
      {
        id: 'article_1',
        title: 'Employee Onboarding Guide',
        category: 'HR',
        author: 'Emily Rodriguez',
        createdDate: '2026-01-15',
        updatedDate: '2026-03-10',
        views: 245,
        likes: 34,
        status: 'published',
        tags: ['onboarding', 'hr', 'new-hire'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'article_2',
        title: 'Git Workflow Best Practices',
        category: 'Engineering',
        author: 'Michael Chen',
        createdDate: '2026-02-01',
        updatedDate: '2026-03-12',
        views: 189,
        likes: 42,
        status: 'published',
        tags: ['git', 'development', 'workflow'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'article_3',
        title: 'Expense Report Submission Process',
        category: 'Finance',
        author: 'Lisa Anderson',
        createdDate: '2026-01-20',
        updatedDate: '2026-02-28',
        views: 312,
        likes: 28,
        status: 'published',
        tags: ['finance', 'expenses', 'process'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'article_4',
        title: 'Product Launch Checklist',
        category: 'Product',
        author: 'David Kim',
        createdDate: '2026-03-01',
        updatedDate: '2026-03-15',
        views: 156,
        likes: 19,
        status: 'draft',
        tags: ['product', 'launch', 'checklist'],
        createdAt: new Date().toISOString()
      }
    ];
    await kv.set(`knowledge_articles_${userId}`, demoArticles);
    count += demoArticles.length;

    // Demo Payroll Records
    const demoPayrolls = [
      {
        id: 'payroll_1',
        employeeId: 'emp_1',
        employeeName: 'Sarah Johnson',
        period: 'March 2026',
        baseSalary: 12000,
        bonus: 2000,
        deductions: 1500,
        netPay: 12500,
        status: 'paid',
        payDate: '2026-03-31',
        createdAt: new Date().toISOString()
      },
      {
        id: 'payroll_2',
        employeeId: 'emp_2',
        employeeName: 'Michael Chen',
        period: 'March 2026',
        baseSalary: 10000,
        bonus: 1500,
        deductions: 1200,
        netPay: 10300,
        status: 'processed',
        payDate: '2026-03-31',
        createdAt: new Date().toISOString()
      },
      {
        id: 'payroll_3',
        employeeId: 'emp_3',
        employeeName: 'Emily Rodriguez',
        period: 'March 2026',
        baseSalary: 9500,
        bonus: 1000,
        deductions: 1100,
        netPay: 9400,
        status: 'pending',
        payDate: '2026-03-31',
        createdAt: new Date().toISOString()
      }
    ];
    await kv.set(`payrolls_${userId}`, demoPayrolls);
    count += demoPayrolls.length;

    return c.json({ 
      success: true, 
      message: 'Demo data populated successfully',
      count 
    });
  } catch (error) {
    console.error('Error populating demo data:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to populate demo data',
      details: error.message 
    }, 500);
  }
});

// Reset/clear demo data
app.post('/reset', async (c) => {
  try {
    console.log('=== RESET DEMO DATA ENDPOINT CALLED ===');
    const userId = c.req.header('X-User-Id') || 'admin';
    let clearedCount = 0;

    // List of all data keys to clear
    const dataKeys = [
      `directory_employees_${userId}`,
      `projects_projects_${userId}`,
      `assets_assets_${userId}`,
      `okr_okrs_${userId}`,
      `training_courses_${userId}`,
      `knowledge_articles_${userId}`,
      `payrolls_${userId}`,
      `onboarding_steps_${userId}`,
      `candidates_${userId}`,
      `performance_reviews_${userId}`,
      `it_tickets_${userId}`,
      `invoices_${userId}`,
      `communications_${userId}`,
      `workflows_${userId}`,
      // Master data keys
      `master_data_clients`,
      `master_data_departments`,
      `master_data_job-titles`,
      `master_data_locations`,
      `master_data_performance-metrics`,
      `master_data_training-courses`,
      `master_data_salary-components`,
      `master_data_benefits`,
      `master_data_service-categories`,
      `master_data_ticket-types`,
      `master_data_sla-levels`,
      `master_data_asset-types`,
      `master_data_vendors`,
      `master_data_project-categories`,
      `master_data_task-types`,
      `master_data_priority-levels`,
      `master_data_invoice-templates`,
      `master_data_tax-rates`,
      `master_data_payment-terms`,
      `master_data_document-types`,
      `master_data_knowledge-categories`,
      `master_data_communication-channels`,
      `master_data_workflow-templates`,
    ];

    // Clear each data key
    for (const key of dataKeys) {
      try {
        await kv.del(key);
        clearedCount++;
        console.log(`Cleared: ${key}`);
      } catch (error) {
        console.log(`Key not found or error clearing ${key}:`, error);
        // Continue even if a key doesn't exist
      }
    }

    console.log(`Reset complete. Cleared ${clearedCount} data keys.`);

    return c.json({
      success: true,
      message: 'Demo data reset successfully',
      clearedCount
    });
  } catch (error) {
    console.error('Error resetting demo data:', error);
    return c.json({
      success: false,
      error: 'Failed to reset demo data',
      details: error.message
    }, 500);
  }
});

export default app;