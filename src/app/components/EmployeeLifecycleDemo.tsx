import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  X,
  CheckCircle2,
  Circle,
  ArrowRight,
  User,
  UserPlus,
  LogIn,
  LayoutDashboard,
  Users,
  Package,
  Headphones,
  BookOpen,
  Database,
  GraduationCap,
  MessageSquare,
  FolderKanban,
  DollarSign,
  LogOut,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Clock,
  CheckCheck,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/constants';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468`;

interface LifecycleStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  app: string;
  route: string;
  action: string;
  estimatedTime: string;
  dataCreated: string[];
  status: 'pending' | 'in-progress' | 'completed';
}

const LIFECYCLE_STEPS: LifecycleStep[] = [
  {
    id: 'recruitment',
    title: 'Job Application & Hiring',
    description: 'Candidate applies for a position and goes through the interview process',
    icon: UserPlus,
    app: 'Recruitment Tracker',
    route: '/recruitment',
    action: 'Create candidate profile and track through hiring stages',
    estimatedTime: '2-4 weeks',
    dataCreated: ['Candidate Record', 'Interview Feedback', 'Offer Letter'],
    status: 'pending'
  },
  {
    id: 'onboarding',
    title: 'Employee Onboarding',
    description: 'New hire completes onboarding tasks and documentation',
    icon: User,
    app: 'Onboarding Portal',
    route: '/onboarding',
    action: 'Complete onboarding checklist, sign documents, set up accounts',
    estimatedTime: '1-2 weeks',
    dataCreated: ['Employee Profile', 'Signed Documents', 'Onboarding Tasks'],
    status: 'pending'
  },
  {
    id: 'login',
    title: 'First Login & Account Setup',
    description: 'Employee logs in for the first time and sets up their profile',
    icon: LogIn,
    app: 'Login System',
    route: '/login',
    action: 'Create account credentials and verify email',
    estimatedTime: '15 minutes',
    dataCreated: ['User Account', 'Login Credentials', 'User Preferences'],
    status: 'pending'
  },
  {
    id: 'dashboard',
    title: 'Employee Dashboard',
    description: 'Access personal dashboard with overview of tasks and information',
    icon: LayoutDashboard,
    app: 'Employee Dashboard',
    route: '/employee-dashboard',
    action: 'Review dashboard, check tasks, and view announcements',
    estimatedTime: '10 minutes',
    dataCreated: ['Dashboard Widgets', 'Task List', 'Notifications'],
    status: 'pending'
  },
  {
    id: 'directory',
    title: 'Employee Directory',
    description: 'Find colleagues, view org chart, and build network',
    icon: Users,
    app: 'Employee Directory',
    route: '/employee-directory',
    action: 'Update profile, connect with team members',
    estimatedTime: '20 minutes',
    dataCreated: ['Directory Entry', 'Team Connections', 'Profile Photo'],
    status: 'pending'
  },
  {
    id: 'assets',
    title: 'Asset Assignment',
    description: 'Receive laptop, phone, and other equipment',
    icon: Package,
    app: 'Asset Management',
    route: '/asset-management',
    action: 'Review assigned assets and sign acceptance',
    estimatedTime: '30 minutes',
    dataCreated: ['Asset Assignments', 'Asset Custody Records', 'Condition Reports'],
    status: 'pending'
  },
  {
    id: 'it-services',
    title: 'IT Support & Services',
    description: 'Request IT support for setup issues or questions',
    icon: Headphones,
    app: 'IT Services',
    route: '/it-services',
    action: 'Create support tickets for technical assistance',
    estimatedTime: 'As needed',
    dataCreated: ['Support Tickets', 'Service Requests', 'Resolution Notes'],
    status: 'pending'
  },
  {
    id: 'documentation',
    title: 'User Documentation',
    description: 'Access company policies, procedures, and guides',
    icon: BookOpen,
    app: 'User Documentation',
    route: '/user-documentation',
    action: 'Read employee handbook and policy documents',
    estimatedTime: '1-2 hours',
    dataCreated: ['Document Access Logs', 'Acknowledgments', 'Bookmarks'],
    status: 'pending'
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    description: 'Search for answers and contribute knowledge',
    icon: Database,
    app: 'Knowledge Base',
    route: '/knowledge-base',
    action: 'Browse articles, search FAQs, bookmark resources',
    estimatedTime: '30 minutes',
    dataCreated: ['Search History', 'Bookmarked Articles', 'Feedback'],
    status: 'pending'
  },
  {
    id: 'training',
    title: 'Training & Development',
    description: 'Complete required training courses and certifications',
    icon: GraduationCap,
    app: 'Training Tracker',
    route: '/training',
    action: 'Enroll in courses, complete modules, track progress',
    estimatedTime: '2-4 weeks',
    dataCreated: ['Training Enrollments', 'Course Progress', 'Certifications'],
    status: 'pending'
  },
  {
    id: 'communication',
    title: 'Internal Communications',
    description: 'Stay informed with company news and announcements',
    icon: MessageSquare,
    app: 'Communications Hub',
    route: '/communications',
    action: 'Read announcements, subscribe to channels',
    estimatedTime: 'Daily',
    dataCreated: ['Channel Subscriptions', 'Read Receipts', 'Reactions'],
    status: 'pending'
  },
  {
    id: 'projects',
    title: 'Project Assignment',
    description: 'Get assigned to projects and start contributing',
    icon: FolderKanban,
    app: 'Project Management',
    route: '/project-management',
    action: 'Join project teams, view tasks, update status',
    estimatedTime: 'Ongoing',
    dataCreated: ['Project Assignments', 'Task Updates', 'Time Logs'],
    status: 'pending'
  },
  {
    id: 'payroll',
    title: 'Payroll & Compensation',
    description: 'Set up payroll, view payslips, manage benefits',
    icon: DollarSign,
    app: 'Payroll Management',
    route: '/payroll',
    action: 'Configure bank details, review salary, select benefits',
    estimatedTime: '1 hour',
    dataCreated: ['Bank Details', 'Tax Information', 'Benefits Selection'],
    status: 'pending'
  },
  {
    id: 'exit',
    title: 'Exit Process (When Leaving)',
    description: 'Complete exit formalities and knowledge transfer',
    icon: LogOut,
    app: 'Exit Management',
    route: '/exit',
    action: 'Return assets, complete exit interview, transfer knowledge',
    estimatedTime: '1-2 weeks',
    dataCreated: ['Exit Interview', 'Asset Returns', 'Clearance Certificate'],
    status: 'pending'
  }
];

export function EmployeeLifecycleDemo({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<LifecycleStep[]>(LIFECYCLE_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [demoEmployee, setDemoEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const currentStep = steps[currentStepIndex];
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / steps.length) * 100;

  useEffect(() => {
    createDemoEmployee();
  }, []);

  const createDemoEmployee = async () => {
    setLoading(true);
    const employee = {
      id: `demo-emp-${Date.now()}`,
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@jeshanlabs.com',
      phone: '+1-555-0199',
      dateOfBirth: '1990-05-15',
      department: 'Engineering',
      jobTitle: 'Senior Software Engineer',
      location: 'San Francisco HQ',
      startDate: new Date().toISOString().split('T')[0],
      employeeId: 'EMP-2024-099',
      status: 'candidate',
      stage: 'recruitment',
      createdAt: new Date().toISOString()
    };
    
    setDemoEmployee(employee);
    
    // Save to database
    try {
      await fetch(`${SERVER_URL}/lifecycle/employee`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(employee)
      });
    } catch (error) {
      console.error('Error creating demo employee:', error);
    }
    
    setLoading(false);
  };

  const completeStep = async (stepId: string) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status: 'completed' } : step
    ));

    // Update employee status in database
    try {
      await fetch(`${SERVER_URL}/lifecycle/step-complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId: demoEmployee?.id,
          stepId,
          completedAt: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error saving step completion:', error);
    }

    toast.success(`Completed: ${steps.find(s => s.id === stepId)?.title}`);

    // Auto-advance to next step if playing
    if (isPlaying && currentStepIndex < steps.length - 1) {
      setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1);
      }, 1500);
    }
  };

  const goToApp = () => {
    if (currentStep) {
      navigate(currentStep.route);
      toast.info(`Opening ${currentStep.app}...`);
    }
  };

  const resetDemo = () => {
    setSteps(LIFECYCLE_STEPS);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    createDemoEmployee();
    toast.info('Demo reset');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        <CardHeader className="sticky top-0 bg-white border-b z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Employee Lifecycle Demo</CardTitle>
                <CardDescription>Complete end-to-end journey from hiring to exit</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progress: {completedSteps} of {steps.length} steps</span>
              <span className="text-gray-500">{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Demo Employee Info */}
          {demoEmployee && (
            <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 text-white rounded-full h-12 w-12 flex items-center justify-center font-bold">
                    SJ
                  </div>
                  <div>
                    <p className="font-semibold">{demoEmployee.firstName} {demoEmployee.lastName}</p>
                    <p className="text-sm text-gray-600">{demoEmployee.jobTitle} • {demoEmployee.department}</p>
                  </div>
                </div>
                <Badge className="text-sm">{demoEmployee.employeeId}</Badge>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => setIsPlaying(!isPlaying)}
              variant={isPlaying ? 'secondary' : 'default'}
              className="flex-1"
            >
              {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isPlaying ? 'Pause Tour' : 'Start Auto Tour'}
            </Button>
            <Button onClick={resetDemo} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Current Step Detail */}
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-blue-600 text-white p-3 rounded-lg">
                    {currentStep && <currentStep.icon className="h-6 w-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Step {currentStepIndex + 1} of {steps.length}</Badge>
                      <Badge>{currentStep?.app}</Badge>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{currentStep?.title}</h3>
                    <p className="text-gray-700 mb-4">{currentStep?.description}</p>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">Estimated Time</span>
                        </div>
                        <p className="text-sm text-gray-600">{currentStep?.estimatedTime}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">Data Created</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {currentStep?.dataCreated.join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium mb-1">Action Required:</p>
                      <p className="text-sm text-gray-700">{currentStep?.action}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={goToApp} className="flex-1">
                        Open {currentStep?.app}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                      <Button
                        onClick={() => completeStep(currentStep?.id)}
                        variant="outline"
                        disabled={currentStep?.status === 'completed'}
                      >
                        {currentStep?.status === 'completed' ? (
                          <>
                            <CheckCheck className="h-4 w-4 mr-2" />
                            Completed
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Mark Complete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* All Steps Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Complete Employee Journey</CardTitle>
              <CardDescription>Click any step to jump to that stage</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isCurrent = index === currentStepIndex;
                  const isCompleted = step.status === 'completed';
                  
                  return (
                    <div
                      key={step.id}
                      onClick={() => setCurrentStepIndex(index)}
                      className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : isCompleted
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {/* Step Number & Icon */}
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`rounded-full h-10 w-10 flex items-center justify-center ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrent
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <span className="text-sm font-bold">{index + 1}</span>
                          )}
                        </div>
                        {index < steps.length - 1 && (
                          <div
                            className={`w-0.5 h-8 ${
                              isCompleted ? 'bg-green-300' : 'bg-gray-200'
                            }`}
                          />
                        )}
                      </div>

                      {/* Step Content */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${
                              isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
                            }`} />
                            <h4 className="font-semibold">{step.title}</h4>
                          </div>
                          <Badge variant={isCompleted ? 'default' : 'outline'} className="text-xs">
                            {step.app}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {step.estimatedTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {step.dataCreated.length} data items
                          </span>
                        </div>
                      </div>

                      {/* Status Indicator */}
                      {isCurrent && !isCompleted && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          Current
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Key Features */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>What This Demo Showcases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">End-to-End Integration</p>
                    <p className="text-sm text-gray-600">All 14 applications connected seamlessly</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Database Persistence</p>
                    <p className="text-sm text-gray-600">Every step saves data to Supabase</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Real-World Workflow</p>
                    <p className="text-sm text-gray-600">Mirrors actual employee lifecycle</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Data Continuity</p>
                    <p className="text-sm text-gray-600">Information flows between all systems</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
