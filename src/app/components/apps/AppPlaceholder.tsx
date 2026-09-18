import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ArrowLeft, Info } from 'lucide-react';

interface AppPlaceholderProps {
  accessToken: string;
  onLogout: () => void;
  appName: string;
  description: string;
  redirectTo?: string;
  icon?: string;
}

export function AppPlaceholder({ 
  accessToken, 
  onLogout, 
  appName, 
  description, 
  redirectTo = '/',
  icon = '📱'
}: AppPlaceholderProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(redirectTo)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Launchpad
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-6xl">{icon}</div>
              <div>
                <CardTitle className="text-3xl">{appName}</CardTitle>
                <CardDescription className="text-lg mt-2">{description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">Feature Consolidation</h3>
                  <p className="text-sm text-blue-800 mb-4">
                    This application has been consolidated into the Advanced Features Dashboard for better organization and enhanced functionality.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => navigate('/advanced-features')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Go to Advanced Features
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/')}
                    >
                      Back to Launchpad
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Available in Advanced Features:</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  Analytics & Reporting
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  Workflow Automation
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  AI Intelligence
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  Security & Compliance
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  Collaboration Tools
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  Executive Dashboards
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Export specific placeholders for each app
export const PerformanceTrackerDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="Performance Tracker" 
    description="Track and manage employee performance reviews"
    icon="📊"
  />
);

export const UserDocumentationDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="User Documentation" 
    description="Access comprehensive system documentation"
    icon="📚"
  />
);

export const TrainingTrackerDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="Training Tracker" 
    description="Manage employee training and development"
    icon="🎓"
  />
);

export const CommunicationsHubDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="Communications Hub" 
    description="Internal communications and announcements"
    icon="💬"
    redirectTo="/"
  />
);

export const AssetManagementDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="Asset Management" 
    description="Track and manage company assets"
    icon="💼"
  />
);

export const KnowledgeBaseDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="Knowledge Base" 
    description="Centralized knowledge repository"
    icon="🧠"
  />
);

export const EmployeeDirectoryDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="Employee Directory" 
    description="Search and browse employee information"
    icon="👥"
  />
);

export const PayrollManagementDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="Payroll Management" 
    description="Manage employee payroll and compensation"
    icon="💰"
  />
);

export const ProjectManagementDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="Project Management" 
    description="Plan and track project progress"
    icon="📋"
  />
);

export const OKRManagementDB = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="OKR & Goal Management" 
    description="Set and track organizational objectives"
    icon="🎯"
  />
);

export const MasterData = (props: Omit<AppPlaceholderProps, 'appName' | 'description' | 'icon'>) => (
  <AppPlaceholder 
    {...props} 
    appName="Master Data Settings" 
    description="Configure system master data"
    icon="⚙️"
  />
);
