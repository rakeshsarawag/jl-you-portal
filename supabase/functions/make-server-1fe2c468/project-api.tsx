import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  startDate: string;
  endDate: string;
  progress: number;
  team: TeamMember[];
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'Review' | 'Done';
  assignee?: string;
  dueDate?: string;
  priority: 'Low' | 'Medium' | 'High';
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

// Get all projects
app.get('/projects', async (c) => {
  try {
    const userId = c.req.header('X-User-Id') || 'admin';
    const key = `projects_${userId}`;
    const projects = await kv.get(key) as Project[] || [];
    return c.json({ success: true, data: projects });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch projects' }, 500);
  }
});

// Create project
app.post('/projects', async (c) => {
  try {
    const userId = c.req.header('X-User-Id') || 'admin';
    const key = `projects_${userId}`;
    const body = await c.req.json();
    const projects = await kv.get(key) as Project[] || [];
    
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      ...body,
      progress: 0,
      tasks: [],
      team: body.team || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    projects.unshift(newProject);
    await kv.set(key, projects);
    return c.json({ success: true, data: newProject }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create project' }, 500);
  }
});

// Update project
app.put('/projects/:id', async (c) => {
  try {
    const userId = c.req.header('X-User-Id') || 'admin';
    const projectId = c.req.param('id');
    const key = `projects_${userId}`;
    const body = await c.req.json();
    const projects = await kv.get(key) as Project[] || [];
    const index = projects.findIndex(p => p.id === projectId);
    
    if (index === -1) {
      return c.json({ success: false, error: 'Project not found' }, 404);
    }
    
    // Recalculate progress if tasks updated
    if (body.tasks) {
      const completedTasks = body.tasks.filter((t: Task) => t.status === 'Done').length;
      body.progress = body.tasks.length > 0 ? Math.round((completedTasks / body.tasks.length) * 100) : 0;
    }
    
    projects[index] = { ...projects[index], ...body, updatedAt: new Date().toISOString() };
    await kv.set(key, projects);
    return c.json({ success: true, data: projects[index] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update project' }, 500);
  }
});

// Delete project
app.delete('/projects/:id', async (c) => {
  try {
    const userId = c.req.header('X-User-Id') || 'admin';
    const projectId = c.req.param('id');
    const key = `projects_${userId}`;
    const projects = await kv.get(key) as Project[] || [];
    const filtered = projects.filter(p => p.id !== projectId);
    await kv.set(key, filtered);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete project' }, 500);
  }
});

// Add task to project
app.post('/projects/:id/tasks', async (c) => {
  try {
    const userId = c.req.header('X-User-Id') || 'admin';
    const projectId = c.req.param('id');
    const key = `projects_${userId}`;
    const body = await c.req.json();
    const projects = await kv.get(key) as Project[] || [];
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      return c.json({ success: false, error: 'Project not found' }, 404);
    }
    
    const newTask: Task = {
      id: `task_${Date.now()}`,
      ...body,
      status: body.status || 'To Do',
    };
    
    project.tasks.push(newTask);
    const completedTasks = project.tasks.filter(t => t.status === 'Done').length;
    project.progress = Math.round((completedTasks / project.tasks.length) * 100);
    project.updatedAt = new Date().toISOString();
    
    await kv.set(key, projects);
    return c.json({ success: true, data: project });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add task' }, 500);
  }
});

// Get stats
app.get('/stats', async (c) => {
  try {
    const userId = c.req.header('X-User-Id') || 'admin';
    const key = `projects_${userId}`;
    const projects = await kv.get(key) as Project[] || [];
    
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === 'In Progress').length;
    const completedProjects = projects.filter(p => p.status === 'Completed').length;
    const onHoldProjects = projects.filter(p => p.status === 'On Hold').length;
    
    const stats = {
      totalProjects,
      activeProjects,
      completedProjects,
      onHoldProjects,
    };
    
    return c.json({ success: true, data: stats });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

export default app;
