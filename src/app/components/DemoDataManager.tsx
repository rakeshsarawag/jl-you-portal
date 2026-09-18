/**
 * Demo Data Manager
 * Floating widget to populate demo data for testing
 */

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Database, X, Check, Loader2, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE, publicAnonKey, safeJson } from '../utils/constants';

export function DemoDataManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [creatingUsers, setCreatingUsers] = useState(false);
  const [usersChecked, setUsersChecked] = useState(false);

  // Check and auto-create test users on component mount
  useEffect(() => {
    const checkAndCreateUsers = async () => {
      // Only run once
      if (usersChecked) return;
      
      try {
        console.log('Checking if test users need to be created...');
        
        // Use a timeout to prevent long hangs
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${API_BASE}/demo-data/create-test-users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await safeJson(response);
          const created = data.results?.filter((r: any) => r.status === 'created').length || 0;
          
          if (created > 0) {
            console.log(`Auto-created ${created} test user(s)`);
          } else {
            console.log('Test users already exist or check complete');
          }
        } else {
          console.log('Test user check returned non-OK status:', response.status);
        }
      } catch (error: any) {
        // Silently fail - this is not critical for app functionality
        if (error.name === 'AbortError') {
          console.log('Test user check timed out - skipping');
        } else {
          console.log('Test user check skipped:', error.message);
        }
      } finally {
        setUsersChecked(true);
      }
    };

    // Add a small delay before checking to let the app initialize
    const timer = setTimeout(() => {
      checkAndCreateUsers();
    }, 2000);

    return () => clearTimeout(timer);
  }, [usersChecked]);

  const populateDemoData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/demo-data/populate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          'X-User-Id': 'admin',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to populate demo data');
      }

      const data = await safeJson(response);
      
      toast.success('Demo data populated!', {
        description: `Created ${data?.count || 'multiple'} demo records`,
      });
      
      setIsOpen(false);
      
      // Refresh the page to show new data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error populating demo data:', error);
      toast.error('Failed to populate demo data', {
        description: 'Please try again or check the console for errors',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetDemoData = async () => {
    if (!confirm('Are you sure you want to reset ALL demo data? This will delete all existing data in the database.')) {
      return;
    }

    setResetting(true);
    try {
      const response = await fetch(`${API_BASE}/demo-data/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          'X-User-Id': 'admin',
        },
      });

      if (!response.ok) {
        const errorData = await safeJson(response);
        console.error('Reset error response:', errorData);
        throw new Error(errorData?.error || 'Failed to reset demo data');
      }

      const data = await safeJson(response);
      console.log('Reset response:', data);
      
      toast.success('Demo data reset!', {
        description: `Cleared ${data?.clearedCount || 'all'} data entries`,
      });
      
      setIsOpen(false);
      
      // Refresh the page to show cleared data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error resetting demo data:', error);
      toast.error('Failed to reset demo data', {
        description: error.message || 'Please try again or check the console for errors',
      });
    } finally {
      setResetting(false);
    }
  };

  const createTestUsers = async () => {
    setCreatingUsers(true);
    try {
      const response = await fetch(`${API_BASE}/demo-data/create-test-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create test users');
      }

      const data = await safeJson(response);
      
      const created = data.results?.filter((r: any) => r.status === 'created').length || 0;
      const existing = data.results?.filter((r: any) => r.status === 'already_exists').length || 0;
      
      if (created > 0) {
        toast.success('Test users created!', {
          description: `Created ${created} new user(s). ${existing > 0 ? `${existing} already existed.` : ''}`,
        });
      } else if (existing > 0) {
        toast.info('Test users already exist', {
          description: 'All test users have already been created',
        });
      }
    } catch (error) {
      console.error('Error creating test users:', error);
      toast.error('Failed to create test users', {
        description: 'Please try again or check the console for errors',
      });
    } finally {
      setCreatingUsers(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-8 rounded-full shadow-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white z-40"
        size="lg"
      >
        <Database className="h-5 w-5 mr-2" />
        Demo Data
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-24 right-8 w-96 shadow-2xl z-40 border-2 border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-600" />
            Demo Data Manager
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Manage sample data for testing purposes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Users Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-blue-600" />
            <h4 className="font-semibold text-blue-900">Test Users</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="bg-white rounded p-2 border border-blue-100">
              <p className="font-medium text-gray-900">Rakesh Sarawag</p>
              <p className="text-xs text-gray-600">Email: rakesh.sarawag@jeshanlabs.com</p>
              <p className="text-xs text-gray-600">Password: admin123</p>
              <div className="flex gap-1 mt-1">
                <Badge className="bg-red-100 text-red-800 text-xs">Admin</Badge>
                <Badge className="bg-purple-100 text-purple-800 text-xs">Full Access</Badge>
              </div>
            </div>
            <div className="bg-white rounded p-2 border border-blue-100">
              <p className="font-medium text-gray-900">Employee User</p>
              <p className="text-xs text-gray-600">Email: employee@jeshanlabs.com</p>
              <p className="text-xs text-gray-600">Password: employee123</p>
              <div className="flex gap-1 mt-1">
                <Badge className="bg-blue-100 text-blue-800 text-xs">Employee</Badge>
                <Badge className="bg-gray-100 text-gray-800 text-xs">Limited Access</Badge>
              </div>
            </div>
          </div>
          <Button
            onClick={createTestUsers}
            disabled={creatingUsers || loading || resetting}
            className="w-full mt-3"
            variant="outline"
          >
            {creatingUsers ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Users...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Create Test Users
              </>
            )}
          </Button>
          <p className="text-xs text-blue-700 mt-2">
            💡 Click to create these accounts in Supabase Auth
          </p>
        </div>

        {/* Demo Data Section */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Demo data includes:
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Employees</Badge>
            <Badge variant="secondary">Projects</Badge>
            <Badge variant="secondary">Tasks</Badge>
            <Badge variant="secondary">Invoices</Badge>
            <Badge variant="secondary">Assets</Badge>
            <Badge variant="secondary">OKRs</Badge>
            <Badge variant="secondary">Trainings</Badge>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-xs text-yellow-800">
            ⚠️ Populate will add sample data. Reset will delete ALL existing data.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={populateDemoData}
            disabled={loading || resetting}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Populate
              </>
            )}
          </Button>

          <Button
            onClick={resetDemoData}
            disabled={loading || resetting}
            variant="destructive"
          >
            {resetting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Reset All
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}