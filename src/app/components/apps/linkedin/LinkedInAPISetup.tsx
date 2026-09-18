import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { BookOpen, ExternalLink, Key, Save, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { useLinkedInSettings } from '../../../hooks/useLinkedInData';
import { toast } from 'sonner';

export function LinkedInAPISetup() {
  const { settings, loading, updateSettings } = useLinkedInSettings();
  const [credentials, setCredentials] = useState({
    clientId: settings?.apiClientId || '',
    clientSecret: settings?.apiClientSecret || '',
    accessToken: settings?.apiAccessToken || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateSettings({
        ...settings,
        apiClientId: credentials.clientId,
        apiClientSecret: credentials.clientSecret,
        apiAccessToken: credentials.accessToken,
      });
      toast.success('API credentials saved!');
    } catch (error) {
      toast.error('Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">API Setup Guide</h1>
        <p className="text-gray-600">Configure LinkedIn API for automatic posting</p>
      </div>

      {/* Warning Banner */}
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900">Development Mode</p>
            <p className="text-sm text-yellow-700">
              LinkedIn API integration is currently in development. Follow the steps below to prepare your credentials.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* API Credentials Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Credentials
          </CardTitle>
          <CardDescription>Enter your LinkedIn API credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Client ID</Label>
              <Input
                type="text"
                value={credentials.clientId}
                onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                placeholder="Enter your LinkedIn Client ID"
              />
            </div>
            <div>
              <Label>Client Secret</Label>
              <Input
                type="password"
                value={credentials.clientSecret}
                onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
                placeholder="Enter your LinkedIn Client Secret"
              />
            </div>
            <div>
              <Label>Access Token (Optional)</Label>
              <Input
                type="password"
                value={credentials.accessToken}
                onChange={(e) => setCredentials({ ...credentials, accessToken: e.target.value })}
                placeholder="Enter your Access Token"
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Credentials
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Create LinkedIn App</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Visit the LinkedIn Developer Portal and create a new app for your organization.
            </p>
            <Button variant="outline" asChild>
              <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open LinkedIn Developer Portal
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Get API Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Once your app is created, you'll receive Client ID and Client Secret. Save these securely and enter them in the form above.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 3: Configure Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-3">
              Enable the following permissions in your LinkedIn app:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li><strong>w_member_social</strong> - Post content on behalf of members</li>
              <li><strong>w_organization_social</strong> - Post on company pages</li>
              <li><strong>r_organization_social</strong> - Read company page data</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 4: Testing & Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              After saving your credentials, test the connection to ensure everything is working correctly.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="h-4 w-4 text-green-600" />
                <span>Credentials saved successfully</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Ready for testing when API integration is complete</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">
              <BookOpen className="h-5 w-5 inline mr-2" />
              Additional Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-blue-900">
              <li>
                <a
                  href="https://learn.microsoft.com/en-us/linkedin/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  LinkedIn API Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/share-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Share API Reference
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}