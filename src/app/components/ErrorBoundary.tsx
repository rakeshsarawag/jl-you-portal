import { useRouteError, useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { t } from '../../i18n';

interface ErrorBoundaryProps {
  accessToken?: string;
  onLogout?: () => void;
}

export function ErrorBoundary({ accessToken, onLogout }: ErrorBoundaryProps = {}) {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  // Only log if there's actually an error with content
  if (error && (error.message || error.statusText || error.status)) {
    console.error('Route error:', error);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl">{t('errorBoundary.title')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            {t('errorBoundary.description')}
          </p>

          {(error?.message || error?.statusText) && (
            <div className="bg-gray-100 p-3 rounded-lg">
              <p className="text-sm text-gray-700 font-mono">
                {error.message || error.statusText || t('errorBoundary.unknownError')}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => navigate('/')} className="flex-1">
              <Home className="h-4 w-4 mr-2" />
              {t('errorBoundary.goHome')}
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline" className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('errorBoundary.reload')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}