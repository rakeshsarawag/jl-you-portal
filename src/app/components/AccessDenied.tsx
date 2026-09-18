/**
 * Access Denied Component
 * Displayed when users try to access unauthorized content
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ShieldAlert, Lock, ArrowLeft, Home, Mail } from 'lucide-react';
import { useNavigate } from 'react-router';
import { UserRole } from '../../types/rbac';
import { ROLE_DEFINITIONS } from '../../utils/rbac/roleDefinitions';

interface AccessDeniedProps {
  requiredRoles?: UserRole[];
  message?: string;
  appName?: string;
}

export function AccessDenied({ requiredRoles, message, appName }: AccessDeniedProps) {
  const navigate = useNavigate();

  const defaultMessage = message || 'You do not have permission to access this content.';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full border-red-200">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-red-100 rounded-full w-20 h-20 flex items-center justify-center">
            <ShieldAlert className="h-12 w-12 text-red-600" />
          </div>
          <CardTitle className="text-3xl text-red-900">Access Denied</CardTitle>
          <CardDescription className="text-lg text-gray-600 mt-2">
            {defaultMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {appName && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-red-600" />
                <div>
                  <h4 className="font-semibold text-red-900">Restricted Application</h4>
                  <p className="text-sm text-red-700">
                    {appName} requires special permissions to access.
                  </p>
                </div>
              </div>
            </div>
          )}

          {requiredRoles && requiredRoles.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3">Required Roles</h4>
              <p className="text-sm text-blue-700 mb-3">
                You need one of the following roles to access this content:
              </p>
              <div className="flex flex-wrap gap-2">
                {requiredRoles.map((roleId) => {
                  const role = ROLE_DEFINITIONS[roleId];
                  return (
                    <Badge
                      key={roleId}
                      className={`${role?.color || 'bg-gray-500'} text-white`}
                    >
                      {role?.name || roleId}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">Need Access?</h4>
            <p className="text-sm text-yellow-800 mb-3">
              If you believe you should have access to this content, please contact your administrator.
            </p>
            <div className="flex items-center gap-2 text-sm text-yellow-700">
              <Mail className="h-4 w-4" />
              <span>Email: rakesh.sarawag@jeshanlabs.com</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button
              onClick={() => navigate('/')}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Home className="h-4 w-4 mr-2" />
              Return to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}