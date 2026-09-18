import { useState, useEffect } from 'react';
import { InlineLoader } from '../ui/PageLoader';
import { toast } from 'sonner';
import ConfirmDialog from '../ui/ConfirmDialog';
import { motion } from 'motion/react';
import { Folder, Plus, Edit, Trash2, Target, TrendingUp, Users, DollarSign, CheckCircle2, Clock, X, Eye } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { Progress } from '../ui/progress';
import { projectId, publicAnonKey } from '../../utils/constants';
import { useUser } from '../../context/UserContext';
import { useSectionPermission } from '../SectionGuard';
import { AppLayout } from './AppLayout';
import { t } from '../../../i18n/index';

interface ProjectManagementEnhancedProps {
  accessToken: string;
  onLogout: () => void;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress?: number;
  startDate?: string;
  endDate?: string;
  budget?: number;
  spent?: number;
  teamMembers?: string[];
  tasks?: number;
  completedTasks?: number;
}

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468`;

export function ProjectManagementEnhanced({ accessToken, onLogout }: ProjectManagementEnhancedProps) {
  const { currentUser } = useUser();
  const canCreateProject = useSectionPermission('projects', 'create_project');
  const canManageTeam = useSectionPermission('projects', 'manage_team');
  const canCreateTasks = useSectionPermission('projects', 'create_tasks');
  const canDeleteTasks = useSectionPermission('projects', 'delete_tasks');
  const canViewReports = useSectionPermission('projects', 'reports');
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [projectErrors, setProjectErrors] = useState<Record<string, string>>({});
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    status: 'planning' as const,
    priority: 'medium' as const,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    budget: 0,
    teamMembers: [] as string[],
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/projects/projects`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Id': currentUser?.id || 'admin'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.data || []);
      } else {
        toast.error('Failed to load projects');
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = (id: string) => {
    setConfirmState({ title: 'Delete Project', message: 'Are you sure you want to delete this project?', danger: true, action: () => { setConfirmState(null); doDeleteProject(id); } });
  };

  const doDeleteProject = async (id: string) => {

    try {
      const response = await fetch(`${API_BASE}/projects/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Id': currentUser?.id || 'admin'
        }
      });

      if (response.ok) {
        toast.success('Project deleted');
        loadProjects();
      } else {
        toast.error('Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  const handleCreateProject = async () => {
    const errs: Record<string, string> = {};
    if (!newProject.name?.trim()) errs.name = t('validation.project.name');
    if (!newProject.startDate) errs.startDate = t('validation.project.startDate');
    if (!newProject.endDate) errs.endDate = t('validation.project.endDate');
    if (newProject.startDate && newProject.endDate && new Date(newProject.endDate) <= new Date(newProject.startDate)) errs.endDate = t('validation.project.dateRange');
    if (newProject.budget && Number(newProject.budget) <= 0) errs.budget = t('validation.project.budget');
    if (Object.keys(errs).length > 0) {
      setProjectErrors(errs);
      toast.error(t('common.error'));
      return;
    }
    setProjectErrors({});

    try {
      const projectData = {
        ...newProject,
        progress: 0,
        spent: 0,
        tasks: 0,
        completedTasks: 0,
        createdBy: currentUser?.id || 'admin',
      };

      const response = await fetch(`${API_BASE}/projects/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Id': currentUser?.id || 'admin'
        },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        toast.success('Project created successfully');
        setShowCreateDialog(false);
        setNewProject({
          name: '',
          description: '',
          status: 'planning',
          priority: 'medium',
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          budget: 0,
          teamMembers: [],
        });
        loadProjects();
      } else {
        toast.error('Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'planning': return 'bg-yellow-100 text-yellow-800';
      case 'on-hold': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length) : 0;

  if (loading) {
    return (
      <AppLayout title="Project Management" icon={<Folder className="h-6 w-6" />} onLogout={onLogout}>
        <InlineLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Project Management" icon={<Folder className="h-6 w-6" />} onLogout={onLogout}>
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-none">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Project Management</h2>
                <p className="text-indigo-100 text-lg">Track and manage all your projects</p>
              </div>
              <Folder className="h-24 w-24 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Projects</p>
                  <p className="text-3xl font-bold">{totalProjects}</p>
                </div>
                <Folder className="h-12 w-12 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active</p>
                  <p className="text-3xl font-bold">{activeProjects}</p>
                </div>
                <Target className="h-12 w-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Completed</p>
                  <p className="text-3xl font-bold">{completedProjects}</p>
                </div>
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Avg Progress</p>
                  <p className="text-3xl font-bold">{avgProgress}%</p>
                </div>
                <TrendingUp className="h-12 w-12 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Projects</CardTitle>
              {canCreateProject && (
                <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-2" />New Project</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-48 border rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Status</option>
                <SelectOptions entity="project" field="status" fallback={['Planning','In Progress','On Hold','Completed','Cancelled']} />
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map((project, index) => (
                <motion.div key={project.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-900">{project.name}</h4>
                              <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                              <Badge className={getPriorityColor(project.priority)}>{project.priority}</Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{project.description}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Progress</span>
                            <span className="font-medium">{project.progress || 0}%</span>
                          </div>
                          <Progress value={project.progress || 0} className="h-2" />
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600">Tasks</p>
                            <p className="font-medium">{project.completedTasks || 0}/{project.tasks || 0}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Budget</p>
                            <p className="font-medium">${(project.spent || 0).toLocaleString()}/${(project.budget || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Team</p>
                            <p className="font-medium">{project.teamMembers?.length || 0} members</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Deadline</p>
                            <p className="font-medium">{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t">
                          <Button size="sm" variant="outline" className="flex-1"><Eye className="h-3 w-3 mr-1" />View</Button>
                          {canManageTeam && <Button size="sm" variant="outline"><Edit className="h-3 w-3" /></Button>}
                          {canDeleteTasks && <Button size="sm" variant="outline" onClick={() => handleDeleteProject(project.id)}><Trash2 className="h-3 w-3 text-red-600" /></Button>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {filteredProjects.length === 0 && (
                <div className="col-span-2 text-center py-12">
                  <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h3>
                  <p className="text-gray-600">Create a new project to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Create Project Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Create New Project</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateDialog(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Project Name *</Label>
                      <Input
                        placeholder="Enter project name"
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      />
                      {projectErrors.name && <p className="text-xs text-red-500 mt-0.5">{projectErrors.name}</p>}
                    </div>

                    <div className="col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Enter project description"
                        value={newProject.description}
                        onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label>Status</Label>
                        <select
                        value={newProject.status}
                        onChange={(e: any) => setNewProject({ ...newProject, status: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <SelectOptions entity="project" field="status" fallback={['Planning','In Progress','On Hold','Completed','Cancelled']} />
                      </select>
                    </div>

                    <div>
                      <Label>Priority</Label>
                        <select
                        value={newProject.priority}
                        onChange={(e: any) => setNewProject({ ...newProject, priority: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <SelectOptions entity="project" field="priority" fallback={['Low','Medium','High','Critical']} />
                      </select>
                    </div>

                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={newProject.startDate}
                        onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                      />
                      {projectErrors.startDate && <p className="text-xs text-red-500 mt-0.5">{projectErrors.startDate}</p>}
                    </div>

                    <div>
                      <Label>End Date *</Label>
                      <Input
                        type="date"
                        value={newProject.endDate}
                        onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                      />
                      {projectErrors.endDate && <p className="text-xs text-red-500 mt-0.5">{projectErrors.endDate}</p>}
                    </div>

                    <div className="col-span-2">
                      <Label>Budget</Label>
                      <Input
                        type="number"
                        placeholder="Enter budget amount"
                        value={newProject.budget}
                        onChange={(e) => setNewProject({ ...newProject, budget: parseFloat(e.target.value) || 0 })}
                      />
                      {projectErrors.budget && <p className="text-xs text-red-500 mt-0.5">{projectErrors.budget}</p>}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleCreateProject} className="flex-1">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </div>
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </AppLayout>
  );
}